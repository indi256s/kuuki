export type OverviewPeriod = 'all' | `${number}`

export interface OverviewDelta {
  previous: number
  delta: number
  percent: number | null
}

export interface OverviewMapCountry {
  id: string
  visits: number
  pending: boolean
}

export interface OverviewRegion {
  id: string
  total: number
  pressed: number
  pending: number
}

export interface OverviewSummary {
  schemaVersion: 1
  period: OverviewPeriod
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
  countryState: 'ready' | 'updating'
  archivedEvidence: boolean
  regionPolicyVersion: number
  generatedAt: string
  totals: {
    flights: number
    distanceKm: number
    durationMinutes: number
    countries: number | null
    cities: number
    airports: number
    airlines: number
    aircraft: number
    continents: number | null
    pendingCountries: number | null
    upcomingFlights: number
  }
  comparison: {
    previousPeriod: string
    firstYear: boolean
    flights: OverviewDelta
    distanceKm: OverviewDelta
    durationMinutes: OverviewDelta
    countries: OverviewDelta | null
  } | null
  dataAvailability: {
    flights: number
    durationKnown: number
    distanceKnown: number
    missingAircraft: number
  }
  map: {
    countries: OverviewMapCountry[]
    routeCount: number
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
    favoriteAirline: { id: string; count: number } | null
    newCountries: {
      count: number
      items: Array<{ id: string; firstVisit: string; pending: boolean }>
    } | null
  }
  topLists: {
    airlines: Array<{ id: string; count: number }>
    airports: Array<{ id: string; count: number }>
    aircraft: Array<{ id: string; count: number }>
    countries: Array<{ id: string; count: number }>
    manufacturers: Array<{ id: string; count: number }>
  }
  years: number[]
  regions: OverviewRegion[] | null
  months: Array<{ month: string; flights: number }>
  countryIds: string[]
}

export const MISSING_AIRCRAFT_PAGE = 100

export interface MissingAircraftFlight {
  id: number
  flight_number: string | null
  airline_iata: string | null
  date: string
  origin: string
  destination: string
}

export interface MissingAircraftPage {
  period: OverviewPeriod
  total: number
  limit: number
  offset: number
  flights: MissingAircraftFlight[]
  nextCursor: string | null
}
