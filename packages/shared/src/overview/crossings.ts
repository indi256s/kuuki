import { coordinates, greatCircleCrossings } from '../geo'
import type { Gate } from './figures'
import type { OverviewPayload, OverviewRow, RecordRef } from './model'
import { clockJump, dateInstant, recordFlights } from './records'
import { utcOffsetMinutes } from '../timezones'

export interface Crossings {
  locatedFlights: number
  zonesOverflown: number
  clockShiftHours: number
  equator: number
  dateLine: number
  arcticCircle: number
  antarcticCircle: number
  eastboundShare: number
  forwardHours: number
  backHours: number
  shiftByYear: { key: string; year: number; forward: number; back: number; flights: number }[]
  offsets: { key: string; offset: number; hit: boolean }[]
  lastEquator: (RecordRef & { date: string }) | null
  lastArctic: (RecordRef & { date: string }) | null
  lastAntarctic: (RecordRef & { date: string }) | null
  lastDateLine: (RecordRef & { date: string }) | null
}
type PathCrossings = Pick<Crossings, 'equator' | 'dateLine' | 'arcticCircle' | 'antarcticCircle'>

// Legacy weighted rows cannot recover actual instants from their representative dates.
export function crossingTime(row: OverviewRow): OverviewRow['crossingTime'] {
  if (row.crossingTime) return { ...row.crossingTime, offsets: [...row.crossingTime.offsets] }
  if (row.weight !== 1 || row.recordExtrema || row.recordFlights) return undefined
  const validDate = dateInstant(row.date) !== null
  const jump = validDate ? clockJump(row) : null
  const instant = new Date(row.departureUtc ?? `${row.date}T12:00:00Z`)
  const offsets = validDate
    ? [row.originTz, row.destTz].flatMap((zone) => {
        const minutes = zone ? utcOffsetMinutes(zone, instant) : null
        return minutes === null ? [] : [((((Math.floor(minutes / 60) + 11) % 24) + 24) % 24) - 11]
      })
    : []
  return {
    forwardMinutes: Math.max(0, jump ?? 0),
    backMinutes: Math.max(0, -(jump ?? 0)),
    offsets: [...new Set(offsets)].sort((a, b) => a - b),
  }
}

export function crossings(
  rows: OverviewRow[],
  refs: OverviewPayload['refs'],
  mode: OverviewPayload['mode'] = 'flights',
  counted: OverviewRow[] = rows,
): Gate<Crossings> {
  const have = rows.reduce((sum, row) => sum + (row.originTz && row.destTz ? row.weight : 0), 0)
  if (have < 3) return { status: 'below', have, need: 3 }
  const years = counted
    .filter((row) => dateInstant(row.date) !== null)
    .map((row) => Number(row.date.slice(0, 4)))
  const first = years.length ? years.reduce((a, b) => Math.min(a, b)) : 0,
    last = years.length ? years.reduce((a, b) => Math.max(a, b)) : -1
  const value: Crossings = {
    locatedFlights: 0,
    zonesOverflown: 0,
    clockShiftHours: 0,
    equator: 0,
    dateLine: 0,
    arcticCircle: 0,
    antarcticCircle: 0,
    eastboundShare: 0,
    forwardHours: 0,
    backHours: 0,
    shiftByYear: Array.from({ length: last - first + 1 }, (_, i) => ({
      key: String(first + i).padStart(4, '0'),
      year: first + i,
      forward: 0,
      back: 0,
      flights: 0,
    })),
    offsets: Array.from({ length: 24 }, (_, i) => ({
      key: String(i - 11),
      offset: i - 11,
      hit: false,
    })),
    lastEquator: null,
    lastArctic: null,
    lastAntarctic: null,
    lastDateLine: null,
  }
  const paths = new Map<string, PathCrossings>()
  let east = 0,
    located = 0,
    forward = 0,
    back = 0
  for (const row of rows) {
    const zones = row.zonesOverflown,
      time = crossingTime(row)
    const year =
      dateInstant(row.date) === null
        ? undefined
        : value.shiftByYear[Number(row.date.slice(0, 4)) - first]
    if (year) year.flights += row.weight
    if (time) {
      forward += time.forwardMinutes
      back += time.backMinutes
      if (year) {
        year.forward += time.forwardMinutes
        year.back += time.backMinutes
      }
      for (const offset of time.offsets) value.offsets[offset + 11].hit = true
    }
    if (zones !== null && Number.isFinite(zones) && zones >= 0) value.zonesOverflown += zones
    const a = coordinates(refs.airports[row.origin]),
      b = coordinates(refs.airports[row.destination])
    if (!a || !b) continue
    located += row.weight
    if (((b.lon - a.lon + 540) % 360) - 180 > 0) east += row.weight
    const key = `${row.origin}-${row.destination}`
    let path = paths.get(key)
    if (!path) {
      path = greatCircleCrossings(a, b)
      paths.set(key, path)
    }
    const latest = recordFlights([row], mode).latest
    if (latest) {
      for (const [field, count] of [
        ['lastEquator', path.equator],
        ['lastArctic', path.arcticCircle],
        ['lastAntarctic', path.antarcticCircle],
        ['lastDateLine', path.dateLine],
      ] as const) {
        const previous = value[field]
        // value is this actual flight's positive route crossing count, independent of distance/weight.
        if (
          count > 0 &&
          (!previous ||
            latest.date > previous.date ||
            (latest.date === previous.date && latest.flightId < (previous.flightId ?? Infinity)))
        ) {
          value[field] = { ...latest, value: count }
        }
      }
    }
    value.equator += path.equator * row.weight
    value.dateLine += path.dateLine * row.weight
    value.arcticCircle += path.arcticCircle * row.weight
    value.antarcticCircle += path.antarcticCircle * row.weight
  }
  for (const year of value.shiftByYear) {
    year.forward /= 60
    year.back /= 60
  }
  for (const field of ['lastEquator', 'lastArctic', 'lastAntarctic', 'lastDateLine'] as const) {
    if (mode === 'aggregate' && value[field]) value[field]!.flightId = null
  }
  value.forwardHours = Math.round(forward / 60)
  value.backHours = Math.round(back / 60)
  value.clockShiftHours = value.forwardHours + value.backHours
  value.locatedFlights = located
  value.eastboundShare = located ? east / located : 0
  return { status: 'ready', value }
}
