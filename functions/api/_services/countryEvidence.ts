// Country evidence projection (ADR 0001 §4): `country_visit_evidence` and the published
// `country_evidence_suppressions`, computed from canonical rows inside the guarded repair batch.
//
// This is the one country-evidence calculation: Passport, Overview, `user_stats`, advanced stats and the
// queue DTOs read what it publishes (or call `effectiveArrivalPolicies`), and nothing recomputes a country
// set from airport aggregates or live endpoints.
import { rowsOf, type BatchedRead, type DerivedVisit } from './stats'
import { connectionChains, type ConnectionDecision, type ConnectionLabel } from './connections'

export const COUNTRY_POLICY_VERSION = 1

export type LifecycleState = 'upcoming' | 'awaiting' | 'logged'

export interface EvidenceFlight {
  id: number
  date: string
  origin: string
  destination: string
  lifecycle_state: LifecycleState
  arrival_transit: number | null
  arrival_transit_leg_id: number | null
  departure_utc: string | null
  arrival_utc: string | null
  origin_country: string | null
  origin_city: string | null
  destination_country: string | null
  destination_city: string | null
}

export interface CountrySuppression {
  flight_id: number
  endpoint: 'origin' | 'destination'
  country_code: string
}

export interface CountryEvidenceRow {
  country_code: string
  status: 'pressed' | 'pending'
  logged_visit_count: number
  awaiting_visit_count: number
  claimed: number
  ground_visit_count: number
  first_visit: string | null
  last_visit: string | null
  policy_version: number
}

/** A non-suppressed flight endpoint that supports a country; used by Passport detail. */
export interface CountryContribution {
  country_code: string
  flight_id: number
  endpoint: 'origin' | 'destination'
  airport: string
  city: string | null
  date: string
  state: 'awaiting' | 'logged'
}

export interface CountryEvidence {
  rows: CountryEvidenceRow[]
  suppressions: CountrySuppression[]
  contributions: CountryContribution[]
}

/** Effective arrival policy for one completed flight (ADR §4). */
export interface ArrivalPolicy {
  transit: boolean
  /** `explicit`: stored decision. `default`: prospective, recomputed from the live chain. `existing`: no decision, include. */
  source: 'explicit' | 'default' | 'existing'
  /** The outgoing leg whose origin is consumed with the destination; set only for transit. */
  legId: number | null
  /** Estimate label of a prospective default; null otherwise. */
  label: ConnectionLabel | null
}

/** Flight endpoint the visit aggregate understands (see derivedState `VisitSource`). */
export interface EndpointSource {
  airport_iata: string
  country_code: string | null
  city: string | null
  date: string
}

/** Max-merge of flight endpoints with legacy evidence, owned by derivedState. */
export type MergeVisits<L> = (sources: EndpointSource[], legacy: L[]) => DerivedVisit[]

const isCountry = (code: string | null | undefined): code is string =>
  typeof code === 'string' && code.length === 2

/** Rule 2 of the effective arrival policy: an unambiguous connection whose hub is a third country suggests transit. */
export const prospectiveTransit = (
  decision: ConnectionDecision | undefined,
): decision is Extract<ConnectionDecision, { kind: 'link' }> =>
  decision?.kind === 'link' && decision.thirdCountry

/**
 * The effective arrival policy of every completed (awaiting or logged) flight.
 *  1. An explicit decision wins. Transit consumes the destination and the *stored* leg's origin, and only
 *     while that leg still departs from the same airport; the live chain never moves a stored decision.
 *  2. Otherwise an awaiting flight with an unambiguous third-country connection defaults to transit.
 *  3. Otherwise (logged legacy/save, route changed, no connection) the endpoint is included.
 */
