import 'server-only'
import { normalizeJournalQuery } from '../lib/url-state'
import { buildFlightWhere, orderByClause, parseFlightFilters, parseSort } from '../../../../functions/api/_lib/flightQuery'
import { toOwnFlight, type FlightRow } from '../../../../functions/api/_lib/flights'
import { getRequestEnv, getRequestIdentity } from './identity'
import { assertRows } from '../../../../functions/api/_lib/d1'
import { FLIGHT_COLUMNS } from '../../../../functions/api/flights/index'
import { isDerivedReady } from '../../../../functions/api/_services/derivedState'

export const journalPageSize = 20

export function journalParams(input: Record<string, string | string[] | undefined>) {
  const normalized = normalizeJournalQuery(input)
  const params = new URLSearchParams(normalized.query)
  const filters = parseFlightFilters(params)
  return { params, page: Number(params.get('page') ?? 1), search: filters.q ?? '', filters, sort: parseSort(params), canonical: normalized.canonical }
}

export type JournalData = { flights: ReturnType<typeof toOwnFlight>[]; total: number; updatedAt: number; revision: number; publishedRevision: number; derivedState: 'ready' | 'pending' | 'error' }

export async function getOwnJournal(input: Record<string, string | string[] | undefined>) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const normalized = journalParams(input)
  const { where, binds } = buildFlightWhere(identity.id, normalized.filters)
  const statements = [
    env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE ${where} ${orderByClause(normalized.sort)} LIMIT ? OFFSET ?`).bind(...binds, journalPageSize, (normalized.page - 1) * journalPageSize),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM flights WHERE ${where}`).bind(...binds),
    env.DB.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(identity.id),
  ]
  const results = await env.DB.batch(statements)
  assertRows(results, 'Journal read failed', statements.length)
  const state = results[2].results[0] as { revision: number; published_revision: number; evidence_revision: number; last_error: string | null } | undefined
  const data: JournalData = {
    flights: (results[0].results as FlightRow[]).map(toOwnFlight),
    total: (results[1].results[0] as { total: number } | undefined)?.total ?? 0,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
    derivedState: !state || isDerivedReady(state) ? 'ready' : state.last_error ? 'error' : 'pending',
  }
  return { ownerId: identity.id, data, normalized }
}
