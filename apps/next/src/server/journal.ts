import 'server-only'
import { parseFlightFilters, parseSort } from '../../../../functions/api/_lib/flightQuery'
import { readJournal, type JournalData } from '../../../../functions/api/_services/journal'
import { getRequestEnv, getRequestIdentity } from './identity'

export type { JournalData } from '../../../../functions/api/_services/journal'

export const journalPageSize = 20

export function journalParams(input: Record<string, string | string[] | undefined>) {
  const raw = new URLSearchParams()
  for (const key of ['year', 'airlineIata', 'aircraftIcao', 'isUpcoming', 'origin', 'destination', 'originCodes', 'destinationCodes', 'airlineIataCodes', 'sortField', 'sortOrder']) {
    const value = input[key]
    if (typeof value === 'string') raw.set(key, value)
  }
  const search = typeof input.q === 'string' ? input.q.trim().slice(0, 100) : ''
  if (search) raw.set('q', search)
  const filters = parseFlightFilters(raw)
  const sort = parseSort(raw)
  const page = typeof input.page === 'string' && /^[1-9]\d{0,5}$/.test(input.page) ? Number(input.page) : 1
  const params = new URLSearchParams()
  if (filters.year) params.set('year', String(filters.year))
  if (filters.airlineIata) params.set('airlineIata', filters.airlineIata)
  if (filters.aircraftIcao) params.set('aircraftIcao', filters.aircraftIcao)
  if (filters.isUpcoming !== undefined) params.set('isUpcoming', String(filters.isUpcoming))
  if (filters.origin) params.set('origin', filters.origin)
  if (filters.destination) params.set('destination', filters.destination)
  if (filters.originCodes?.length) params.set('originCodes', filters.originCodes.join(','))
  if (filters.destinationCodes?.length) params.set('destinationCodes', filters.destinationCodes.join(','))
  if (filters.airlineIataCodes?.length) params.set('airlineIataCodes', filters.airlineIataCodes.join(','))
  if (search) params.set('q', search)
  params.set('sortField', sort.field)
  params.set('sortOrder', sort.order)
  if (page > 1) params.set('page', String(page))
  return { params, page, search, filters, sort }
}

export async function getOwnJournal(input: Record<string, string | string[] | undefined>) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const normalized = journalParams(input)
  const data: JournalData = await readJournal(env.DB, identity.id, normalized.filters, normalized.sort, journalPageSize, (normalized.page - 1) * journalPageSize)
  return { ownerId: identity.id, data, normalized }
}
