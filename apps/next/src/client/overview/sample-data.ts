// Static sample data for the first-run preview. It is never fetched, cached or merged into a real summary: the
// preview component is the only consumer, and it renders inert and labelled as an example.
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'

const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  .map((month, index) => ({ month, flights: [1, 3, 0, 2, 1, 0, 2, 4, 1, 0, 2, 3][index] }))

export const SAMPLE_SUMMARY: OverviewSummary = Object.freeze({
  schemaVersion: 1,
  period: 'all',
  revision: 0,
  publishedRevision: 0,
  derivedState: 'ready',
  countryState: 'ready',
  regionPolicyVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  totals: { flights: 19, distanceKm: 61200, durationMinutes: 4380, countries: 5, cities: 7, airports: 8, airlines: 3, aircraft: 4, continents: 3, pendingCountries: 0, upcomingFlights: 0 },
  comparison: null,
  dataAvailability: { flights: 19, durationKnown: 19, distanceKnown: 19, missingAircraft: 0 },
  map: { routeCount: 9, countries: [
    { id: 'US', visits: 8, pending: false }, { id: 'GB', visits: 4, pending: false }, { id: 'JP', visits: 3, pending: false },
    { id: 'FR', visits: 2, pending: false }, { id: 'AU', visits: 1, pending: false },
  ] },
  nextFlight: null,
  insights: {
    longestFlight: { origin: 'JFK', destination: 'SYD', distanceKm: 15989 },
    mostFrequentRoute: { origin: 'JFK', destination: 'LHR', count: 4 },
    favoriteAirline: { id: 'BA', count: 7 },
    newCountries: null,
  },
  topLists: {
    airlines: [{ id: 'BA', count: 7 }, { id: 'DL', count: 6 }, { id: 'JL', count: 3 }],
    airports: [{ id: 'JFK', count: 12 }, { id: 'LHR', count: 6 }, { id: 'HND', count: 3 }, { id: 'CDG', count: 2 }, { id: 'SYD', count: 1 }],
    aircraft: [{ id: 'B77W', count: 8 }, { id: 'A359', count: 5 }, { id: 'B788', count: 3 }],
    countries: [{ id: 'US', count: 8 }, { id: 'GB', count: 4 }, { id: 'JP', count: 3 }],
    manufacturers: [{ id: 'Boeing', count: 11 }, { id: 'Airbus', count: 5 }],
  },
  years: [2026, 2025],
  regions: [
    { id: 'africa', total: 58, pressed: 0, pending: 0 }, { id: 'americas', total: 54, pressed: 1, pending: 0 }, { id: 'asia', total: 52, pressed: 1, pending: 0 },
    { id: 'europe', total: 51, pressed: 2, pending: 0 }, { id: 'oceania', total: 28, pressed: 1, pending: 0 }, { id: 'antarctica', total: 3, pressed: 0, pending: 0 },
  ],
  months,
  countryIds: ['AU', 'FR', 'GB', 'JP', 'US'],
}) as OverviewSummary
