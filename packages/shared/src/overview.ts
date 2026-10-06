/** Compact, owner-only Overview read contract (C6). Top lists have 5 items, months 12,
 * and countryIds and map.countries at most 512 reference codes. Flight totals and countryIds use
 * completed flights in the selected period, including when period is "all".
 * Undated claims and ground visits, and legacy visit evidence without a flight,
 * remain Passport evidence; they are not assigned to a flight period. The one exception
 * is the unfiltered all-time country figure, which reads the published country evidence and
 * therefore includes legacy-only countries, as Passport does (ADR 0001 §4).
 */
export type OverviewPeriod = 'all' | `${number}`

/** One metric against the previous year. `percent` is null when `previous` is zero: no percentage of nothing. */
export interface OverviewDelta {
  previous: number
  /** current - previous; the absolute difference clients show when the percentage is omitted. */
  delta: number
  /** Whole percent change, rounded half away from zero; null when `previous` is 0. */
  percent: number | null
}

/** One country in the period with its visit count (Σ airport visits after the transit policy) for the map buckets. */
export interface OverviewMapCountry {
  id: string
  visits: number
  /**
   * The account-wide published C3 status (ADR 0001 section 4), not a statement about the period's own flights: only
   * awaiting evidence supports the country anywhere in the account, so it is counted as waiting, never as a pressed
   * stamp. A country whose only flight this year is awaiting is still pressed if a logged flight, a claim, ground
   * evidence or an archived visit supports it in another period. Membership and `visits` are period-specific.
   */
  pending: boolean
}

export interface OverviewRegion {
  id: string
  total: number
  /** Distinct period countries whose account-wide C3 status is pressed (membership of the period set is period-specific). */
  pressed: number
  /** Distinct period countries whose account-wide C3 status is pending (only awaiting evidence supports them anywhere). */
  pending: number
}

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
  /**
   * True when the unfiltered all-time country figure includes at least one contributing archived (legacy) visit record
   * (ADR 0001 section 4, open item 8). Always false for year periods and filtered reads, which never read archived
   * evidence, and for an account whose country evidence comes from flights alone. It is account provenance, so it is
   * reported even while `countryState` is `updating`; clients only state it for a ready, all-time figure.
   */
  archivedEvidence: boolean
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
    /** Of `countries` (the period's set), how many have the account-wide C3 status pending, i.e. only awaiting evidence anywhere (waiting for a stamp); null while updating. */
    pendingCountries: number | null
    upcomingFlights: number
  }
  /**
   * Year periods only (null for `all`): the previous calendar year with the same completed-flight rules.
   * `firstYear` is true when the account has no completed flight before the selected year, so a zero baseline can read
   * as "first year" rather than as growth from nothing. `countries` is null while the country evidence is updating.
   */
  comparison: {
    previousPeriod: string
    firstYear: boolean
    flights: OverviewDelta
    distanceKm: OverviewDelta
    durationMinutes: OverviewDelta
    countries: OverviewDelta | null
  } | null
  /**
   * How much of the period has a known value, so unknown is never shown as a genuine zero: `durationKnown` and
   * `distanceKnown` count completed period flights with a stored value; `missingAircraft` counts those without an aircraft.
   */
  dataAvailability: {
    flights: number
    durationKnown: number
    distanceKnown: number
    missingAircraft: number
  }
  /** Compact summary for the light SVG mini map; route geometry is fetched only when a route layer opens. */
  map: {
    /** Period countries with visit counts, bounded by `countryIds`' limit; empty while updating. */
    countries: OverviewMapCountry[]
    /** Distinct airport pairs (direction ignored) flown in the period. */
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
    /** Top airline of the period when it flew at least two flights (count ties break by IATA); null otherwise. */
    favoriteAirline: { id: string; count: number } | null
    /**
     * Year periods only (null for `all`, where every country would be new): countries in the period whose earliest
     * non-transit evidence across all time falls inside it. A repeat visit is never new again. `items` holds at most 12,
     * ordered by first visit then code; `count` is exact. Null while the country evidence is updating.
     */
    newCountries: { count: number; items: Array<{ id: string; firstVisit: string; pending: boolean }> } | null
  }
  topLists: {
    airlines: Array<{ id: string; count: number }>
    airports: Array<{ id: string; count: number }>
    aircraft: Array<{ id: string; count: number }>
    countries: Array<{ id: string; count: number }>
    /** Aircraft manufacturers (reference data) of the period's flights that have a known aircraft. */
    manufacturers: Array<{ id: string; count: number }>
  }
  /** Calendar years with completed flights, newest first (the Overview period options). */
  years: number[]
  /** Six collection-region chips over the period's countries; null while the country evidence is updating. */
  regions: OverviewRegion[] | null
  /** Twelve months of completed flights: January to December of a year period, the last 12 calendar months (UTC) for `all`. */
  months: Array<{ month: string; flights: number }>
  /** Distinct airport-reference country codes reached by completed period flights. */
  countryIds: string[]
}

/** Flights the missing-aircraft review loads per page (`GET /api/me/overview/missing-aircraft`). */
export const MISSING_AIRCRAFT_PAGE = 100

/** One flight in the missing-aircraft review: completed, owned, in the period, with no aircraft recorded. */
export interface MissingAircraftFlight {
  id: number
  flight_number: string | null
  airline_iata: string | null
  date: string
  origin: string
  destination: string
}

/**
 * One keyset page of the set `dataAvailability.missingAircraft` counts (same owner and completed-period predicate),
 * newest first (date, then id, descending). `total` is the exact size of the whole set, not of the page. Pass
 * `nextCursor` as `after` for the following page; it is null on the last page. A page never exceeds `limit` (at most 100).
 */
export interface MissingAircraftPage {
  period: OverviewPeriod
  total: number
  limit: number
  /** Flights of the set ordered before this page (0 on the first page), so a client can say "n-m of total" exactly. */
  offset: number
  flights: MissingAircraftFlight[]
  nextCursor: string | null
}
