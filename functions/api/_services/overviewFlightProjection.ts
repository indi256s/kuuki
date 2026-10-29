import { utcOffsetMinutes } from '../../../packages/shared/src/timezones'
import { familyOf } from '../../../packages/data/src/aircraft-lookup'
import type { OverviewPayload, OverviewRow } from '../../../packages/shared/src/overview/model'
import type { FlightRow } from '../_lib/flights'
import { COUNTRY_REGION } from '../_lib/countryRegions.generated'

export const OVERVIEW_FLIGHT_COLUMNS = `id, date, origin, destination, lifecycle_state, airline_iata, aircraft_icao,
  flight_number, departure_time, arrival_time, distance_km, duration_minutes, zones_overflown,
  duration_source, origin_tz, dest_tz, departure_utc`

export type AirportRow = {
  iata: string
  latitude: number | null
  longitude: number | null
  country_code: string | null
  city: string | null
  name: string
}
export type AircraftRow = {
  icao: string
  manufacturer: string | null
  type: string | null
  model: string | null
  name: string | null
}

function localMinute(time: string | null): number | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function arrivalMinute(row: FlightRow): number | null {
  if (row.arrival_time !== null) return localMinute(row.arrival_time)
  const duration = row.duration_minutes
  if (
    !row.departure_utc ||
    !row.dest_tz ||
    duration === null ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    !['times', 'route_median', 'schedule'].includes(row.duration_source ?? '')
  )
    return null
  const departure = new Date(row.departure_utc)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/.test(row.departure_utc) ||
    !Number.isFinite(departure.getTime()) ||
    departure.toISOString().slice(0, 10) !== row.departure_utc.slice(0, 10)
  )
    return null
  const arrival = new Date(departure.getTime() + duration * 60_000)
  const offset = utcOffsetMinutes(row.dest_tz, arrival)
  return offset === null
    ? null
    : (arrival.getUTCHours() * 60 + arrival.getUTCMinutes() + offset + 1440) % 1440
}

export function projectOverviewFlights(
  flights: FlightRow[],
  suppressions: { flight_id: number; endpoint: 'origin' | 'destination' }[],
): OverviewRow[] {
  const bits = new Map<number, number>()
  for (const suppression of suppressions) {
    bits.set(
      suppression.flight_id,
      (bits.get(suppression.flight_id) ?? 0) | (suppression.endpoint === 'origin' ? 1 : 2),
    )
  }
  return flights.map((row) => ({
    id: row.id,
    weight: 1,
    date: row.date,
    state: row.lifecycle_state,
    origin: row.origin,
    destination: row.destination,
    airline: row.airline_iata,
    aircraft: row.aircraft_icao,
    flightNumber: row.flight_number,
    depMinute: localMinute(row.departure_time),
    arrMinute: arrivalMinute(row),
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    zonesOverflown: row.zones_overflown,
    durationSource: row.duration_source,
    originTz: row.origin_tz,
    destTz: row.dest_tz,
    departureUtc: row.departure_utc,
    suppressed: (bits.get(row.id) ?? 0) as OverviewRow['suppressed'],
  }))
}

export function overviewFlightRefs(
  rows: OverviewRow[],
  airportRows: AirportRow[],
  aircraftRows: AircraftRow[],
  homeOverride: string | null = null,
): OverviewPayload['refs'] {
  const airports = new Map(airportRows.map((row) => [row.iata, row]))
  const aircraft = new Map(aircraftRows.map((row) => [row.icao, row]))
  const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }
  const airportCodes = new Set(rows.flatMap((row) => [row.origin, row.destination]))
  if (homeOverride && airports.has(homeOverride)) airportCodes.add(homeOverride)
  for (const code of [...airportCodes].sort()) {
    const ref = airports.get(code)
    refs.airports[code] = {
      lat: ref?.latitude ?? null,
      lon: ref?.longitude ?? null,
      country: ref?.country_code || null,
      city: ref?.city ?? null,
      name: ref?.name ?? code,
    }
    const region = ref?.country_code ? COUNTRY_REGION[ref.country_code] : null
    if (region) refs.regions[ref!.country_code!] = region
  }
  for (const code of [
    ...new Set(rows.map((row) => row.aircraft).filter((code): code is string => code !== null)),
  ].sort()) {
    const ref = aircraft.get(code)
    refs.aircraft[code] = {
      manufacturer: ref?.manufacturer ?? null,
      type: ref?.type ?? null,
      family: familyOf(code, ref),
      name: ref?.name ?? null,
    }
  }
  return refs
}
