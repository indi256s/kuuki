import { assertRows } from '../_lib/d1'
import { buildFlightWhere, orderByClause, type FlightFilters, type SortConfig } from '../_lib/flightQuery'
import { FLIGHT_COLUMNS, toOwnFlight, type FlightRow } from '../_lib/flights'
import { isDerivedReady } from './derivedState'

export { FLIGHT_COLUMNS }

export type JournalData = {
  flights: ReturnType<typeof toOwnFlight>[]
  total: number
  updatedAt: number
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
}

type StateRow = { revision: number; published_revision: number; evidence_revision: number; last_error: string | null }

/** One owner-scoped batch supplies the page, count, and revision metadata. */
export async function readJournal(db: D1Database, userId: string, filters: FlightFilters, sort: SortConfig, limit: number, offset: number): Promise<JournalData> {
  const { where, binds } = buildFlightWhere(userId, filters)
  const statements = [
    db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE ${where} ${orderByClause(sort)} LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    db.prepare(`SELECT COUNT(*) AS total FROM flights WHERE ${where}`).bind(...binds),
    db.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Journal read failed', statements.length)
  const state = results[2].results[0] as StateRow | undefined
  return {
    flights: (results[0].results as FlightRow[]).map(toOwnFlight),
    total: (results[1].results[0] as { total: number } | undefined)?.total ?? 0,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
    derivedState: !state || isDerivedReady(state) ? 'ready' : state.last_error ? 'error' : 'pending',
  }
}
