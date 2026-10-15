import { DAY_MS, dayToEpoch, epochToDay, periodDays } from './range'
import { allianceAt } from '../../../data/src/alliance-membership'
import { makerOf } from '../../../data/src/aircraft-makers'
import {
  BAND_START_HOUR,
  HAUL_KM,
  type DepartureBand,
  type Haul,
  type OverviewFilter,
  type OverviewGroundJourney,
  type OverviewPayload,
  type OverviewRow,
  type TravelScope,
} from './model'

type Refs = OverviewPayload['refs']

export const routeKey = (a: string, b: string): string => [a, b].sort().join('-')
/** An undirected route key for display: `LHR-TBS` → `LHR ↔ TBS`. */
export const routeArrow = (key: string): string => key.replace('-', ' ↔ ')
export const haulOf = (km: number): Haul =>
  km < HAUL_KM.medium ? 'short' : km < HAUL_KM.long ? 'medium' : 'long'

export function bandOf(depMinute: number): DepartureBand {
  const hour = depMinute / 60
  if (hour < BAND_START_HOUR.morning || hour >= BAND_START_HOUR.night) return 'night'
  if (hour < BAND_START_HOUR.afternoon) return 'morning'
  return hour < BAND_START_HOUR.evening ? 'afternoon' : 'evening'
}

export function rowCountries(row: OverviewRow, refs: Refs): string[] {
  const countries: string[] = []
  const origin = refs.airports[row.origin]?.country
  const destination = refs.airports[row.destination]?.country
  if (!(row.suppressed & 1) && origin) countries.push(origin)
  if (!(row.suppressed & 2) && destination) countries.push(destination)
  return [...new Set(countries)]
}

function monthIndex(month: string): number | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) return null
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1
}

/** Calendar month (1–12) of a `YYYY-MM-DD` day; legacy month rows may carry `YYYY-MM`. Null when unparseable. */
export function monthOfYear(date: string): number | null {
  if (monthIndex(date) !== null) return Number(date.slice(5))
  return dayToEpoch(date) === null ? null : Number(date.slice(5, 7))
}

const has = <T>(values: readonly T[] | undefined, value: T | null | undefined) =>
  !values?.length || (value != null && values.includes(value))

/** Whether a `YYYY-MM-DD` day (legacy rows may carry `YYYY-MM`) falls in the period; no period admits every day. */
function inPeriod(day: string | null, period: OverviewFilter['period']): boolean {
  if (!period) return true
  if ('years' in period)
    return (
      !period.years.length ||
      (day !== null &&
        monthIndex(day.slice(0, 7)) !== null &&
        period.years.includes(Number(day.slice(0, 4))))
    )
  const days = periodDays(period)
  return !!days && day !== null && dayToEpoch(day) !== null && day >= days.from && day <= days.to
}

export function matches(row: OverviewRow, filter: OverviewFilter, refs: Refs): boolean {
  if (!inPeriod(row.date, filter.period)) return false
  const countries = filter.countries,
    regions = filter.regions
  if (countries?.length || regions?.length) {
    const evidence = rowCountries(row, refs)
    if (countries?.length && !evidence.some((country) => countries.includes(country))) return false
    if (regions?.length && !evidence.some((country) => regions.includes(refs.regions[country])))
      return false
  }
  const airports = filter.airports
  if (airports?.length && ![row.origin, row.destination].some((code) => airports.includes(code)))
    return false
  const aircraft = row.aircraft === null ? undefined : refs.aircraft[row.aircraft]
  if (
    !has(filter.airlines, row.airline) ||
    !has(filter.aircraft, row.aircraft) ||
    !has(filter.routes, routeKey(row.origin, row.destination)) ||
    !has(filter.alliances, allianceAt(row.airline, row.date)) ||
    !has(filter.families, aircraft?.family) ||
    !has(filter.makers, makerOf(row.aircraft))
  )
    return false
  const body =
    aircraft?.type === 'widebody'
      ? 'wide'
      : ['narrowbody', 'regional', 'bizjet', 'turboprop', 'piston'].includes(aircraft?.type ?? '')
        ? 'narrow'
        : null
  if (!has(filter.bodies, body)) return false
  for (const [hours, minute] of [
    [filter.depHours, row.depMinute],
    [filter.arrHours, row.arrMinute],
  ] as const) {
    if (
      hours?.length &&
      (minute === null ||
        !Number.isFinite(minute) ||
        minute < 0 ||
        minute > 1439 ||
        !hours.includes(Math.floor(minute / 60)))
    )
      return false
  }
  if (filter.months?.length) {
    const month = monthOfYear(row.date)
    if (month === null || !filter.months.includes(month)) return false
  }
  if (filter.haul?.length) {
    const km = row.distanceKm === null ? null : row.distanceKm / row.weight
    if (
      km === null ||
      !Number.isFinite(km) ||
      km < 0 ||
      row.weight <= 0 ||
      !filter.haul.includes(haulOf(km))
    )
      return false
  }
  if (filter.domestic?.length) {
    const origin = refs.airports[row.origin]?.country,
      destination = refs.airports[row.destination]?.country
    if (
      !origin ||
      !destination ||
      !filter.domestic.includes(origin === destination ? 'domestic' : 'international')
    )
      return false
  }
  if (filter.departureBands?.length) {
    const minute = row.depMinute
    if (
      minute === null ||
      !Number.isFinite(minute) ||
      minute < 0 ||
      minute >= 1440 ||
      !filter.departureBands.includes(bandOf(minute))
    )
      return false
  }
  return true
}