export function effectiveArrivalPolicies(
  flights: EvidenceFlight[],
  decisions: Map<number, ConnectionDecision> = connectionChains(flights),
): Map<number, ArrivalPolicy> {
  const byId = new Map(flights.map((flight) => [flight.id, flight]))
  const policies = new Map<number, ArrivalPolicy>()
  for (const flight of flights) {
    if (flight.lifecycle_state === 'upcoming') continue
    if (flight.arrival_transit !== null) {
      const leg =
        flight.arrival_transit === 1 && flight.arrival_transit_leg_id !== null
          ? byId.get(flight.arrival_transit_leg_id)
          : undefined
      policies.set(flight.id, {
        transit: flight.arrival_transit === 1,
        source: 'explicit',
        label: null,
        legId: leg && leg.origin === flight.destination ? leg.id : null,
      })
      continue
    }
    const decision = flight.lifecycle_state === 'awaiting' ? decisions.get(flight.id) : undefined
    if (prospectiveTransit(decision)) {
      policies.set(flight.id, {
        transit: true,
        source: 'default',
        legId: decision.toId,
        label: decision.label,
      })
    } else {
      policies.set(flight.id, { transit: false, source: 'existing', legId: null, label: null })
    }
  }
  return policies
}

/**
 * Endpoints whose country is suppressed by the effective arrival policy. Airport evidence is never
 * suppressed, only the country: the destination of a transit arrival and the matched leg's origin.
 */
export function arrivalSuppressions(
  flights: EvidenceFlight[],
  policies = effectiveArrivalPolicies(flights),
): CountrySuppression[] {
  const byId = new Map(flights.map((flight) => [flight.id, flight]))
  const out = new Map<string, CountrySuppression>()
  for (const flight of flights) {
    const policy = policies.get(flight.id)
    if (!policy?.transit) continue
    if (isCountry(flight.destination_country)) {
      out.set(`${flight.id}:destination`, {
        flight_id: flight.id,
        endpoint: 'destination',
        country_code: flight.destination_country,
      })
    }
    const leg = policy.legId === null ? undefined : byId.get(policy.legId)
    if (leg && isCountry(leg.origin_country)) {
      out.set(`${leg.id}:origin`, {
        flight_id: leg.id,
        endpoint: 'origin',
        country_code: leg.origin_country,
      })
    }
  }
  return [...out.values()].sort(
    (a, b) => a.flight_id - b.flight_id || a.endpoint.localeCompare(b.endpoint),
  )
}

/** Countries supported by completed flights or legacy evidence: the `countries_count` meaning (no claims, no ground visits). */
export const flightCountriesOf = (
  rows: Array<
    Pick<CountryEvidenceRow, 'country_code' | 'logged_visit_count' | 'awaiting_visit_count'>
  >,
): string[] =>
  rows
    .filter((row) => row.logged_visit_count + row.awaiting_visit_count > 0)
    .map((row) => row.country_code)

/**
 * Which flight endpoints support a country after the effective arrival policy. Passport detail uses this
 * directly; `deriveCountryEvidence` builds its rows on it, so there is one policy and no second calculation.
 */
export function countryContributions(flights: EvidenceFlight[]): {
  suppressions: CountrySuppression[]
  logged: EndpointSource[]
  awaiting: EndpointSource[]
  contributions: CountryContribution[]
} {
  const suppressions = arrivalSuppressions(flights)
  const suppressed = new Set(suppressions.map((row) => `${row.flight_id}:${row.endpoint}`))
  const logged: EndpointSource[] = []
  const awaiting: EndpointSource[] = []
  const contributions: CountryContribution[] = []
  for (const flight of flights) {
    if (flight.lifecycle_state === 'upcoming') continue
    const target = flight.lifecycle_state === 'logged' ? logged : awaiting
    for (const endpoint of ['origin', 'destination'] as const) {
      const country = endpoint === 'origin' ? flight.origin_country : flight.destination_country
      // Unknown airports have no reference row and contribute nothing, as in `visits`.
      if (country === null || suppressed.has(`${flight.id}:${endpoint}`)) continue
      const city = endpoint === 'origin' ? flight.origin_city : flight.destination_city
      target.push({
        airport_iata: flight[endpoint],
        country_code: country,
        city,
        date: flight.date,
      })
      if (isCountry(country)) {
        contributions.push({
          country_code: country,
          flight_id: flight.id,
          endpoint,
          airport: flight[endpoint],
          city,
          date: flight.date,
          state: flight.lifecycle_state === 'logged' ? 'logged' : 'awaiting',
        })
      }
    }
  }
  return { suppressions, logged, awaiting, contributions }
}

