// Overview summaries at every data volume, shared by the module tests and T18's acceptance. Plain data, no mocks.
import type { OverviewLabels } from './labels'
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'

const regions = (reached: Record<string, [number, number]> = {}): NonNullable<OverviewSummary['regions']> =>
  [['africa', 58], ['americas', 54], ['asia', 52], ['europe', 51], ['oceania', 28], ['antarctica', 3]]
    .map(([id, total]) => ({ id: id as string, total: total as number, pressed: reached[id as string]?.[0] ?? 0, pending: reached[id as string]?.[1] ?? 0 }))

const months = (period: string, flights: number[] = []) => Array.from({ length: 12 }, (_, i) => ({
  month: period === 'all' ? `${2025 + Math.floor((i + 10) / 12)}-${String((i + 10) % 12 + 1).padStart(2, '0')}` : `${period}-${String(i + 1).padStart(2, '0')}`,
  flights: flights[i] ?? 0,
}))

/** n=0: nothing flown, nothing upcoming. */
export function emptySummary(period: OverviewSummary['period'] = 'all', over: Partial<OverviewSummary> = {}): OverviewSummary {
  return {
    schemaVersion: 1, period, revision: 1, publishedRevision: 1, derivedState: 'ready', countryState: 'ready', archivedEvidence: false, regionPolicyVersion: 1,
    generatedAt: '2026-10-05T00:00:00.000Z',
    totals: { flights: 0, distanceKm: 0, durationMinutes: 0, countries: 0, cities: 0, airports: 0, airlines: 0, aircraft: 0, continents: 0, pendingCountries: 0, upcomingFlights: 0 },
    comparison: period === 'all' ? null : { previousPeriod: String(Number(period) - 1), firstYear: true,
      flights: { previous: 0, delta: 0, percent: null }, distanceKm: { previous: 0, delta: 0, percent: null }, durationMinutes: { previous: 0, delta: 0, percent: null }, countries: { previous: 0, delta: 0, percent: null } },
    dataAvailability: { flights: 0, durationKnown: 0, distanceKnown: 0, missingAircraft: 0 },
    map: { countries: [], routeCount: 0 },
    nextFlight: null,
    insights: { longestFlight: null, mostFrequentRoute: null, favoriteAirline: null, newCountries: period === 'all' ? null : { count: 0, items: [] } },
    topLists: { airlines: [], airports: [], aircraft: [], countries: [], manufacturers: [] },
    years: [], regions: regions(), months: months(period), countryIds: [],
    ...over,
  }
}

/** No flights, one published archived (legacy) visit: mirrors `legacyOnlyAccount()` in functions/test/overview-fixture.ts. */
export function legacyOnlySummary(): OverviewSummary {
  return emptySummary('all', {
    totals: { flights: 0, distanceKm: 0, durationMinutes: 0, countries: 1, cities: 0, airports: 0, airlines: 0, aircraft: 0, continents: 0, pendingCountries: 0, upcomingFlights: 0 },
    archivedEvidence: true,
    map: { countries: [{ id: 'AE', visits: 2, pending: false }], routeCount: 0 }, countryIds: ['AE'], regions: regions({ asia: [1, 0] }),
  })
}

/** n=1: one flight with nothing optional recorded. */
export function singleFlightSummary(period: OverviewSummary['period'] = '2026'): OverviewSummary {
  return emptySummary(period, {
    totals: { flights: 1, distanceKm: 0, durationMinutes: 0, countries: 2, cities: 2, airports: 2, airlines: 0, aircraft: 0, continents: 2, pendingCountries: 0, upcomingFlights: 0 },
    comparison: period === 'all' ? null : { previousPeriod: '2025', firstYear: true, flights: { previous: 0, delta: 1, percent: null }, distanceKm: { previous: 0, delta: 0, percent: null },
      durationMinutes: { previous: 0, delta: 0, percent: null }, countries: { previous: 0, delta: 2, percent: null } },
    dataAvailability: { flights: 1, durationKnown: 0, distanceKnown: 0, missingAircraft: 1 },
    map: { routeCount: 1, countries: [{ id: 'GE', visits: 1, pending: false }, { id: 'US', visits: 1, pending: false }] },
    insights: { longestFlight: null, mostFrequentRoute: { origin: 'TBS', destination: 'JFK', count: 1 }, favoriteAirline: null,
      newCountries: period === 'all' ? null : { count: 2, items: [{ id: 'GE', firstVisit: '2026-01-02', pending: false }, { id: 'US', firstVisit: '2026-01-02', pending: false }] } },
    topLists: { airlines: [], airports: [{ id: 'JFK', count: 1 }, { id: 'TBS', count: 1 }], aircraft: [], countries: [{ id: 'GE', count: 1 }, { id: 'US', count: 1 }], manufacturers: [] },
    years: [2026], regions: regions({ asia: [1, 0], americas: [1, 0] }), months: months(period, [1]), countryIds: ['GE', 'US'],
  })
}

