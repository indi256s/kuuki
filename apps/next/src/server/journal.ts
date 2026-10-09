import { JOURNAL_PAGE_SIZE } from '@kuuki/shared/constants'
import 'server-only'
import { normalizeJournalQuery } from '../lib/url-state'
import { parseFlightFilters, parseSort } from '../../../../functions/api/_lib/flightQuery'
import { readJournal, readJournalAll, type JournalData } from '../../../../functions/api/_services/journal'
import type { JournalPayload } from '../../../../functions/api/_services/journalPayload'
import { getRequestEnv, getRequestIdentity } from './identity'

export type { JournalData } from '../../../../functions/api/_services/journal'

export const journalPageSize = JOURNAL_PAGE_SIZE

export function journalParams(input: Record<string, string | string[] | undefined>) {
  const normalized = normalizeJournalQuery(input)
  const params = new URLSearchParams(normalized.query)
  const filters = parseFlightFilters(params)
  return { params, page: Number(params.get('page') ?? 1), search: filters.q ?? '', filters, sort: parseSort(params), canonical: normalized.canonical }
}

export async function getOwnJournal(input: Record<string, string | string[] | undefined>) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const normalized = journalParams(input)
  const data: JournalData = await readJournal(env.DB, identity.id, normalized.filters, normalized.sort, journalPageSize, (normalized.page - 1) * journalPageSize)
  return { ownerId: identity.id, data, normalized }
}

/** The owner's whole journal (spec D3/D4): no filters or paging, the client filters in memory. */
export async function getOwnJournalAll() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data: JournalPayload = await readJournalAll(env.DB, identity.id)
  return { ownerId: identity.id, data }
}