/** Pure projection from canonical rows; the migration seed equals it while nothing is awaiting or suppressed. */
export function deriveCountryEvidence<L>(
  input: {
    flights: EvidenceFlight[]
    legacy: L[]
    claims: string[]
    ground: Array<{ country_code: string; n: number }>
  },
  merge: MergeVisits<L>,
): CountryEvidence {
  const { suppressions, logged, awaiting, contributions } = countryContributions(input.flights)
  const byCountry = new Map<string, CountryEvidenceRow>()
  const row = (code: string) => {
    let current = byCountry.get(code)
    if (!current) {
      current = {
        country_code: code,
        status: 'pending',
        logged_visit_count: 0,
        awaiting_visit_count: 0,
        claimed: 0,
        ground_visit_count: 0,
        first_visit: null,
        last_visit: null,
        policy_version: COUNTRY_POLICY_VERSION,
      }
      byCountry.set(code, current)
    }
    return current
  }
  const addVisits = (
    visits: DerivedVisit[],
    field: 'logged_visit_count' | 'awaiting_visit_count',
  ) => {
    for (const visit of visits) {
      if (!isCountry(visit.country_code)) continue
      const current = row(visit.country_code)
      current[field] += visit.visit_count
      if (current.first_visit === null || visit.first_visit < current.first_visit)
        current.first_visit = visit.first_visit
      if (current.last_visit === null || visit.last_visit > current.last_visit)
        current.last_visit = visit.last_visit
    }
  }
  addVisits(merge(logged, input.legacy), 'logged_visit_count')
  addVisits(merge(awaiting, []), 'awaiting_visit_count')
  for (const code of input.claims) if (isCountry(code)) row(code).claimed = 1
  for (const ground of input.ground)
    if (isCountry(ground.country_code)) row(ground.country_code).ground_visit_count += ground.n

  const rows = [...byCountry.values()]
    .filter(
      (current) =>
        current.logged_visit_count > 0 ||
        current.awaiting_visit_count > 0 ||
        current.claimed === 1 ||
        current.ground_visit_count > 0,
    )
    .map((current) => ({
      ...current,
      status: (current.logged_visit_count > 0 ||
      current.claimed === 1 ||
      current.ground_visit_count > 0
        ? 'pressed'
        : 'pending') as CountryEvidenceRow['status'],
    }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code))
  return { rows, suppressions, contributions }
}

/** Every flight in every state (upcoming ones are potential outgoing legs) with its airports' countries. */
export function evidenceFlightsStatement(db: D1Database, userId: string): D1PreparedStatement {
  return db
    .prepare(
      `SELECT f.id, f.date, f.origin, f.destination, f.lifecycle_state, f.arrival_transit, f.arrival_transit_leg_id,
            f.departure_utc, f.arrival_utc, o.country_code AS origin_country, o.city AS origin_city,
            d.country_code AS destination_country, d.city AS destination_city
     FROM flights f
     LEFT JOIN airports_reference o ON o.iata = f.origin
     LEFT JOIN airports_reference d ON d.iata = f.destination
     WHERE f.user_id = ?`,
    )
    .bind(userId)
}

