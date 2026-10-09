// Passport reads (ADR 0001 §4). The list reads only the published country evidence; the detail adds the
// contributing flights and legacy sources from the same pure policy (`countryContributions`), so Passport,
// Overview and `user_stats` cannot disagree about which countries a flight supports.
import { assertRows } from '../_lib/d1'
import { toGroundVisit, type GroundVisitRow } from '../_lib/passportDtos'
import { REGION_POLICY, catalogRegionOf, regionProgress, type RegionId } from '../_lib/regions'
import {
  countryContributions,
  evidenceFlightsStatement,
  flightCountriesOf,
  type CountryEvidenceRow,
  type EvidenceFlight,
} from './countryEvidence'
import { isDerivedReady } from './derivedState'

type StateRow = {
  revision: number
  published_revision: number
  evidence_revision: number
  last_error: string | null
}

export type PassportDerivedState = 'ready' | 'pending' | 'error'

function derivedStateOf(state: StateRow | undefined) {
  const revision = state?.revision ?? 0
  const publishedRevision = state?.published_revision ?? 0
  const ready = isDerivedReady({
    revision,
    published_revision: publishedRevision,
    evidence_revision: state?.evidence_revision ?? publishedRevision,
  })
  const derivedState: PassportDerivedState = ready
    ? 'ready'
    : state?.last_error
      ? 'error'
      : 'pending'
  return { derivedState, revision, publishedRevision }
}

export interface PassportCountry extends Omit<CountryEvidenceRow, 'policy_version'> {
  region: RegionId | null
}

export type Visit = {
  country_code: string
  first_visit: string
  last_visit: string
  visit_count: number
  airport_iata: string | null
  city: string | null
}
export type Claim = { country_code: string; claimed_at: string }
export type GroundVisit = {
  country_code: string
  visit_year: number | null
  entry_method: string | null
}

/**
 * The passport collection. `pressedCountryCount` counts pressed countries including claims and ground visits;
 * `pendingCountryCount` counts awaiting-only countries, which stay unpressed; `flightCountryCount` is the
 * `user_stats.countries_count` meaning (flights and legacy evidence, no claims or ground visits), which is
 * what the leaderboard `countries` category ranks. One owner-scoped batch supplies every collection and the
 * revision metadata, shared by `GET /api/passport/countries` and the Next server read.
 */
export function passportRead(db: D1Database, userId: string) {
  const statements = [
    db
      .prepare(
        'SELECT country_code, first_visit, last_visit, visit_count, airport_iata, city FROM visits WHERE user_id = ?',
      )
      .bind(userId),
    db
      .prepare('SELECT country_code, claimed_at FROM country_claims WHERE user_id = ?')
      .bind(userId),
    db
      .prepare('SELECT country_code, visit_year, entry_method FROM ground_visits WHERE user_id = ?')
      .bind(userId),
    db
      .prepare(
        `SELECT country_code, status, logged_visit_count, awaiting_visit_count, claimed, ground_visit_count, first_visit, last_visit
       FROM country_visit_evidence WHERE user_id = ? ORDER BY country_code`,
      )
      .bind(userId),
    db
      .prepare(
        'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
      )
      .bind(userId),
  ]
  return {
    statements,
    derive(results: D1Result[]) {
      assertRows(results, 'Passport read failed', statements.length)
      const rows = results[3].results as Array<Omit<CountryEvidenceRow, 'policy_version'>>
      const countries: PassportCountry[] = rows.map((row) => ({
        ...row,
        region: catalogRegionOf(row.country_code),
      }))
      const pressed = countries
        .filter((row) => row.status === 'pressed')
        .map((row) => row.country_code)
      const pending = countries
        .filter((row) => row.status === 'pending')
        .map((row) => row.country_code)
      const state = results[4].results[0] as StateRow | undefined
      return {
        state,
        data: {
          visits: results[0].results as Visit[],
          claims: results[1].results as Claim[],
          groundVisits: results[2].results as GroundVisit[],
          countries,
          pressedCountryCount: pressed.length,
          pendingCountryCount: pending.length,
          flightCountryCount: flightCountriesOf(rows as CountryEvidenceRow[]).length,
          regionPolicyVersion: REGION_POLICY.version,
          regions: regionProgress(pressed, pending),
          updatedAt: Date.now(),
          ...derivedStateOf(state),
        },
      }
    },
  }
}

export async function readPassport(db: D1Database, userId: string) {
  const read = passportRead(db, userId)
  return read.derive(await db.batch(read.statements)).data
}

export type PassportData = Awaited<ReturnType<typeof readPassport>>

type LegacyRow = {
  airport_iata: string | null
  country_code: string | null
  city: string | null
  first_visit: string
  last_visit: string
  visit_count: number
  provenance: string
  reference_country_code: string | null
  reference_city: string | null
}
type DetailEntry =
  | {
      kind: 'flight'
      flightId: number
      endpoint: 'origin' | 'destination'
      airport: string
      date: string
      state: 'awaiting' | 'logged'
    }
  | {
      kind: 'legacy'
      airport: string
      visitCount: number
      firstVisit: string
      lastVisit: string
      provenance: string
      explanation: 'archived_counter'
      flightCount: number
    }
  | { kind: 'claim'; claimedAt: string | null }
  | { kind: 'ground'; id: string; visitYear: number | null; entryMethod: string | null }

