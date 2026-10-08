import { utcOffsetMinutes } from '../timezones'
import { rowCountries } from './filter'
import { hasPreciseDuration, type Gate } from './figures'
import type { OverviewPayload, OverviewRow, DistanceRecordWitness, RecordExtrema, RecordFlights, RecordRef, SourceRecordRef } from './model'

export type { RecordRef } from './model'
export interface Records {
  longest: (RecordRef & { date: string | null; airline: string | null; flightNumber: string | null;
    durationMinutes: number | null; durationApproximate: boolean; speedKmh: number | null;
    clockShiftMinutes: number | null; previousBestKm: number | null; equatorShare: number }) | null
  shortest: (RecordRef & { date: string | null; shareOfLongest: number }) | null
  longestDuration: RecordRef | null
  shortestDuration: RecordRef | null
  biggestClockJump: RecordRef | null
  busiestDay: { date: string; flights: number } | null
  northernmost: { iata: string; lat: number; flight: {
    flightId: number | null; origin: string; destination: string; value: number | null; date: string
  } | null } | null
  earliestDeparture: (RecordRef & { date: string; depMinute: number }) | null
  busiestYear: { year: number; flights: number; countries: number; activeMonths: number; peakMonth: number;
    months: { key: string; month: number; flights: number }[] } | null
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

function extreme(rows: OverviewRow[], candidateOf: (row: OverviewRow) => DistanceRecordWitness | null,
  direction: 1 | -1, absolute = false): DistanceRecordWitness | null {
  let best: DistanceRecordWitness | null = null
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
      if (mode === 'aggregate' || row.recordFlights || row.weight !== 1) return null
      const value = valueOf(row)
      if (value === null) return null
      const ref = { flightId: row.id, origin: row.origin, destination: row.destination, value }
      if (key !== 'longest' && key !== 'shortest') return ref
      return { ...ref, date: dateInstant(row.date) === null ? null : row.date,
        ...(key === 'longest' ? { airline: row.airline, flightNumber: row.flightNumber,
          durationMinutes: row.durationMinutes !== null && Number.isFinite(row.durationMinutes) && row.durationMinutes >= 0
            ? row.durationMinutes : null, durationSource: row.durationSource, clockShiftMinutes: clockJump(row) } : {}) }
    }, direction, absolute)
  const distance = (row: OverviewRow) => row.distanceKm !== null && row.distanceKm >= 0 ? row.distanceKm : null
  const duration = (row: OverviewRow) => hasPreciseDuration(row) ? row.durationMinutes : null
  return {
    longest: select('longest', distance, 1), shortest: select('shortest', distance, -1),
    longestDuration: select('longestDuration', duration, 1), shortestDuration: select('shortestDuration', duration, -1),
    biggestClockJump: select('biggestClockJump', clockJump, 1, true),
  }
}

export function dateInstant(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const instant = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date ? instant.getTime() : null
}

