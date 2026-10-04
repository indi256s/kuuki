/** Compact, owner-only Overview read contract. Top lists have 5 items, months 12,
 * and countryIds at most 512 reference codes. Flight totals and countryIds use
 * completed flights in the selected period, including when period is "all".
 * Undated claims and ground visits, and legacy visit evidence without a flight,
 * remain Passport evidence; they are not assigned to a flight period.
 */
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
  /** Distinct airport-reference country codes reached by completed period flights. */
  countryIds: string[]
}
