import { api, ApiError } from './apiClient'
import { FLIGHT_BULK_CREATE_MAX, validateFlightInput } from '@kuuki/shared'
import { completeFlightCreateOperation, getFlightCreateOperation } from './flightCreateOperations'
import type { DerivedAck } from './derivedStateFeedback'
import type { Tables, TablesInsert, TablesUpdate } from './database.types'

export type Flight = Tables<'flights'>
export type FlightInsert = TablesInsert<'flights'>
export type FlightUpdate = TablesUpdate<'flights'>

export interface FlightFilters {
  year?: number
  airlineIata?: string
  aircraftIcao?: string
  isUpcoming?: boolean
  origin?: string
  destination?: string
  // For fuzzy search - array of matching IATA codes
  originCodes?: string[]
  destinationCodes?: string[]
  // For alliance filter - array of airline IATA codes
  airlineIataCodes?: string[]
}

export type SortField = 'date' | 'origin' | 'destination' | 'airline_iata' | 'aircraft_icao' | 'distance_km' | 'duration_minutes'
export type SortOrder = 'asc' | 'desc'

export interface SortConfig {
  field: SortField
  order: SortOrder
}

export interface FlightStats {
  totalFlights: number
  totalDistance: number
  countriesVisited: number
  airlinesFlown: number
  uniqueAirports: number
  upcomingFlights: number
}

/**
 * Own-flight DTO as returned by the API (functions/api/_lib/flights.ts → toOwnFlight).
 * Mirrors Tables<'flights'> minus `user_id` (always the requester) and minus the D1-internal
 * `aircraft_lookup_attempts` counter (not present in the Supabase-generated types).
 */
interface ApiFlight extends DerivedAck {
  id: number
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  aircraft_icao: string | null
  flight_number: string | null
  departure_time: string | null
  arrival_time: string | null
  departure_utc: string | null
  arrival_utc: string | null
  origin_tz: string | null
  dest_tz: string | null
  distance_km: number | null
  duration_minutes: number | null
  source: string
  is_upcoming: boolean
  enrichment_status: string
  created_at: string
}

/**
 * Lift an ApiFlight DTO back into the Tables<'flights'> row type the frontend consumers expect.
 * The API omits `user_id`; we re-attach the caller-known id so the declared `Flight` return type
 * holds. (No consumer reads `user_id` off a returned flight — it is filled for type-shape parity.)
 */
function toFlight(dto: ApiFlight, userId: string): Flight {
  return { ...dto, user_id: userId }
}

/**
 * Build the query params for a flight list / ids request from FlightFilters + paging + sort.
 * Mirrors functions/api/_lib/flightQuery.ts (parseFlightFilters / parseSort / parsePagination):
 * scalar filters, CSV arrays for the *Codes filters, sortField/sortOrder, limit/offset.
 */
function filterParams(filters: FlightFilters = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (filters.year) params.year = filters.year
  if (filters.airlineIataCodes && filters.airlineIataCodes.length > 0) {
    params.airlineIataCodes = filters.airlineIataCodes.join(',')
  } else if (filters.airlineIata) {
    params.airlineIata = filters.airlineIata
  }
  if (filters.aircraftIcao) params.aircraftIcao = filters.aircraftIcao
  if (filters.isUpcoming !== undefined) params.isUpcoming = String(filters.isUpcoming)
  if (filters.originCodes && filters.originCodes.length > 0) {
    params.originCodes = filters.originCodes.map((c) => c.toUpperCase()).join(',')
  } else if (filters.origin) {
    params.origin = filters.origin.toUpperCase()
  }
  if (filters.destinationCodes && filters.destinationCodes.length > 0) {
    params.destinationCodes = filters.destinationCodes.map((c) => c.toUpperCase()).join(',')
  } else if (filters.destination) {
    params.destination = filters.destination.toUpperCase()
  }
  return params
}

/**
 * Fetch paginated flights for a user
 */
