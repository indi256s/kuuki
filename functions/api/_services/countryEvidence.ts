// Country evidence projection (ADR 0001 §4): `country_visit_evidence` and the published
// `country_evidence_suppressions`, computed from canonical rows inside the guarded repair batch.
//
// T07 scope: the effective arrival policy applies only explicit decisions (rule 1). Prospective
// defaults from connection chains (rule 2) are T08 and plug into `arrivalSuppressions`.
import { rowsOf, type BatchedRead, type DerivedVisit } from './stats'

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

export interface CountryEvidence {
  rows: CountryEvidenceRow[]
  suppressions: CountrySuppression[]
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

const isCountry = (code: string | null | undefined): code is string => typeof code === 'string' && code.length === 2

/**
 * Endpoints whose country is suppressed by the effective arrival policy. Rule 1 (explicit decision):
 * a completed flight F with `arrival_transit = 1` suppresses its destination, plus the stored
 * outgoing leg's origin while that leg still departs from F's destination airport. Airport
 * evidence is never suppressed.
 */
export function arrivalSuppressions(flights: EvidenceFlight[]): CountrySuppression[] {
  const byId = new Map(flights.map(flight => [flight.id, flight]))
  const out: CountrySuppression[] = []
  for (const flight of flights) {
    if (flight.lifecycle_state === 'upcoming' || flight.arrival_transit !== 1) continue
    if (isCountry(flight.destination_country)) {
      out.push({ flight_id: flight.id, endpoint: 'destination', country_code: flight.destination_country })
    }
    const leg = flight.arrival_transit_leg_id == null ? undefined : byId.get(flight.arrival_transit_leg_id)
    if (leg && leg.origin === flight.destination && isCountry(leg.origin_country)) {
      out.push({ flight_id: leg.id, endpoint: 'origin', country_code: leg.origin_country })
    }
  }
  return out.sort((a, b) => a.flight_id - b.flight_id || a.endpoint.localeCompare(b.endpoint))
}

/** Pure projection from canonical rows; the migration seed equals it while nothing is awaiting or suppressed. */
export function deriveCountryEvidence<L>(
  input: { flights: EvidenceFlight[]; legacy: L[]; claims: string[]; ground: Array<{ country_code: string; n: number }> },
  merge: MergeVisits<L>,
): CountryEvidence {
  const suppressions = arrivalSuppressions(input.flights)
  const suppressed = new Set(suppressions.map(row => `${row.flight_id}:${row.endpoint}`))
  const logged: EndpointSource[] = []
  const awaiting: EndpointSource[] = []
  for (const flight of input.flights) {
    if (flight.lifecycle_state === 'upcoming') continue
    const target = flight.lifecycle_state === 'logged' ? logged : awaiting
    for (const endpoint of ['origin', 'destination'] as const) {
      const country = endpoint === 'origin' ? flight.origin_country : flight.destination_country
      // Unknown airports have no reference row and contribute nothing, as in `visits`.
      if (country === null || suppressed.has(`${flight.id}:${endpoint}`)) continue
      target.push({ airport_iata: flight[endpoint], country_code: country,
        city: endpoint === 'origin' ? flight.origin_city : flight.destination_city, date: flight.date })
    }
  }

  const byCountry = new Map<string, CountryEvidenceRow>()
  const row = (code: string) => {
    let current = byCountry.get(code)
    if (!current) {
      current = { country_code: code, status: 'pending', logged_visit_count: 0, awaiting_visit_count: 0, claimed: 0,
        ground_visit_count: 0, first_visit: null, last_visit: null, policy_version: COUNTRY_POLICY_VERSION }
      byCountry.set(code, current)
    }
    return current
  }
  const addVisits = (visits: DerivedVisit[], field: 'logged_visit_count' | 'awaiting_visit_count') => {
    for (const visit of visits) {
      if (!isCountry(visit.country_code)) continue
      const current = row(visit.country_code)
      current[field] += visit.visit_count
      if (current.first_visit === null || visit.first_visit < current.first_visit) current.first_visit = visit.first_visit
      if (current.last_visit === null || visit.last_visit > current.last_visit) current.last_visit = visit.last_visit
    }
  }
  addVisits(merge(logged, input.legacy), 'logged_visit_count')
  addVisits(merge(awaiting, []), 'awaiting_visit_count')
  for (const code of input.claims) if (isCountry(code)) row(code).claimed = 1
  for (const ground of input.ground) if (isCountry(ground.country_code)) row(ground.country_code).ground_visit_count += ground.n

  const rows = [...byCountry.values()]
    .filter(current => current.logged_visit_count > 0 || current.awaiting_visit_count > 0 || current.claimed === 1 || current.ground_visit_count > 0)
    .map(current => ({ ...current,
      status: (current.logged_visit_count > 0 || current.claimed === 1 || current.ground_visit_count > 0 ? 'pressed' : 'pending') as CountryEvidenceRow['status'] }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code))
  return { rows, suppressions }
}

/** One read for the repair's combined batch: flights (all states, as potential legs), claims, ground visits and legacy evidence. */
export function countryEvidenceRead<L>(db: D1Database, userId: string, legacy: D1PreparedStatement, merge: MergeVisits<L>): BatchedRead<CountryEvidence> {
  return {
    statements: [
      db.prepare(
        `SELECT f.id, f.date, f.origin, f.destination, f.lifecycle_state, f.arrival_transit, f.arrival_transit_leg_id,
                f.departure_utc, f.arrival_utc, o.country_code AS origin_country, o.city AS origin_city,
                d.country_code AS destination_country, d.city AS destination_city
         FROM flights f
         LEFT JOIN airports_reference o ON o.iata = f.origin
         LEFT JOIN airports_reference d ON d.iata = f.destination
         WHERE f.user_id = ?`,
      ).bind(userId),
      db.prepare('SELECT DISTINCT country_code FROM country_claims WHERE user_id = ?').bind(userId),
      db.prepare('SELECT country_code, COUNT(*) AS n FROM ground_visits WHERE user_id = ? GROUP BY country_code').bind(userId),
      legacy,
    ],
    derive: ([flights, claims, ground, legacyRows]) => deriveCountryEvidence({
      flights: rowsOf<EvidenceFlight>(flights),
      claims: rowsOf<{ country_code: string }>(claims).map(claim => claim.country_code),
      ground: rowsOf<{ country_code: string; n: number }>(ground),
      legacy: rowsOf<L>(legacyRows),
    }, merge),
  }
}

/** Publish the full computed set: delete rows outside it, upsert only changed rows (the `visits` pattern). */
export function countryEvidenceStatements(db: D1Database, userId: string, evidence: CountryEvidence): D1PreparedStatement[] {
  const rows = JSON.stringify(evidence.rows)
  const suppressions = JSON.stringify(evidence.suppressions.map(row => ({ ...row, key: `${row.flight_id}:${row.endpoint}` })))
  return [
    db.prepare(
      `DELETE FROM country_visit_evidence WHERE user_id = ? AND country_code NOT IN
         (SELECT json_extract(value, '$.country_code') FROM json_each(?))`,
    ).bind(userId, rows),
    db.prepare(
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
    ).bind(userId, rows),
    db.prepare(
      `DELETE FROM country_evidence_suppressions WHERE user_id = ? AND (flight_id || ':' || endpoint) NOT IN
         (SELECT json_extract(value, '$.key') FROM json_each(?))`,
    ).bind(userId, suppressions),
    db.prepare(
      `INSERT INTO country_evidence_suppressions (user_id, flight_id, endpoint, country_code)
       SELECT ?, json_extract(value, '$.flight_id'), json_extract(value, '$.endpoint'), json_extract(value, '$.country_code')
       FROM json_each(?) WHERE true
       ON CONFLICT(user_id, flight_id, endpoint) DO UPDATE SET country_code = excluded.country_code
       WHERE country_evidence_suppressions.country_code IS NOT excluded.country_code`,
    ).bind(userId, suppressions),
  ]
}
