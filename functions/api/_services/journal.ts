import { assertRows } from '../_lib/d1'
import { buildFlightWhere, orderByClause, type FlightFilters, type SortConfig } from '../_lib/flightQuery'
import { toOwnFlight, type FlightRow } from '../_lib/flights'

// Explicit FlightRow column allowlist shared with the flight write endpoints.
export const FLIGHT_COLUMNS =
  'id, user_id, date, origin, destination, airline_iata, aircraft_icao, flight_number, ' +
  'departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz, distance_km, ' +
  'duration_minutes, source, is_upcoming, enrichment_status, aircraft_lookup_attempts, created_at'

export type JournalData = {
  flights: ReturnType<typeof toOwnFlight>[]
  total: number
  updatedAt: number
  revision: number
  publishedRevision: number
}

/** One owner-scoped batch supplies the page, count, and revision metadata. */
export async function readJournal(db: D1Database, userId: string, filters: FlightFilters, sort: SortConfig, limit: number, offset: number): Promise<JournalData> {
  const { where, binds } = buildFlightWhere(userId, filters)
  const statements = [
    db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE ${where} ${orderByClause(sort)} LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    db.prepare(`SELECT COUNT(*) AS total FROM flights WHERE ${where}`).bind(...binds),
    db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Journal read failed', statements.length)
  const state = results[2].results[0] as { revision: number; published_revision: number } | undefined
  return {
    flights: (results[0].results as FlightRow[]).map(toOwnFlight),
    total: (results[1].results[0] as { total: number } | undefined)?.total ?? 0,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
  }
}