export async function getFlights(
  userId: string,
  options: {
    limit?: number
    offset?: number
    filters?: FlightFilters
    sort?: SortConfig
  } = {}
): Promise<{ flights: Flight[]; total: number }> {
  const { limit = 20, offset = 0, filters = {}, sort } = options

  const params: Record<string, string | number> = {
    ...filterParams(filters),
    limit,
    offset,
    sortField: sort?.field ?? 'date',
    sortOrder: sort?.order ?? 'desc',
  }

  const data = await api.get<{ flights: ApiFlight[]; total: number }>('/api/flights', params)
  return {
    flights: (data.flights ?? []).map((f) => toFlight(f, userId)),
    total: data.total ?? 0,
  }
}

/**
 * Get a single flight by ID
 */
export async function getFlight(flightId: number): Promise<Flight | null> {
  try {
    const dto = await api.get<ApiFlight>(`/api/flights/${flightId}`)
    return toFlight(dto, '')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/**
 * Create a new flight
 */
export async function createFlight(flight: Omit<FlightInsert, 'id' | 'created_at'>, operationId: string): Promise<Flight & DerivedAck> {
  // The API derives the owner from the session and recomputes is_upcoming / enrichment defaults
  // server-side, so user_id (and any client is_upcoming) are dropped from the request body.
  const { user_id, is_upcoming, ...body } = flight
  const input = validateFlightInput(body, 'create')
  const operation = getFlightCreateOperation(user_id, operationId, input)
  const dto = await api.post<ApiFlight>('/api/flights', operation.body, { headers: { 'Idempotency-Key': operation.key } })
  completeFlightCreateOperation(user_id, operationId, operation.key)
  return toFlight(dto, user_id)
}

interface BulkCreateResult {
  status: 'created' | 'replayed' | 'error'
  http_status?: number
  code?: string
  error?: string
}

/**
 * Create flights through /api/flights/bulk in server-sized chunks. Each flight keeps its own stored
 * operation key, so an uncertain chunk retries without duplicates. Returns one error (or null when
 * saved) per entry; onChunk receives each accepted chunk's derived-state ack and saved count.
 */
export async function createFlights(
  userId: string,
  entries: Array<{ operationId: string; flight: Omit<FlightInsert, 'id' | 'created_at' | 'user_id'> }>,
  onChunk?: (ack: DerivedAck, saved: number) => void,
): Promise<Array<Error | null>> {
  const outcomes: Array<Error | null> = entries.map(() => null)
  const ready: Array<{ index: number; operationId: string; key: string; body: object }> = []
  entries.forEach(({ operationId, flight }, index) => {
    try {
      const { is_upcoming: _upcoming, ...body } = flight
      ready.push({ index, operationId, ...getFlightCreateOperation(userId, operationId, validateFlightInput(body, 'create')) })
    } catch (error) {
      outcomes[index] = error instanceof Error ? error : new Error(String(error))
    }
  })
  for (let start = 0; start < ready.length; start += FLIGHT_BULK_CREATE_MAX) {
    const chunk = ready.slice(start, start + FLIGHT_BULK_CREATE_MAX)
    try {
      const response = await api.post<DerivedAck & { results: BulkCreateResult[] }>('/api/flights/bulk', {
        items: chunk.map(({ key, body }) => ({ key, flight: body })),
      })
      let saved = 0
      chunk.forEach((item, i) => {
        const result = response.results[i]
        if (result?.status === 'created' || result?.status === 'replayed') {
          completeFlightCreateOperation(userId, item.operationId, item.key)
          saved++
        } else {
          outcomes[item.index] = new ApiError(result?.http_status ?? 500, result?.error ?? 'Flight was not saved', result?.code)
        }
      })
      if (response.derived_state) onChunk?.(response, saved)
    } catch (error) {
      for (const item of chunk) outcomes[item.index] = error instanceof Error ? error : new Error(String(error))
    }
  }
  return outcomes
}

/**
 * Update an existing flight
 */
export async function updateFlight(flightId: number, updates: FlightUpdate): Promise<Flight & DerivedAck> {
  // The API recomputes is_upcoming from the (possibly new) date, so we never send it.
  const { user_id, id, created_at, is_upcoming, ...body } = updates
  const dto = await api.patch<ApiFlight>(`/api/flights/${flightId}`, body)
  return toFlight(dto, user_id ?? '')
}

/**
 * Delete a flight
 */
export async function deleteFlight(flightId: number): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/flights/${flightId}`)
}

/**
 * Delete multiple flights at once
 */
export async function deleteFlights(flightIds: number[]): Promise<DerivedAck & { deleted: number }> {
  if (flightIds.length === 0) return { deleted: 0 }

  return api.post<DerivedAck & { deleted: number }>('/api/flights/bulk-delete', { ids: flightIds })
}

/**
 * Check for duplicate flights (same date + origin + destination)
 */
export async function checkDuplicateFlight(
  userId: string,
  date: string,
  origin: string,
  destination: string,
  excludeId?: number
): Promise<Flight | null> {
  const dto = await api.get<ApiFlight | null>('/api/flights/check-duplicate', {
    date,
    origin,
    destination,
    excludeId,
  })
  return dto ? toFlight(dto, userId) : null
}

/**
 * Get flight statistics for a user
 */
export async function getFlightStats(_userId: string): Promise<FlightStats> {
  return api.get<FlightStats>('/api/flights/stats')
}

/**
 * Lightweight flight data for map route rendering
 */
export interface FlightRoute {
  id: number
  origin: string
  destination: string
  airline_iata: string | null
  date: string
  is_upcoming: boolean | null
}

/**
 * Get all flight routes for map rendering (lightweight: only route-relevant columns)
 */
export async function getFlightRoutes(_userId: string): Promise<FlightRoute[]> {
  const rows = await api.get<FlightRoute[]>('/api/flights/routes')
  return rows ?? []
}

/**
 * Get recent flights for dashboard display
 */
export async function getRecentFlights(userId: string, limit = 5): Promise<Flight[]> {
  const rows = await api.get<ApiFlight[]>('/api/flights/recent', { limit })
  return (rows ?? []).map((f) => toFlight(f, userId))
}

/**
 * Get upcoming flights for dashboard display
 */
export async function getUpcomingFlights(userId: string, limit = 3): Promise<Flight[]> {
  const rows = await api.get<ApiFlight[]>('/api/flights/upcoming', { limit })
  return (rows ?? []).map((f) => toFlight(f, userId))
}

/**
 * Get unique years from user's flights (for filter dropdown)
 */
export async function getFlightYears(_userId: string): Promise<number[]> {
  const years = await api.get<number[]>('/api/flights/years')
  return years ?? []
}

/**
 * Get unique airlines from user's flights (for filter dropdown)
 */
export async function getFlightAirlines(_userId: string): Promise<string[]> {
  const airlines = await api.get<string[]>('/api/flights/airlines')
  return airlines ?? []
}

/**
 * Get unique aircraft from user's flights (for filter dropdown)
 */
export async function getFlightAircraft(_userId: string): Promise<string[]> {
  const aircraft = await api.get<string[]>('/api/flights/aircraft')
  return aircraft ?? []
}

/**
 * Get all flights for a user (for export)
 * No pagination - returns everything
 */
export async function getAllFlights(userId: string): Promise<Flight[]> {
  const rows = await api.get<ApiFlight[]>('/api/flights/all')
  return rows.map((f) => toFlight(f, userId))
}

/**
 * Get all flight IDs for a user (for bulk selection)
 * Lightweight query - only returns IDs, respects filters
 */
export async function getAllFlightIds(
  _userId: string,
  filters?: FlightFilters
): Promise<number[]> {
  const data = await api.get<{ ids: number[] }>('/api/flights/ids', filterParams(filters))
  return data.ids ?? []
}

/**
 * Convert upcoming flights to completed when their date has passed
 * Call this on app load or periodically
 */
export async function syncUpcomingFlights(_userId: string): Promise<DerivedAck & { synced: number }> {
  return api.post<DerivedAck & { synced: number }>('/api/flights/sync-upcoming')
}