// One route-group witness suffices for either endpoint; never reconstruct a flight from sums/hour floors.
export function recordFlights(rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights'): RecordFlights {
  let latest: RecordFlights['latest'] = null, earliestDeparture: RecordFlights['earliestDeparture'] = null
  for (const row of rows) {
    const raw = mode === 'flights' && row.weight === 1 && !row.recordExtrema && !row.recordFlights && dateInstant(row.date) !== null
    const ref = { flightId: row.id, origin: row.origin, destination: row.destination, date: row.date }
    const candidate = row.recordFlights?.latest ?? (raw ? { ...ref,
      value: row.distanceKm !== null && Number.isFinite(row.distanceKm) && row.distanceKm >= 0 ? row.distanceKm : null } : null)
    if (candidate && (!latest || candidate.date > latest.date ||
        (candidate.date === latest.date && candidate.flightId < latest.flightId))) latest = candidate
    const minute = row.depMinute
    const departure = row.recordFlights?.earliestDeparture ?? (raw && minute !== null && Number.isInteger(minute) && minute >= 0 && minute <= 1439
      ? { ...ref, value: minute, depMinute: minute } : null)
    if (departure && (!earliestDeparture || departure.depMinute < earliestDeparture.depMinute ||
        (departure.depMinute === earliestDeparture.depMinute && (departure.date > earliestDeparture.date ||
          (departure.date === earliestDeparture.date && departure.flightId < earliestDeparture.flightId))))) earliestDeparture = departure
  }
  return { latest, earliestDeparture }
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
  const extrema = recordExtrema(rows, mode)
  const project = (ref: SourceRecordRef | null): RecordRef | null => ref && ({
    flightId: mode === 'aggregate' ? null : ref.flightId, origin: ref.origin, destination: ref.destination, value: ref.value,
  })
  const winner = extrema.longest
  const date = winner?.date && dateInstant(winner.date) !== null ? winner.date : null
  // Each group has constant per-flight distance; its earliest date admits strictly earlier evidence.
  const prior = date ? rows.filter(row => dateInstant(row.date) !== null && row.date < date && row.weight > 0)
    .map(row => row.distanceKm === null ? null : row.distanceKm / row.weight)
    .filter((km): km is number => km !== null && Number.isFinite(km) && km >= 0) : []
  const duration = winner?.durationMinutes ?? null
  const precise = winner && duration !== null && Number.isFinite(duration) && duration > 0 &&
    ['times', 'route_median', 'schedule'].includes(winner.durationSource ?? '')
  const latest = northernmost ? recordFlights(rows.filter(row => row.origin === northernmost.iata || row.destination === northernmost.iata), mode).latest : null
  const earliest = recordFlights(rows, mode).earliestDeparture
  const years = new Map<number, OverviewRow[]>()
  for (const row of rows) if (dateInstant(row.date) !== null) {
    const year = Number(row.date.slice(0, 4))
    const yearRows = years.get(year) ?? []
    yearRows.push(row)
    years.set(year, yearRows)
  }
  const busyYear = [...years].map(([year, yearRows]) => ({ year, rows: yearRows,
    flights: yearRows.reduce((sum, row) => sum + row.weight, 0) })).sort((a, b) => b.flights - a.flights || a.year - b.year)[0]
  const yearMonths = busyYear ? Array.from({ length: 12 }, (_, i) => ({
    key: `${String(busyYear.year).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`, month: i + 1,
    flights: busyYear.rows.filter(row => Number(row.date.slice(5, 7)) === i + 1).reduce((sum, row) => sum + row.weight, 0),
  })) : []
  return { status: 'ready', value: {
    longest: winner ? { ...project(winner)!, date, airline: winner.airline ?? null, flightNumber: winner.flightNumber ?? null,
      durationMinutes: duration, durationApproximate: duration !== null && winner.durationSource === 'estimate',
      speedKmh: precise ? winner.value * 60 / duration! : null, clockShiftMinutes: winner.clockShiftMinutes ?? null,
      previousBestKm: prior.length ? Math.max(...prior) : null, equatorShare: winner.value / 40075 } : null,
    shortest: extrema.shortest ? { ...project(extrema.shortest)!, date: extrema.shortest.date ?? null,
      shareOfLongest: winner && winner.value > 0 ? extrema.shortest.value / winner.value : 0 } : null,
    longestDuration: project(extrema.longestDuration), shortestDuration: project(extrema.shortestDuration),
    biggestClockJump: project(extrema.biggestClockJump),
    earliestDeparture: earliest ? { ...project(earliest)!, date: earliest.date, depMinute: earliest.depMinute } : null,
    busiestYear: busyYear ? { year: busyYear.year, flights: busyYear.flights,
      countries: new Set(busyYear.rows.flatMap(row => rowCountries(row, refs))).size,
      activeMonths: yearMonths.filter(month => month.flights > 0).length,
      peakMonth: [...yearMonths].sort((a, b) => b.flights - a.flights || a.month - b.month)[0].month, months: yearMonths } : null,
    busiestDay: mode === 'flights' && busiest ? { date: busiest[0], flights: busiest[1] } : null,
    northernmost: northernmost ? { ...northernmost, flight: latest ? { ...latest, flightId: mode === 'aggregate' ? null : latest.flightId } : null } : null,
    southernmost: endpoints[0] ?? null, longestStreakMonths,
    longestGroundStopDays: mode === 'flights' && gaps.length ? Math.max(...gaps) : null,
  } }
}