/** One country: status from the published row, and every contributing entry from the shared policy. */
export async function readCountryDetail(db: D1Database, userId: string, countryCode: string) {
  const statements = [
    evidenceFlightsStatement(db, userId),
    db
      .prepare(
        `SELECT e.airport_iata, e.country_code, e.city, e.first_visit, e.last_visit, e.visit_count, e.provenance,
              ar.country_code AS reference_country_code, ar.city AS reference_city
       FROM legacy_visit_evidence e LEFT JOIN airports_reference ar ON ar.iata = e.airport_iata
       WHERE e.user_id = ? AND e.contributes = 1`,
      )
      .bind(userId),
    db
      .prepare(
        'SELECT claimed_at FROM country_claims WHERE user_id = ? AND country_code = ? LIMIT 1',
      )
      .bind(userId, countryCode),
    db
      .prepare(
        `SELECT id, user_id, country_code, visit_year, note, entry_method, created_at FROM ground_visits
       WHERE user_id = ? AND country_code = ? ORDER BY created_at DESC`,
      )
      .bind(userId, countryCode),
    db
      .prepare(
        `SELECT status, logged_visit_count, awaiting_visit_count, ground_visit_count, first_visit, last_visit
       FROM country_visit_evidence WHERE user_id = ? AND country_code = ?`,
      )
      .bind(userId, countryCode),
    db
      .prepare(
        'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
      )
      .bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Passport country read failed', statements.length)
  const flights = results[0].results as unknown as EvidenceFlight[]
  const claim = results[2].results[0] as { claimed_at: string | null } | undefined
  const groundVisits = (results[3].results as unknown as GroundVisitRow[]).map(toGroundVisit)
  const published = results[4].results[0] as
    | {
        status: 'pressed' | 'pending'
        logged_visit_count: number
        awaiting_visit_count: number
        ground_visit_count: number
        first_visit: string | null
        last_visit: string | null
      }
    | undefined

  const policy = countryContributions(flights)
  const contributing = policy.contributions.filter((row) => row.country_code === countryCode)
  const entries: DetailEntry[] = contributing
    .map<DetailEntry>((row) => ({
      kind: 'flight',
      flightId: row.flight_id,
      endpoint: row.endpoint,
      airport: row.airport,
      date: row.date,
      state: row.state,
    }))
    .sort((a, b) =>
      a.kind === 'flight' && b.kind === 'flight'
        ? a.date.localeCompare(b.date) || a.flightId - b.flightId
        : 0,
    )

  // Per airport: flight endpoints, max-merged with an archived counter exactly as the visit aggregate does.
  const airports = new Map<string, { city: string; visitCount: number; flights: number }>()
  for (const row of contributing) {
    const current = airports.get(row.airport) ?? { city: row.city ?? '', visitCount: 0, flights: 0 }
    current.visitCount += 1
    current.flights += 1
    airports.set(row.airport, current)
  }
  for (const legacy of results[1].results as unknown as LegacyRow[]) {
    if (
      !legacy.airport_iata ||
      (legacy.country_code ?? legacy.reference_country_code) !== countryCode
    )
      continue
    const current = airports.get(legacy.airport_iata) ?? {
      city: legacy.city ?? legacy.reference_city ?? '',
      visitCount: 0,
      flights: 0,
    }
    current.visitCount = Math.max(current.visitCount, legacy.visit_count)
    airports.set(legacy.airport_iata, current)
    entries.push({
      kind: 'legacy',
      airport: legacy.airport_iata,
      visitCount: legacy.visit_count,
      firstVisit: legacy.first_visit,
      lastVisit: legacy.last_visit,
      provenance: legacy.provenance,
      explanation: 'archived_counter',
      flightCount: current.flights,
    })
  }
  if (claim) entries.push({ kind: 'claim', claimedAt: claim.claimed_at })
  for (const ground of groundVisits)
    entries.push({
      kind: 'ground',
      id: ground.id,
      visitYear: ground.visitYear,
      entryMethod: ground.entryMethod,
    })

  const flightIds = [...new Set(contributing.map((row) => row.flight_id))].sort((a, b) => a - b)
  const suppressed = policy.suppressions
    .filter((row) => row.country_code === countryCode)
    .map((row) => {
      const flight = flights.find((candidate) => candidate.id === row.flight_id)
      return {
        flightId: row.flight_id,
        endpoint: row.endpoint,
        airport: flight ? flight[row.endpoint] : '',
      }
    })

  return {
    countryCode,
    countryName: '',
    status: published?.status ?? ('none' as const),
    region: catalogRegionOf(countryCode),
    firstVisit: published?.first_visit ?? '',
    lastVisit: published?.last_visit ?? '',
    totalVisits: published
      ? published.logged_visit_count + published.awaiting_visit_count + published.ground_visit_count
      : 0,
    airports: [...airports.entries()]
      .map(([iata, value]) => ({
        iata,
        name: iata,
        city: value.city,
        visitCount: value.visitCount,
      }))
      .sort((a, b) => b.visitCount - a.visitCount || a.iata.localeCompare(b.iata)),
    isClaimed: !!claim,
    groundVisits,
    flightIds,
    entries,
    suppressed,
    ...derivedStateOf(results[5].results[0] as StateRow | undefined),
  }
}
