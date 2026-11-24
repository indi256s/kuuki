import { api, ApiError, type CallOptions } from './apiClient'
import type { DerivedAck } from './derivedState'

export type { OwnFlight as Flight } from '@kuuki/shared/types'
import type { OwnFlight as Flight } from '@kuuki/shared/types'
import type { FlightInput, FlightCreateInput } from '@kuuki/shared'

export type FlightInsert = FlightCreateInput
export type FlightUpdate = FlightInput

export async function getFlight(flightId: number, options?: CallOptions): Promise<Flight | null> {
  try {
    return await api.get<Flight>(`/api/flights/${flightId}`, undefined, options)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function deleteFlight(flightId: number): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/flights/${flightId}`)
}

export async function checkDuplicateFlight(
  date: string,
  origin: string,
  destination: string,
  excludeId?: number,
  options?: CallOptions,
): Promise<Flight | null> {
  return api.get<Flight | null>(
    '/api/flights/check-duplicate',
    {
      date,
      origin,
      destination,
      excludeId,
    },
    options,
  )
}

export async function getAllFlights(options?: CallOptions): Promise<Flight[]> {
  return api.get<Flight[]>('/api/flights/all', undefined, options)
}

export async function getRecentFlights(limit: number, options?: CallOptions): Promise<Flight[]> {
  return api.get<Flight[]>('/api/flights/recent', { limit }, options)
}