/** One read for the repair's combined batch: flights, claims, ground visits and legacy evidence. */
export function countryEvidenceRead<L>(
  db: D1Database,
  userId: string,
  legacy: D1PreparedStatement,
  merge: MergeVisits<L>,
): BatchedRead<CountryEvidence> {
  return {
    statements: [
      evidenceFlightsStatement(db, userId),
      db.prepare('SELECT DISTINCT country_code FROM country_claims WHERE user_id = ?').bind(userId),
      db
        .prepare(
          'SELECT country_code, COUNT(*) AS n FROM ground_visits WHERE user_id = ? GROUP BY country_code',
        )
        .bind(userId),
      legacy,
    ],
    derive: ([flights, claims, ground, legacyRows]) =>
      deriveCountryEvidence(
        {
          flights: rowsOf<EvidenceFlight>(flights),
          claims: rowsOf<{ country_code: string }>(claims).map((claim) => claim.country_code),
          ground: rowsOf<{ country_code: string; n: number }>(ground),
          legacy: rowsOf<L>(legacyRows),
        },
        merge,
      ),
  }
}

/** Publish the full computed set: delete rows outside it, upsert only changed rows (the `visits` pattern). */
export function countryEvidenceStatements(
  db: D1Database,
  userId: string,
  evidence: CountryEvidence,
): D1PreparedStatement[] {
  const rows = JSON.stringify(evidence.rows)
  const suppressions = JSON.stringify(
    evidence.suppressions.map((row) => ({ ...row, key: `${row.flight_id}:${row.endpoint}` })),
  )
  return [
    db
      .prepare(
        `DELETE FROM country_visit_evidence WHERE user_id = ? AND country_code NOT IN
         (SELECT json_extract(value, '$.country_code') FROM json_each(?))`,
      )
      .bind(userId, rows),
    db
      .prepare(
        `INSERT INTO country_visit_evidence
         (user_id, country_code, status, logged_visit_count, awaiting_visit_count, claimed, ground_visit_count,
          first_visit, last_visit, policy_version)
       SELECT ?, json_extract(value, '$.country_code'), json_extract(value, '$.status'),
              json_extract(value, '$.logged_visit_count'), json_extract(value, '$.awaiting_visit_count'),
              json_extract(value, '$.claimed'), json_extract(value, '$.ground_visit_count'),
              json_extract(value, '$.first_visit'), json_extract(value, '$.last_visit'), json_extract(value, '$.policy_version')
       FROM json_each(?) WHERE true
       ON CONFLICT(user_id, country_code) DO UPDATE SET
         status = excluded.status, logged_visit_count = excluded.logged_visit_count,
         awaiting_visit_count = excluded.awaiting_visit_count, claimed = excluded.claimed,
         ground_visit_count = excluded.ground_visit_count, first_visit = excluded.first_visit,
         last_visit = excluded.last_visit, policy_version = excluded.policy_version
       WHERE country_visit_evidence.status IS NOT excluded.status
         OR country_visit_evidence.logged_visit_count IS NOT excluded.logged_visit_count
         OR country_visit_evidence.awaiting_visit_count IS NOT excluded.awaiting_visit_count
         OR country_visit_evidence.claimed IS NOT excluded.claimed
         OR country_visit_evidence.ground_visit_count IS NOT excluded.ground_visit_count
         OR country_visit_evidence.first_visit IS NOT excluded.first_visit
         OR country_visit_evidence.last_visit IS NOT excluded.last_visit
         OR country_visit_evidence.policy_version IS NOT excluded.policy_version`,
      )
      .bind(userId, rows),
    db
      .prepare(
        `DELETE FROM country_evidence_suppressions WHERE user_id = ? AND (flight_id || ':' || endpoint) NOT IN
         (SELECT json_extract(value, '$.key') FROM json_each(?))`,
      )
      .bind(userId, suppressions),
    db
      .prepare(
        `INSERT INTO country_evidence_suppressions (user_id, flight_id, endpoint, country_code)
       SELECT ?, json_extract(value, '$.flight_id'), json_extract(value, '$.endpoint'), json_extract(value, '$.country_code')
       FROM json_each(?) WHERE true
       ON CONFLICT(user_id, flight_id, endpoint) DO UPDATE SET country_code = excluded.country_code
       WHERE country_evidence_suppressions.country_code IS NOT excluded.country_code`,
      )
      .bind(userId, suppressions),
  ]
}