const NON_AVIATION_KEYS = new Set(['period', 'scope', 'countries', 'regions'])

/** True when any facet beyond countries/regions is set: ground journeys carry no aviation evidence to match. */
export function hasAviationFacet(filter: OverviewFilter): boolean {
  return Object.entries(filter).some(
    ([key, values]) => !NON_AVIATION_KEYS.has(key) && !!(values as unknown[] | undefined)?.length,
  )
}

/** Ground journeys match by `startDate ?? endDate`, with the same period rules as flight dates. */
export function groundMatches(
  journey: OverviewGroundJourney,
  filter: OverviewFilter,
  refs: Refs,
): boolean {
  if (hasAviationFacet(filter)) return false
  if (!inPeriod(journey.startDate ?? journey.endDate, filter.period)) return false
  const { countries, regions } = filter
  if (countries?.length && !journey.countries.some((country) => countries.includes(country)))
    return false
  if (
    regions?.length &&
    !journey.countries.some((country) => regions.includes(refs.regions[country]))
  )
    return false
  return true
}

/** The scope that actually applies: a stored scope is ignored while the payload has no ground journeys. */
export function effectiveScope(
  payload: Pick<OverviewPayload, 'ground'>,
  filter: OverviewFilter,
): 'all' | TravelScope {
  return filter.scope && payload.ground.length > 0 ? filter.scope : 'all'
}

/** Ground journeys the scope and filter admit, planned included; none under the flights scope. */
export function scopedGround(
  payload: Pick<OverviewPayload, 'ground' | 'refs'>,
  filter: OverviewFilter,
  scope: 'all' | TravelScope,
): OverviewGroundJourney[] {
  return scope === 'flights'
    ? []
    : payload.ground.filter((journey) => groundMatches(journey, filter, payload.refs))
}

export function previousPeriod(filter: OverviewFilter): OverviewFilter | null {
  const period = filter.period
  if (!period) return null
  if ('years' in period) {
    const years = [...new Set(period.years)].sort((a, b) => a - b)
    if (
      !years.length ||
      years.some(
        (year, i) =>
          !Number.isInteger(year) ||
          year < 0 ||
          year > 9999 ||
          (i > 0 && year !== years[i - 1] + 1),
      )
    )
      return null
    if (years[0] < years.length) return null
    return { ...filter, period: { years: years.map((year) => year - years.length) } }
  }
  if (period.from.length !== 7 || period.to.length !== 7) {
    const days = periodDays(period)
    if (!days) return null
    const start = dayToEpoch(days.from)!,
      end = dayToEpoch(days.to)!
    const from = epochToDay(start - (end - start + DAY_MS)),
      to = epochToDay(start - DAY_MS)
    return from && to ? { ...filter, period: { from, to } } : null
  }
  const from = monthIndex(period.from),
    to = monthIndex(period.to)
  if (from === null || to === null || from > to) return null
  const length = to - from + 1
  if (from < length) return null
  const label = (index: number) =>
    `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
  return { ...filter, period: { from: label(from - length), to: label(from - 1) } }
}

export function isEmptyFilter(filter: OverviewFilter): boolean {
  const { period } = filter
  return (
    (!period || ('years' in period && period.years.length === 0)) &&
    Object.entries(filter).every(
      ([key, values]) => key === 'period' || key === 'scope' || !(values as unknown[])?.length,
    )
  )
}
