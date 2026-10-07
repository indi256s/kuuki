import { findAirport } from '../../../packages/data/src/airport-lookup'
import { estimateBlockMinutes } from '../../../packages/shared/src/blockTime'
import { validateFlightInput } from '../../../packages/shared/src/flightValidation'
import { eastwardShare, greatCircleKm, type LatLon } from '../../../packages/shared/src/geo'
import { utcOffsetMinutes } from '../../../packages/shared/src/timezones'
import type { DurationSource } from '../../../packages/shared/src/types'
import { zoneAt, zonesOverflown } from '../_lib/zones'
import { readBlockTimeMedian } from './blockTimeMedian'
import { computeFlightDuration } from './flightDuration'

export function decideDuration(args: {
  timesMinutes: number | null; timesFromSchedule: boolean; median: number | null; distanceKm: number | null; east: number
}): { minutes: number | null; source: DurationSource | null } {
  const { timesMinutes, timesFromSchedule, median, distanceKm, east } = args
  if (timesMinutes !== null && !timesFromSchedule) return { minutes: Math.min(1200, timesMinutes), source: 'times' }
  if (median !== null) return { minutes: Math.min(1200, median), source: 'route_median' }
  if (timesMinutes !== null) return { minutes: Math.min(1200, timesMinutes), source: 'schedule' }
  return distanceKm === null ? { minutes: null, source: null }
    : { minutes: estimateBlockMinutes(distanceKm, east), source: 'estimate' }
}

export interface FlightMetrics {
  originTz: string | null
  destTz: string | null
  departureUtc: string | null
  arrivalUtc: string | null
  distanceKm: number | null
  durationMinutes: number | null
  durationSource: DurationSource | null
  zonesOverflown: number | null
}

type Reference = { iata: string; latitude: number | null; longitude: number | null }
function coordinates(row: Reference | undefined): LatLon | null {
  if (row?.latitude == null || row.longitude == null || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)
    || Math.abs(row.latitude) > 90 || Math.abs(row.longitude) > 180) return null
  return { lat: row.latitude, lon: row.longitude }
}

/** Same pure timezone/time resolution for current writes and historical backfill. */
export function resolveFlightTimes(input: {
  date: string; origin: string; destination: string
  departureTime: string | null; arrivalTime: string | null; originTz?: string | null; destTz?: string | null
}, origin: LatLon | null, destination: LatLon | null) {
  const noon = new Date(`${input.date}T12:00:00Z`)
  const timezone = (iata: string, requested: string | null | undefined, coords: LatLon | null): string | null => {
    for (const zone of [requested, findAirport(iata)?.timezone]) {
      if (zone && utcOffsetMinutes(zone, noon) !== null) return zone
    }
    return coords ? zoneAt(coords) : null
  }
  const originTz = timezone(input.origin, input.originTz, origin)
  const destTz = timezone(input.destination, input.destTz, destination)
  let times: ReturnType<typeof computeFlightDuration> = { departureUtc: null, arrivalUtc: null, durationMinutes: null }
  // Historical rows may contain malformed dates/times; never turn those into measured samples.
  try {
    validateFlightInput({ date: input.date, departure_time: input.departureTime, arrival_time: input.arrivalTime }, 'patch')
    times = computeFlightDuration({ date: input.date, departureTime: input.departureTime, arrivalTime: input.arrivalTime,
      originTz, destTz, existingDurationMinutes: null })
  } catch { /* invalid historical times have no measured duration */ }
  return { originTz, destTz, ...times }
}

export async function resolveFlightMetrics(db: D1Database, input: {
  date: string; origin: string; destination: string; airlineIata: string | null; flightNumber: string | null
  departureTime: string | null; arrivalTime: string | null; originTz?: string | null; destTz?: string | null
  clientDistanceKm?: number | null; timesFromSchedule?: boolean; excludeFlightId?: number
}): Promise<FlightMetrics> {
  const { results } = await db.prepare('SELECT iata, latitude, longitude FROM airports_reference WHERE iata IN (?, ?)')
    .bind(input.origin, input.destination).all<Reference>()
  const origin = coordinates(results.find(row => row.iata === input.origin))
  const destination = coordinates(results.find(row => row.iata === input.destination))
  const noon = new Date(`${input.date}T12:00:00Z`)
  const times = resolveFlightTimes(input, origin, destination)
  const distanceKm = origin && destination ? Math.min(20000, Math.round(greatCircleKm(origin, destination)))
    : input.clientDistanceKm != null && Number.isFinite(input.clientDistanceKm) ? Math.round(Math.max(0, Math.min(20000, input.clientDistanceKm))) : null
  const median = times.durationMinutes !== null && !input.timesFromSchedule ? null : await readBlockTimeMedian(db, input)
  const duration = decideDuration({ timesMinutes: times.durationMinutes, timesFromSchedule: input.timesFromSchedule ?? false,
    median, distanceKm, east: origin && destination ? eastwardShare(origin, destination) : 0 })
  return { originTz: times.originTz, destTz: times.destTz, departureUtc: times.departureUtc, arrivalUtc: times.arrivalUtc, distanceKm,
    durationMinutes: duration.minutes, durationSource: duration.source,
    zonesOverflown: origin && destination && Number.isFinite(noon.getTime())
      ? zonesOverflown(origin, destination, times.departureUtc ? new Date(times.departureUtc) : noon) : null }
}
