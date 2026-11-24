import type {
  OverviewDelta,
  OverviewMapCountry,
  OverviewSummary,
} from '../../../packages/shared/src/overview'

export const NEW_COUNTRY_ITEMS = 12

export function overviewDelta(current: number, previous: number): OverviewDelta {
  const delta = current - previous
  return {
    previous,
    delta,
    percent:
      previous > 0 ? Math.sign(delta) * Math.round((Math.abs(delta) / previous) * 100) : null,
  }
}

export interface PeriodTotals {
  flights: number
  distanceKm: number
  durationMinutes: number
  countries: number | null
}

export function overviewComparison(
  period: string,
  current: PeriodTotals,
  previous: PeriodTotals,
  earlierFlights: boolean,
): OverviewSummary['comparison'] {
  if (period === 'all') return null
  return {
    previousPeriod: String(Number(period) - 1),
    firstYear: !earlierFlights,
    flights: overviewDelta(current.flights, previous.flights),
    distanceKm: overviewDelta(current.distanceKm, previous.distanceKm),
    durationMinutes: overviewDelta(current.durationMinutes, previous.durationMinutes),
    countries:
      current.countries === null || previous.countries === null
        ? null
        : overviewDelta(current.countries, previous.countries),
  }
}

export function favoriteAirline(
  airlines: Array<{ id: string; count: number }>,
): { id: string; count: number } | null {
  const top = airlines[0]
  return top && top.count >= 2 ? { id: top.id, count: top.count } : null
}

export interface FirstVisitRow {
  id: string
  first_visit: string
  status: 'pressed' | 'pending'
}

export function newCountriesIn(
  period: string,
  evidence: FirstVisitRow[],
  periodCountries: OverviewMapCountry[],
): OverviewSummary['insights']['newCountries'] {
  if (period === 'all') return null
  const inPeriod = new Set(periodCountries.map((country) => country.id))
  const items = evidence
    .filter((row) => row.first_visit.slice(0, 4) === period && inPeriod.has(row.id))
    .sort((a, b) => a.first_visit.localeCompare(b.first_visit) || a.id.localeCompare(b.id))
    .map((row) => ({ id: row.id, firstVisit: row.first_visit, pending: row.status === 'pending' }))
  return { count: items.length, items: items.slice(0, NEW_COUNTRY_ITEMS) }
}
