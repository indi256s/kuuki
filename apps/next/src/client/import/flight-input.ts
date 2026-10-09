// Pure helpers for flights saved without the batch (manual rows) and for the done summary.
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { findAirport } from '@kuuki/data/airport-lookup'
import {
  calculateFlightDistance,
  calculateFlightDuration,
  estimateFlightDuration,
} from '@kuuki/client/geo'
import type { FlightInsert } from '@kuuki/client/flights'
import { normaliseValues, type FieldValues } from './review-model'

/** Same derived fields the capture form fills, so a manual row here and a flight added on /add look alike. */
export function toFlightInput(
  values: FieldValues,
): Omit<FlightInsert, 'id' | 'created_at' | 'user_id'> {
  const v = normaliseValues(values)
  const origin = findAirport(v.origin),
    destination = findAirport(v.destination)
  const aircraft = v.aircraft_icao ? findAircraft(v.aircraft_icao) : null
  const distance =
    origin && destination
      ? calculateFlightDistance(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude,
        )
      : null
  const actual =
    origin && destination && v.departure_time && v.arrival_time
      ? calculateFlightDuration(
          v.departure_time,
          v.arrival_time,
          v.date,
          origin.timezone,
          destination.timezone,
        )
      : null
  return {
    date: v.date,
    origin: v.origin,
    destination: v.destination,
    airline_iata: v.airline_iata || null,
    flight_number: v.flight_number || null,
    aircraft_icao: v.aircraft_icao || null,
    departure_time: v.departure_time || null,
    arrival_time: v.arrival_time || null,
    distance_km: distance,
    duration_minutes:
      actual || (distance ? estimateFlightDuration(distance, aircraft?.type) : null),
    origin_tz: origin?.timezone || null,
    dest_tz: destination?.timezone || null,
    source: 'manual',
    enrichment_status: v.aircraft_icao ? 'skipped' : 'pending',
  }
}

/** Great-circle distance of one route in km, 0 when either airport is unknown. */
export function routeKm(origin: string, destination: string): number {
  const a = findAirport(origin),
    b = findAirport(destination)
  return a && b ? calculateFlightDistance(a.latitude, a.longitude, b.latitude, b.longitude) : 0
}

/** Country codes touched by a route, from the airport catalogue. */
export function routeCountries(origin: string, destination: string): string[] {
  return [findAirport(origin)?.countryCode, findAirport(destination)?.countryCode].filter(
    (code): code is string => Boolean(code),
  )
}

/** Countries pressed after the save that were not pressed before it, limited to the countries the import touched. */
export function newlyPressed(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  touched: Iterable<string>,
): string[] {
  return [...new Set(touched)].filter((code) => after.has(code) && !before.has(code)).sort()
}
