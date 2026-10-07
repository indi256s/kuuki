import { isEmptyFilter, rowCountries } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'
import type { Records } from './records'
import type { Crossings } from './crossings'
import type { Fleet } from './fleet'
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
  clock: Gate<Clock>
  rhythm: Gate<Rhythm>
  rankings: Rankings
  globe: GlobeData
}

const metric = (value: number | null): number => value !== null && Number.isFinite(value) && value >= 0 ? value : 0

export function hasPreciseDuration(row: OverviewRow): boolean {
  return row.durationMinutes !== null && Number.isFinite(row.durationMinutes) && row.durationMinutes >= 0 &&
    row.durationSource !== null && row.durationSource !== 'estimate'
}

export function totals(rows: OverviewRow[]): NonNullable<Figures['deltas']> {
  return rows.reduce((sum, row) => ({
    flights: sum.flights + row.weight,
    distanceKm: sum.distanceKm + metric(row.distanceKm),
    durationMinutes: sum.durationMinutes + metric(row.durationMinutes),
  }), { flights: 0, distanceKm: 0, durationMinutes: 0 })
}

export function figures(rows: OverviewRow[], payload: OverviewPayload, filter: OverviewFilter,
  deltas: Figures['deltas']): Figures {
  const countries = new Set(rows.flatMap(row => rowCountries(row, payload.refs)))
  const regions = new Set([...countries].map(country => payload.refs.regions[country]).filter(Boolean))
  const unfiltered = isEmptyFilter(filter)
  return {
    ...totals(rows), awaiting: rows.reduce((sum, row) => sum + (row.state === 'awaiting' ? row.weight : 0), 0),
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
