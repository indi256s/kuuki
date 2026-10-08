import { calendarDay, type NextFlight, type ReplayItem } from './next'
import { isEmptyFilter, rowCountries } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'
import type { Records } from './records'
import type { Crossings } from './crossings'
import type { Fleet } from './fleet'
import type { Makers } from './makers'
import type { Clock } from './clock'
import type { Rhythm } from './rhythm'
import type { Rankings } from './rankings'
import type { GlobeData } from './globe'

export type Gate<T> = { status: 'ready'; value: T } | { status: 'below'; have: number; need: number }
export interface Figures {
  flights: number; awaiting: number
  distanceKm: number
  durationMinutes: number; durationApproximate: boolean
  countries: { value: number; source: 'passport' | 'by_air' }; regions: number
  firstDate: string | null; airports: number; estimatedFlights: number; equatorLaps: number
  byYear: { key: string; year: number; flights: number }[]
  share: { flights: number; distanceKm: number; durationMinutes: number; countries: number; airports: number } | null
  deltas: { flights: number; distanceKm: number; durationMinutes: number } | null
}
export interface Coverage {
  total: number; typed: number; withDepartureTime: number; withBothTz: number; preciseDuration: number
}
export interface OverviewScope {
  filter: OverviewFilter; figures: Figures; coverage: Coverage
  home: { iata: string; source: 'override' | 'most_departed' } | null
  records: Gate<Records>
  crossings: Gate<Crossings>
  fleet: Gate<Fleet>
  makers: Gate<Makers>
  clock: Gate<Clock>
  rhythm: Gate<Rhythm>
  rankings: Rankings
  globe: GlobeData
  next: NextFlight[]
  replay: ReplayItem[]
}

const metric = (value: number | null): number => value !== null && Number.isFinite(value) && value >= 0 ? value : 0

export function hasPreciseDuration(row: OverviewRow): boolean {
  return row.durationMinutes !== null && Number.isFinite(row.durationMinutes) && row.durationMinutes >= 0 &&
    row.durationSource !== null && row.durationSource !== 'estimate'
}

export function preciseDurationSamples(row: OverviewRow, raw = true): number[] {
  if (row.durationSource === null || row.durationSource === 'estimate') return []
  if (row.preciseDurationSamples) return row.preciseDurationSamples.filter(value => Number.isFinite(value) && value >= 0)
  // Weighted or legacy aggregate rows have no exact constituent evidence.
  return raw && row.weight === 1 && !row.recordExtrema && !row.recordFlights && hasPreciseDuration(row) ? [row.durationMinutes!] : []
}

export function totals(rows: OverviewRow[]): NonNullable<Figures['deltas']> {
  return rows.reduce((sum, row) => ({
    flights: sum.flights + row.weight,
    distanceKm: sum.distanceKm + metric(row.distanceKm),
    durationMinutes: sum.durationMinutes + metric(row.durationMinutes),
  }), { flights: 0, distanceKm: 0, durationMinutes: 0 })
}

export function figures(rows: OverviewRow[], payload: OverviewPayload, filter: OverviewFilter,
  deltas: Figures['deltas'], counted: OverviewRow[]): Figures {
  const countries = new Set(rows.flatMap(row => rowCountries(row, payload.refs)))
  const regions = new Set([...countries].map(country => payload.refs.regions[country]).filter(Boolean))
  const unfiltered = isEmptyFilter(filter)
  const scopeTotals = totals(rows)
  const airports = new Set(rows.flatMap(row => [row.origin, row.destination])).size
  const dates = rows.map(row => row.date).filter(date => calendarDay(date) !== null).sort()
  const years = counted.map(row => row.date).filter(date => calendarDay(date) !== null).map(date => Number(date.slice(0, 4)))
  const yearCounts = new Map<number, number>()
  for (const row of rows) if (calendarDay(row.date) !== null) {
    const year = Number(row.date.slice(0, 4))
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + row.weight)
  }
  const byYear: Figures['byYear'] = []
  if (years.length) {
    const first = years.reduce((a, b) => Math.min(a, b)), last = years.reduce((a, b) => Math.max(a, b))
    for (let year = first; year <= last; year++) byYear.push({ key: String(year).padStart(4, '0'), year, flights: yearCounts.get(year) ?? 0 })
  }
  let share: Figures['share'] = null
  if (!filter.period && !unfiltered) {
    const all = totals(counted)
    const ratio = (value: number, total: number) => total > 0 ? Math.max(0, Math.min(1, value / total)) : 0
    share = { flights: ratio(scopeTotals.flights, all.flights), distanceKm: ratio(scopeTotals.distanceKm, all.distanceKm),
      durationMinutes: ratio(scopeTotals.durationMinutes, all.durationMinutes), countries: ratio(countries.size, payload.passport.countries),
      airports: ratio(airports, new Set(counted.flatMap(row => [row.origin, row.destination])).size) }
  }
  return {
    ...scopeTotals, firstDate: dates[0] ?? null, airports, byYear, share,
    estimatedFlights: rows.reduce((sum, row) => sum + (row.durationSource === 'estimate' ? row.weight : 0), 0),
    equatorLaps: scopeTotals.distanceKm / 40075,
    awaiting: rows.reduce((sum, row) => sum + (row.state === 'awaiting' ? row.weight : 0), 0),
    durationApproximate: rows.some(row => row.durationSource === 'estimate' && row.durationMinutes !== null &&
      Number.isFinite(row.durationMinutes) && row.durationMinutes >= 0),
    countries: { value: unfiltered ? payload.passport.countries : countries.size, source: unfiltered ? 'passport' : 'by_air' },
    regions: unfiltered ? payload.passport.regions : regions.size,
    deltas,
  }
}

export function coverage(rows: OverviewRow[]): Coverage {
  return rows.reduce((sum, row) => ({
    total: sum.total + row.weight,
    typed: sum.typed + (row.aircraft ? row.weight : 0),
    withDepartureTime: sum.withDepartureTime + (row.depMinute !== null && Number.isFinite(row.depMinute) &&
      row.depMinute >= 0 && row.depMinute < 1440 ? row.weight : 0),
    withBothTz: sum.withBothTz + (row.originTz && row.destTz ? row.weight : 0),
    preciseDuration: sum.preciseDuration + (hasPreciseDuration(row) ? row.weight : 0),
  }), { total: 0, typed: 0, withDepartureTime: 0, withBothTz: 0, preciseDuration: 0 })
}

export function home(rows: OverviewRow[], payload: OverviewPayload): OverviewScope['home'] {
  if (!rows.length) return null
  const override = payload.homeOverride
  const airport = override ? payload.refs.airports[override] : undefined
  if (override && airport && (airport.lat !== null || airport.lon !== null || airport.country !== null ||
      airport.city !== null || airport.name !== override)) return { iata: override, source: 'override' }
  const departures = new Map<string, number>()
  for (const row of rows) departures.set(row.origin, (departures.get(row.origin) ?? 0) + row.weight)
  const [iata] = [...departures].sort(([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : a > b ? 1 : 0))[0]
  return { iata, source: 'most_departed' }
}
