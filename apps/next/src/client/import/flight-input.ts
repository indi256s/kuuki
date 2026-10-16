// Pure helpers for flights saved without the batch (manual rows) and for the done summary.
import { findAirport } from '@kuuki/data/airport-lookup'
import { calculateFlightDistance } from '@kuuki/client/geo'
import type { FlightInsert } from '@kuuki/client/flights'
import { normaliseValues, type FieldValues } from './review-model'

/** Admitted fields for a manual save; the server resolves flight metrics. */
export function toFlightInput(values: FieldValues): FlightInsert {
  const v = normaliseValues(values)
  const origin = findAirport(v.origin),
    destination = findAirport(v.destination)
  return {
    date: v.date,
    origin: v.origin,
    destination: v.destination,
    airline_iata: v.airline_iata || null,
    flight_number: v.flight_number || null,
    aircraft_icao: v.aircraft_icao || null,
    departure_time: v.departure_time || null,
    arrival_time: v.arrival_time || null,
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