/**
 * n=10 and n=500: an internally consistent account (checked by `fixtures.test.ts`): the year's months add up to its flights,
 * ranked counts never exceed what the flights can contribute, new countries are a subset of the period's countries, and
 * one country is pending, the longest flight fits inside the total distance and the unlisted airports still fit within
 * two endpoints per flight. `period: 'all'` keeps the same rankings with the last twelve months only.
 */
export function busySummary(flights: 10 | 500, period: OverviewSummary['period'] = '2026'): OverviewSummary {
  const k = flights / 10
  const monthly = [1, 1, 0, 3, 1, 0, 0, 1, 2, 1, 0, 0].map(count => count * k)
  return emptySummary(period, {
    totals: { flights, distanceKm: 18000 * k, durationMinutes: 600 * k, countries: 6, cities: 7, airports: 8, airlines: 5, aircraft: 3, continents: 4, pendingCountries: 1, upcomingFlights: 1 },
    comparison: period === 'all' ? null : { previousPeriod: '2025', firstYear: false, flights: { previous: flights * 2, delta: -flights, percent: -50 },
      distanceKm: { previous: 18000 * k * 2, delta: -18000 * k, percent: -50 }, durationMinutes: { previous: 1200 * k, delta: -600 * k, percent: -50 }, countries: { previous: 4, delta: 2, percent: 50 } },
    dataAvailability: { flights, durationKnown: flights - 2, distanceKnown: flights, missingAircraft: 3 * k },
    map: { routeCount: 7, countries: [
      { id: 'GE', visits: 2 * k + 1, pending: false }, { id: 'TR', visits: 3 * k, pending: false }, { id: 'US', visits: 2, pending: false },
      { id: 'GB', visits: 1, pending: false }, { id: 'JP', visits: 4 * k, pending: false }, { id: 'AU', visits: 1, pending: true }] },
    nextFlight: { id: 99, date: '2026-12-01', origin: 'TBS', destination: 'LHR', airlineIata: null, flightNumber: 'BA 123' },
    insights: { longestFlight: { origin: 'JFK', destination: 'SYD', distanceKm: 15989 }, mostFrequentRoute: { origin: 'TBS', destination: 'IST', count: 3 * k },
      favoriteAirline: { id: 'TK', count: 4 * k },
      newCountries: period === 'all' ? null : { count: 5, items: [
        { id: 'JP', firstVisit: '2026-01-01', pending: false }, { id: 'AU', firstVisit: '2026-02-01', pending: true }, { id: 'GB', firstVisit: '2026-03-01', pending: false },
        { id: 'US', firstVisit: '2026-04-01', pending: false }, { id: 'TR', firstVisit: '2026-05-01', pending: false }] } },
    topLists: {
      airlines: [{ id: 'TK', count: 4 * k }, { id: 'PC', count: 2 * k }, { id: 'BA', count: 2 * k }, { id: 'LH', count: k }, { id: 'AF', count: k }],
      airports: [{ id: 'IST', count: 6 * k }, { id: 'TBS', count: 5 * k }, { id: 'JFK', count: 3 * k }, { id: 'LHR', count: 2 * k }, { id: 'HND', count: k }],
      aircraft: [{ id: 'A320', count: 4 * k }, { id: 'B738', count: 2 * k }, { id: 'A359', count: k }],
      countries: [{ id: 'TR', count: 3 * k }, { id: 'GE', count: 2 * k }], manufacturers: [{ id: 'Airbus', count: 5 * k }, { id: 'Boeing', count: 2 * k }] },
    years: [2026, 2025, 2024, 2023, 2022, 2021, 2020], regions: regions({ asia: [3, 0], europe: [1, 0], americas: [1, 0], oceania: [0, 1] }),
    months: months(period, monthly), countryIds: ['AU', 'GB', 'GE', 'JP', 'TR', 'US'],
  })
}

/**
 * Deliberately NOT a consistent account: overflow and truncation cases only (more new countries than the list holds,
 * large numbers). Use it for layout and text-overflow checks, never as an acceptance account.
 */
export function stressSummary(period: OverviewSummary['period'] = '2026'): OverviewSummary {
  const base = busySummary(500, period)
  const ids = ['JP', 'AU', 'GB', 'US', 'TR', 'GE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL']
  return {
    ...base,
    totals: { ...base.totals, flights: 12345, distanceKm: 9876543, durationMinutes: 654321 },
    insights: { ...base.insights, newCountries: period === 'all' ? null : { count: 14, items: ids.map((id, i) => ({ id, firstVisit: `2026-0${1 + i % 9}-01`, pending: i === 1 })) } },
  }
}

/** Readable stand-ins for reference lookups, so assertions do not depend on bundled data. */
export const fakeLabels: OverviewLabels = {
  airline: code => `Airline ${code}`, aircraft: icao => `Aircraft ${icao}`, airport: iata => `${iata} · City ${iata}`, country: code => `Country ${code}`,
}
