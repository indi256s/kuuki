// Shared fixture for the T08 country-evidence tests: a user, a few airports and directly inserted lifecycle rows.
import { createApiDatabase } from './harness'
import { dirtyUserStatement, repairUserDerivedState } from '../api/_services/derivedState'

export const USER = { id: 'u1', email: 'u1@example.test' }

export const AIRPORTS: Array<[string, string]> = [
  ['TBS', 'GE'], ['KUT', 'GE'], ['IST', 'TR'], ['ADB', 'TR'], ['JFK', 'US'], ['LHR', 'GB'], ['DXB', 'AE'], ['BKK', 'TH'],
]

export interface FixtureFlight {
  id: number
  date: string
  origin: string
  destination: string
  state: 'upcoming' | 'awaiting' | 'logged'
  source?: 'save' | 'legacy' | 'user' | 'automatic'
  dep?: string | null
  arr?: string | null
  transit?: 0 | 1 | null
  leg?: number | null
  /** Stored deadlines and zone of an upcoming or awaiting flight (defaults: long past). */
  awaitingAfter?: string
  autoAfter?: string
  tz?: string
  user?: string
}

export function flightStatement(db: D1Database, flight: FixtureFlight) {
  const upcomingOrAwaiting = flight.state !== 'logged'
  const source = flight.state === 'logged' ? (flight.source ?? 'save') : null
  return db.prepare(
    `INSERT INTO flights (id, user_id, date, origin, destination, departure_utc, arrival_utc, is_upcoming, enrichment_status,
       lifecycle_state, confirmation_source, confirmed_at, lifecycle_timezone, awaiting_after, auto_confirm_after,
       arrival_transit, arrival_transit_leg_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skipped', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(flight.id, flight.user ?? USER.id, flight.date, flight.origin, flight.destination, flight.dep ?? null, flight.arr ?? null,
    flight.state === 'upcoming' ? 1 : 0, flight.state, source,
    flight.state === 'logged' && source !== 'legacy' ? '2026-01-01T00:00:00.000Z' : null,
    upcomingOrAwaiting ? (flight.tz ?? 'UTC') : null, upcomingOrAwaiting ? (flight.awaitingAfter ?? '2026-01-01T00:00:00.000Z') : null,
    upcomingOrAwaiting ? (flight.autoAfter ?? '2026-02-01T00:00:00.000Z') : null, flight.transit ?? null, flight.leg ?? null)
}

export async function accountWith(flights: FixtureFlight[], extra: (db: D1Database) => D1PreparedStatement[] = () => []) {
  const { db, dispose } = await createApiDatabase()
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER.id, USER.email, 'hash'),
    db.prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')").bind(USER.id),
    ...AIRPORTS.map(([iata, cc]) => db.prepare(
      'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?,?,?,?,?,?,?)')
      .bind(iata, iata, `${iata} city`, cc, cc, 40, 40)),
    ...flights.map(flight => flightStatement(db, flight)),
    ...extra(db),
  ])
  await publish(db)
  return { db, dispose }
}

/** What every canonical mutation does (dirty mark), then the repair publishes. */
export async function publish(db: D1Database) {
  await dirtyUserStatement(db, USER.id).run()
  return repairUserDerivedState(db, USER.id)
}

export const evidence = (db: D1Database) => db.prepare(
  `SELECT country_code, status, logged_visit_count AS logged, awaiting_visit_count AS awaiting, claimed, ground_visit_count AS ground
   FROM country_visit_evidence WHERE user_id = ? ORDER BY country_code`).bind(USER.id).all().then(result => result.results)
export const evidenceCountries = (db: D1Database) => evidence(db).then(rows => rows.map(row => row.country_code as string))
export const suppressions = (db: D1Database) => db.prepare(
  'SELECT flight_id, endpoint, country_code FROM country_evidence_suppressions WHERE user_id = ? ORDER BY flight_id, endpoint')
  .bind(USER.id).all().then(result => result.results)
export const userStats = (db: D1Database) => db.prepare(
  'SELECT airports_count, countries_count, continents_count FROM user_stats WHERE user_id = ?').bind(USER.id).first()
export const visitAirports = (db: D1Database) => db.prepare('SELECT airport_iata, visit_count FROM visits WHERE user_id = ? ORDER BY airport_iata')
  .bind(USER.id).all().then(result => result.results)

export const at = (base: string, hours: number) => new Date(Date.parse(base) + hours * 3_600_000).toISOString()
export const T0 = '2026-03-01T22:00:00.000Z'
