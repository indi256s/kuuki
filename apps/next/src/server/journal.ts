import 'server-only'
import { buildFlightWhere, orderByClause, parseFlightFilters, parseSort } from '../../../../functions/api/_lib/flightQuery'
import { toOwnFlight, type FlightRow } from '../../../../functions/api/_lib/flights'
import { getRequestEnv, getRequestIdentity } from './identity'

const columns = 'id, user_id, date, origin, destination, airline_iata, aircraft_icao, flight_number, departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz, distance_km, duration_minutes, source, is_upcoming, enrichment_status, aircraft_lookup_attempts, created_at'
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

export type JournalData = { flights: ReturnType<typeof toOwnFlight>[]; total: number; updatedAt: number; revision: number; publishedRevision: number }

export async function getOwnJournal(input: Record<string, string | string[] | undefined>) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const normalized = journalParams(input)
  const { where, binds } = buildFlightWhere(identity.id, normalized.filters)
  const statements = [
    env.DB.prepare(`SELECT ${columns} FROM flights f WHERE ${where} ${orderByClause(normalized.sort)} LIMIT ? OFFSET ?`).bind(...binds, journalPageSize, (normalized.page - 1) * journalPageSize),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM flights f WHERE ${where}`).bind(...binds),
    env.DB.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(identity.id),
  ]
  const results = await env.DB.batch(statements)
  if (results.length !== statements.length || results.some(result => !result.success || !Array.isArray(result.results))) throw new Error('Journal read failed')
  const state = results[2].results[0] as { revision: number; published_revision: number } | undefined
  const data: JournalData = {
    flights: (results[0].results as FlightRow[]).map(toOwnFlight),
    total: (results[1].results[0] as { total: number } | undefined)?.total ?? 0,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
  }
  return { ownerId: identity.id, data, normalized }
}
