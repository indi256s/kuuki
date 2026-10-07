import { estimateBlockMinutes, isLegacyEstimate, type BlockTimeModel } from '../../../packages/shared/src/blockTime'
import { eastwardShare, greatCircleKm, type LatLon } from '../../../packages/shared/src/geo'
import type { FlightRow } from '../_lib/flights'
import { dirtyMarkerSql, sqlLiteral } from '../_lib/sqlArtifact'
import { zonesOverflown } from '../_lib/zones'
import { medianFromSamples, normalizeFlightNumber } from './blockTimeMedian'
import { decideDuration, resolveFlightTimes } from './flightMetrics'

const CAS_COLUMNS = ['origin', 'destination', 'date', 'airline_iata', 'flight_number', 'departure_time', 'arrival_time',
  'origin_tz', 'dest_tz', 'distance_km', 'duration_minutes', 'duration_source'] as const
const METRIC_COLUMNS = ['origin_tz', 'dest_tz', 'departure_utc', 'arrival_utc', 'distance_km', 'duration_minutes',
  'duration_source', 'zones_overflown'] as const
export type CasColumns = Pick<FlightRow, typeof CAS_COLUMNS[number]>
export type MetricColumns = Pick<FlightRow, typeof METRIC_COLUMNS[number]>
export type BackfillFlight = CasColumns & MetricColumns & Pick<FlightRow, 'id' | 'user_id' | 'lifecycle_state'>
export type BackfillClass = 'tz_filled' | 'times' | 'route_median' | 'estimate_replaced' | 'kept_unexplained'
  | 'distance_changed' | 'zones_set' | 'no_coordinates'
export interface BackfillChange {
  id: number; userId: string; before: CasColumns; after: MetricColumns; classes: BackfillClass[]
}

function coordinates(point: LatLon | undefined): LatLon | null {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180
    ? point : null
}

export function planFlightBackfill(flights: BackfillFlight[], coords: Map<string, LatLon>, model?: BlockTimeModel): BackfillChange[] {
  const measured = flights.map(flight => {
    const origin = coordinates(coords.get(flight.origin)), destination = coordinates(coords.get(flight.destination))
    const times = resolveFlightTimes({ date: flight.date, origin: flight.origin, destination: flight.destination,
      departureTime: flight.departure_time, arrivalTime: flight.arrival_time, originTz: flight.origin_tz, destTz: flight.dest_tz }, origin, destination)
    if (times.durationMinutes !== null) times.durationMinutes = Math.min(1200, times.durationMinutes)
    return { flight, origin, destination, times }
  })
  const pools = new Map<string, typeof measured>()
  for (const item of measured) {
    if (!['awaiting', 'logged'].includes(item.flight.lifecycle_state) || item.flight.duration_source === 'schedule'
      || item.times.durationMinutes === null || item.times.durationMinutes <= 0 || item.times.durationMinutes > 1200) continue
    const key = JSON.stringify([item.flight.origin, item.flight.destination])
    const pool = pools.get(key) ?? []
    pool.push(item)
    pools.set(key, pool)
  }
  for (const pool of pools.values()) pool.sort((a, b) => b.flight.id - a.flight.id)
  const changes: BackfillChange[] = []
  for (const { flight, origin, destination, times } of measured) {
    const classes: BackfillClass[] = []
    const distance = origin && destination ? Math.min(20000, Math.round(greatCircleKm(origin, destination))) : flight.distance_km
    const east = origin && destination ? eastwardShare(origin, destination) : 0
    const pool = times.durationMinutes !== null && flight.duration_source !== 'schedule' ? []
      : (pools.get(JSON.stringify([flight.origin, flight.destination])) ?? []).slice(0, 1001)
        .filter(p => p.flight.id !== flight.id).slice(0, 1000)
    const airline = flight.airline_iata?.toUpperCase().trim()
    const number = normalizeFlightNumber(flight.airline_iata, flight.flight_number)
    const sameNumber = airline && number ? pool.filter(p => p.flight.airline_iata?.toUpperCase().trim() === airline
      && normalizeFlightNumber(p.flight.airline_iata, p.flight.flight_number) === number) : []
    const median = medianFromSamples(sameNumber.map(p => p.times.durationMinutes!))
      ?? medianFromSamples(pool.map(p => p.times.durationMinutes!))
    const duration = decideDuration({ timesMinutes: times.durationMinutes, timesFromSchedule: flight.duration_source === 'schedule',
      median, distanceKm: distance, east })
    if (duration.source === 'estimate' && distance !== null) duration.minutes = estimateBlockMinutes(distance, east, model)
    // Retained unexplained values remain estimates on reruns; measured/median/schedule provenance is authoritative.
    if (times.durationMinutes === null && (flight.duration_source === null || flight.duration_source === 'estimate')
      && flight.duration_minutes !== null && flight.duration_minutes > 0 && flight.duration_minutes <= 1200
      && (flight.distance_km === null || !isLegacyEstimate(flight.duration_minutes, flight.distance_km))) {
      duration.minutes = flight.duration_minutes
      duration.source = 'estimate'
      classes.push('kept_unexplained')
    } else if (duration.source === 'estimate' && flight.duration_minutes !== null) classes.push('estimate_replaced')
    if (duration.source === 'times' || duration.source === 'route_median') classes.push(duration.source)
    if (times.originTz !== flight.origin_tz || times.destTz !== flight.dest_tz) classes.push('tz_filled')
    if (distance !== flight.distance_km) classes.push('distance_changed')
    const instant = new Date(times.departureUtc ?? `${flight.date}T12:00:00Z`)
    const zones = origin && destination && Number.isFinite(instant.getTime()) ? zonesOverflown(origin, destination, instant) : null
    if (!origin || !destination) classes.push('no_coordinates')
    if (zones !== flight.zones_overflown) classes.push('zones_set')
    const after: MetricColumns = { origin_tz: times.originTz, dest_tz: times.destTz, departure_utc: times.departureUtc,
      arrival_utc: times.arrivalUtc, distance_km: distance, duration_minutes: duration.minutes,
      duration_source: duration.source, zones_overflown: zones }
    if (METRIC_COLUMNS.every(c => flight[c] === after[c])) continue
    const before = Object.fromEntries(CAS_COLUMNS.map(c => [c, flight[c]])) as CasColumns
    changes.push({ id: flight.id, userId: flight.user_id, before, after, classes })
  }
  return changes
}

export function renderBackfillSql(changes: BackfillChange[], meta: { accountId: string; databaseId: string; schemaSha256: string }): string {
  const header = [
    '-- PRIVATE MIGRATION DRAFT: contains user data; keep mode 0600.',
    '-- Recheck target, schema, backup and source under the approved writer hold before application.',
    '-- Compare-and-set guards reject row drift; apply atomically and keep cron held.',
    `-- Account ${JSON.stringify(meta.accountId)}; D1 database ${JSON.stringify(meta.databaseId)}`,
    `-- Target schema SHA-256 ${JSON.stringify(meta.schemaSha256)}`,
  ]
  const updates = changes.map(change => `UPDATE flights SET ${METRIC_COLUMNS.map(c => `${c} = ${sqlLiteral(change.after[c])}`).join(', ')}\n` +
    `WHERE id = ${sqlLiteral(change.id)} AND user_id = ${sqlLiteral(change.userId)} AND ` +
    CAS_COLUMNS.map(c => `${c} IS ${sqlLiteral(change.before[c])}`).join(' AND ') + ';')
  return [...header, ...updates, ...dirtyMarkerSql([...new Set(changes.map(c => c.userId))].sort()), ''].join('\n')
}
