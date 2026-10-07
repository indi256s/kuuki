import { utcOffsetMinutes } from '../timezones'
import { hasPreciseDuration, type Gate } from './figures'
import type { OverviewPayload, OverviewRow, RecordExtrema, RecordRef } from './model'

export type { RecordRef } from './model'
export interface Records extends RecordExtrema {
  busiestDay: { date: string; flights: number } | null
  northernmost: { iata: string; lat: number } | null
  southernmost: { iata: string; lat: number } | null
  longestStreakMonths: number
  longestGroundStopDays: number | null
}

export function clockJump(row: OverviewRow): number | null {
  if (!row.originTz || !row.destTz) return null
  const instant = new Date(row.departureUtc ?? `${row.date}T12:00:00Z`)
  const origin = utcOffsetMinutes(row.originTz, instant), destination = utcOffsetMinutes(row.destTz, instant)
  return origin === null || destination === null ? null : destination - origin
}

export function absoluteClockShiftMinutes(row: OverviewRow): number | null {
  if (row.clockShiftMinutes !== undefined) return row.clockShiftMinutes
  if (row.weight !== 1) return null
  const jump = clockJump(row)
  return jump === null ? null : Math.abs(jump)
}

function extreme(rows: OverviewRow[], candidateOf: (row: OverviewRow) => RecordRef | null,
  direction: 1 | -1, absolute = false): RecordRef | null {
  let best: RecordRef | null = null
  for (const row of rows) {
    const candidate = candidateOf(row)
    if (candidate === null || !Number.isFinite(candidate.value)) continue
    const { value } = candidate
    const score = absolute ? Math.abs(value) : value, previous = best && (absolute ? Math.abs(best.value) : best.value)
    if (best === null || (previous !== null && (direction * (score - previous) > 0 || (score === previous && candidate.flightId < best.flightId)))) {
      best = candidate
    }
  }
  return best
}

export function recordExtrema(rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights'): RecordExtrema {
  const select = (key: keyof RecordExtrema, valueOf: (row: OverviewRow) => number | null, direction: 1 | -1, absolute = false) =>
    extreme(rows, row => {
      if (row.recordExtrema) return row.recordExtrema[key]
      if (mode === 'aggregate' || row.weight !== 1) return null
      const value = valueOf(row)
      return value === null ? null : { flightId: row.id, origin: row.origin, destination: row.destination, value }
    }, direction, absolute)
  const distance = (row: OverviewRow) => row.distanceKm !== null && row.distanceKm >= 0 ? row.distanceKm : null
  const duration = (row: OverviewRow) => hasPreciseDuration(row) ? row.durationMinutes : null
  return {
    longest: select('longest', distance, 1), shortest: select('shortest', distance, -1),
    longestDuration: select('longestDuration', duration, 1), shortestDuration: select('shortestDuration', duration, -1),
    biggestClockJump: select('biggestClockJump', clockJump, 1, true),
  }
}

function dateInstant(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const instant = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date ? instant.getTime() : null
}

export function records(rows: OverviewRow[], refs: OverviewPayload['refs'], mode: OverviewPayload['mode']): Gate<Records> {
  const have = rows.reduce((sum, row) => sum + row.weight, 0)
  if (have < 5) return { status: 'below', have, need: 5 }
  const endpoints = [...new Set(rows.flatMap(row => [row.origin, row.destination]))].sort()
    .flatMap(iata => {
      const lat = refs.airports[iata]?.lat
      return lat != null && Number.isFinite(lat) && Math.abs(lat) <= 90 ? [{ iata, lat }] : []
    }).sort((a, b) => a.lat - b.lat || (a.iata < b.iata ? -1 : a.iata > b.iata ? 1 : 0))
  const days = new Map<string, number>()
  for (const row of rows) if (dateInstant(row.date) !== null) days.set(row.date, (days.get(row.date) ?? 0) + row.weight)
  const dates = [...days.keys()].sort()
  const months = [...new Set(dates.map(date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1))].sort((a, b) => a - b)
  let longestStreakMonths = 0, streak = 0
  for (let i = 0; i < months.length; i++) {
    streak = i > 0 && months[i] === months[i - 1] + 1 ? streak + 1 : 1
    longestStreakMonths = Math.max(longestStreakMonths, streak)
  }
  const busiest = [...days].sort(([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : a > b ? 1 : 0))[0]
  const gaps = dates.slice(1).map((date, i) => (dateInstant(date)! - dateInstant(dates[i])!) / 86400000)
  const northernmost = endpoints.length ? endpoints.find(endpoint => endpoint.lat === endpoints[endpoints.length - 1].lat)! : null
  return { status: 'ready', value: {
    ...recordExtrema(rows, mode),
    busiestDay: mode === 'flights' && busiest ? { date: busiest[0], flights: busiest[1] } : null,
    northernmost, southernmost: endpoints[0] ?? null, longestStreakMonths,
    longestGroundStopDays: mode === 'flights' && gaps.length ? Math.max(...gaps) : null,
  } }
}
