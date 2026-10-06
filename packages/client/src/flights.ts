import { api, ApiError, type CallOptions } from './apiClient'
import type { DerivedAck } from './derivedState'

/** Own-flight row returned by the API; the owner is refilled for current client callers. */
export interface Flight {
  id: number
  user_id: string
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
  lifecycle_state?: 'upcoming' | 'awaiting' | 'logged'
  confirmation_source?: 'save' | 'user' | 'automatic' | 'legacy' | null
  confirmed_at?: string | null
  lifecycle_timezone?: string | null
  awaiting_after?: string | null
  auto_confirm_after?: string | null
  arrival_transit?: boolean | null
  arrival_transit_leg_id?: number | null
}

type FlightWritable = Pick<Flight,
  'id' | 'user_id' | 'date' | 'origin' | 'destination' | 'airline_iata' | 'aircraft_icao' |
  'flight_number' | 'departure_time' | 'arrival_time' | 'departure_utc' | 'arrival_utc' |
  'origin_tz' | 'dest_tz' | 'distance_km' | 'duration_minutes' | 'source' |
  'is_upcoming' | 'enrichment_status' | 'created_at'>
export type FlightInsert = Pick<FlightWritable, 'user_id' | 'date' | 'origin' | 'destination'> & Partial<Omit<FlightWritable, 'user_id' | 'date' | 'origin' | 'destination'>>
export type FlightUpdate = Partial<FlightWritable>

/**
 * Own-flight DTO as returned by the API (functions/api/_lib/flights.ts → toOwnFlight).
 * The API omits `user_id` (always the requester) and its D1-internal
 * `aircraft_lookup_attempts` counter.
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
  lifecycle_state?: Flight['lifecycle_state']
  confirmation_source?: Flight['confirmation_source']
  confirmed_at?: Flight['confirmed_at']
  lifecycle_timezone?: Flight['lifecycle_timezone']
  awaiting_after?: Flight['awaiting_after']
  auto_confirm_after?: Flight['auto_confirm_after']
  arrival_transit?: Flight['arrival_transit']
  arrival_transit_leg_id?: Flight['arrival_transit_leg_id']
}

/**
 * Lift an ApiFlight DTO into the row shape frontend consumers expect.
 * The API omits `user_id`; we re-attach the caller-known id so the declared `Flight` return type
 * holds. (No consumer reads `user_id` off a returned flight — it is filled for type-shape parity.)
 */
function toFlight(dto: ApiFlight, userId: string): Flight {
  return { ...dto, user_id: userId }
}

/**
 * Get a single flight by ID
 */
export async function getFlight(flightId: number, options?: CallOptions): Promise<Flight | null> {
  try {
    const dto = await api.get<ApiFlight>(`/api/flights/${flightId}`, undefined, options)
    return toFlight(dto, '')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/**
 * Delete a flight
 */
export async function deleteFlight(flightId: number): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/flights/${flightId}`)
}

/**
 * Check for duplicate flights (same date + origin + destination)
 */
export async function checkDuplicateFlight(
  userId: string,
  date: string,
  origin: string,
  destination: string,
  excludeId?: number,
  options?: CallOptions
): Promise<Flight | null> {
  const dto = await api.get<ApiFlight | null>('/api/flights/check-duplicate', {
    date,
    origin,
    destination,
    excludeId,
  }, options)
  return dto ? toFlight(dto, userId) : null
}

/**
 * Get all flights for a user (for export)
 * No pagination - returns everything
 */
export async function getAllFlights(userId: string, options?: CallOptions): Promise<Flight[]> {
  const rows = await api.get<ApiFlight[]>('/api/flights/all', undefined, options)
  return rows.map((f) => toFlight(f, userId))
}
