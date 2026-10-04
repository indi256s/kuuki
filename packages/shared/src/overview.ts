/** Compact, owner-only Overview read contract. Collections have fixed upper bounds. */
export type OverviewPeriod = 'all' | `${number}`

export interface OverviewSummary {
  schemaVersion: 1
  period: OverviewPeriod
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
  generatedAt: string
  totals: {
    flights: number
    distanceKm: number
    durationMinutes: number
    countries: number
    cities: number
    airports: number
    airlines: number
    aircraft: number
    continents: number
    upcomingFlights: number
  }
  nextFlight: {
    id: number
    date: string
    origin: string
    destination: string
    airlineIata: string | null
    flightNumber: string | null
  } | null
  insights: {
    longestFlight: { origin: string; destination: string; distanceKm: number } | null
    mostFrequentRoute: { origin: string; destination: string; count: number } | null
  }
  topLists: {
    airlines: Array<{ id: string; count: number }>
    airports: Array<{ id: string; count: number }>
    aircraft: Array<{ id: string; count: number }>
    countries: Array<{ id: string; count: number }>
  }
  months: Array<{ month: string; flights: number }>
  countryIds: string[]
}
