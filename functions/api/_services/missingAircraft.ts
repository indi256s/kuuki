// The Overview's missing-aircraft review set (ADR 0001 open item 8): the flights `dataAvailability.missingAircraft`
// counts, read a page at a time. It shares `completedScope` with the summary, so the owner, the completed lifecycle and
// the period are one predicate; the page only adds the null-aircraft test and a keyset position.
import { MISSING_AIRCRAFT_PAGE, type MissingAircraftFlight, type MissingAircraftPage, type OverviewPeriod } from '../../../packages/shared/src/overview'
import { assertRows } from '../_lib/d1'
import { completedScope } from './periodScope'

/** Dates are stored as YYYY-MM-DD, so (date, id) is a total order and the cursor needs nothing else. */
const CURSOR = /^(\d{4}-\d{2}-\d{2}):(\d{1,15})$/

export const encodeCursor = (flight: Pick<MissingAircraftFlight, 'date' | 'id'>) => `${flight.date}:${flight.id}`
export const isCursor = (value: string) => CURSOR.test(value)

/** One newest-first page after `after` (a previous `nextCursor`), plus the exact total of the whole set, in one batch. */
export async function readMissingAircraft(db: D1Database, userId: string, period: OverviewPeriod, after: string | null = null,
  limit: number = MISSING_AIRCRAFT_PAGE): Promise<MissingAircraftPage> {
  const size = Math.min(Math.max(Math.trunc(limit), 1), MISSING_AIRCRAFT_PAGE)
  const scope = completedScope(userId, {}, period === 'all' ? undefined : Number(period))
  const where = `${scope.where} AND f.aircraft_icao IS NULL`
  const position = after ? CURSOR.exec(after) : null
  if (after && !position) throw new Error('Invalid cursor')
  const statements = [
    db.prepare(`SELECT COUNT(*) AS total FROM flights f WHERE ${where}`).bind(...scope.binds),
    db.prepare(`SELECT f.id, f.flight_number, f.airline_iata, f.date, f.origin, f.destination FROM flights f WHERE ${where}
      ${position ? 'AND (f.date < ? OR (f.date = ? AND f.id < ?))' : ''} ORDER BY f.date DESC, f.id DESC LIMIT ?`)
      .bind(...scope.binds, ...(position ? [position[1], position[1], Number(position[2])] : []), size + 1),
  ]
  // How many flights of the set precede this page (newer, or the cursor row itself), so "n-m of total" stays exact.
  if (position) {
    statements.push(db.prepare(`SELECT COUNT(*) AS offset FROM flights f WHERE ${where} AND NOT (f.date < ? OR (f.date = ? AND f.id < ?))`)
      .bind(...scope.binds, position[1], position[1], Number(position[2])))
  }
  const results = await db.batch(statements)
  assertRows(results, 'Missing-aircraft batch failed', statements.length)
  const rows = results[1].results as unknown as MissingAircraftFlight[]
  const flights = rows.slice(0, size)
  return {
    period,
    total: (results[0].results[0] as { total: number } | undefined)?.total ?? 0,
    limit: size,
    offset: position ? (results[2].results[0] as { offset: number } | undefined)?.offset ?? 0 : 0,
    flights,
    nextCursor: rows.length > size ? encodeCursor(flights[flights.length - 1]) : null,
  }
}
