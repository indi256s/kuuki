/** Compact, owner-only Overview read contract. Top lists have 5 items, months 12,
 * and countryIds at most 512 reference codes. Flight totals and countryIds use
 * completed flights in the selected period, including when period is "all".
 * Undated claims and ground visits, and legacy visit evidence without a flight,
 * remain Passport evidence; they are not assigned to a flight period. The one exception
 * is the unfiltered all-time country figure, which reads the published country evidence and
 * therefore includes legacy-only countries, as Passport does (ADR 0001 §4).
 */
export type OverviewPeriod = 'all' | `${number}`

export interface OverviewSummary {
  schemaVersion: 1
  period: OverviewPeriod
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
  /**
   * Country figures (`totals.countries`, `totals.continents`, `countryIds`, `topLists.countries`) come from the published
   * country evidence only. They are `updating` (null/empty, never a mixed figure) while a repair is pending or the evidence
   * stamp is stale (ADR 0001 §4, §10).
   */
  countryState: 'ready' | 'updating'
  /** Version of the six-region catalog policy behind `totals.continents`. */
  regionPolicyVersion: number
  generatedAt: string
  totals: {
    flights: number
    distanceKm: number
    durationMinutes: number
    /** Flight and legacy countries after the transit policy; null while `countryState` is `updating`. */
    countries: number | null
    cities: number
    airports: number
    airlines: number
    aircraft: number
    /** Distinct catalog collection regions among `countries`; null while updating. */
    continents: number | null
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
