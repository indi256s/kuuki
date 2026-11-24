export type ThemeColor =
  | 'teal'
  | 'red'
  | 'coral'
  | 'olive'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'blue'
  | 'gray'
  | 'green'

export interface Profile {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  homeAirport: string | null
  isPublic: boolean
  showOnLeaderboards: boolean
  themeColor: ThemeColor
  createdAt: string
  updatedAt: string
}

export interface UserStats {
  userId: string
  totalFlights: number
  totalDistanceKm: number
  countriesCount: number
  citiesCount: number
  airlinesCount: number
  aircraftCount: number
  continentsCount: number
  longestFlightMinutes: number
  hasNightDeparture: boolean
  updatedAt: string
}

export interface PublicProfile {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  themeColor: ThemeColor
  isPublic: boolean
  showOnLeaderboards: boolean
  stats: UserStats | null
  badges: UserBadge[]
  rankings: LeaderboardRanking[]
  memberSince: string
}

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'

export type DurationSource = 'times' | 'route_median' | 'schedule' | 'estimate'

export interface Flight {
  id: number
  userId: string
  flightNumber: string | null
  date: string
  departureTime: string | null
  arrivalTime: string | null
  origin: string
  destination: string
  airlineIata: string | null
  aircraftIcao: string | null
  distanceKm: number | null
  durationMinutes: number | null
  durationSource: DurationSource | null
  zonesOverflown: number | null
  source: 'manual' | 'ai_import'
  enrichmentStatus: EnrichmentStatus | null
  createdAt: string
}

export type OwnFlight = {
  id: number
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  aircraft_icao: string | null
  flight_number: string | null
  departure_time: string | null
  arrival_time: string | null
  departure_utc: string | null
  arrival_utc: string | null
  origin_tz: string | null
  dest_tz: string | null
  distance_km: number | null
  duration_minutes: number | null
  readonly duration_source: DurationSource | null
  readonly zones_overflown: number | null
  source: string
  is_upcoming: boolean
  enrichment_status: string
  created_at: string
  lifecycle_state: 'upcoming' | 'awaiting' | 'logged'
  confirmation_source: 'save' | 'user' | 'automatic' | 'legacy' | null
  confirmed_at: string | null
  lifecycle_timezone: string | null
  awaiting_after: string | null
  auto_confirm_after: string | null
  arrival_transit: boolean | null
  arrival_transit_leg_id: number | null
}

export interface Visit {
  userId: string
  countryCode: string
  countryName: string
  city: string | null
  airportIata: string | null
  firstVisit: string
  lastVisit: string
  visitCount: number
}

export type LeaderboardCategory = 'countries' | 'cities' | 'flights' | 'distance' | 'airlines'

export interface LeaderboardEntry {
  category: LeaderboardCategory
  userId: string
  rank: number
  value: number
  percentile: number
  metadata: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

export interface LeaderboardRanking {
  category: LeaderboardCategory
  rank: number
  value: number
  percentile: number
}

export type BadgeCategory =
  | 'flights'
  | 'distance'
  | 'airlines'
  | 'aircraft'
  | 'achievement'
  | 'secret'

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null

export interface Badge {
  id: number
  code: string
  name: string
  description: string
  category: BadgeCategory
  icon: string
  tier: BadgeTier
  points: number
  isSecret: boolean
  flavorText?: string
}

export interface UserBadge {
  userId: string
  badgeId: number
  earnedAt: string
  badge: Badge
}

export interface Airport {
  iata: string
  icao: string | null
  name: string
  city: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  timezone: string
}

export interface Airline {
  iata: string
  icao: string | null
  name: string
  country: string
  logoUrl: string | null
  logoDarkUrl?: string | null
  primaryColor: string | null
  alliance: 'star_alliance' | 'oneworld' | 'skyteam' | null
  callsign: string | null
}

export interface Aircraft {
  icao: string
  iata: string | null
  manufacturer: string
  model: string
  family: string
  name: string
  type: AircraftType
  engineType: EngineType
  engineCount: number
  capacity: number | null
}

export type AircraftType =
  | 'widebody'
  | 'narrowbody'
  | 'regional'
  | 'bizjet'
  | 'turboprop'
  | 'piston'
export type EngineType = 'jet' | 'turboprop' | 'piston'

export type Continent = 'europe' | 'asia' | 'americas' | 'africa' | 'oceania' | 'antarctica'

export type StampShape = 'circle' | 'rectangle'

export type EntryMethod = 'air' | 'land' | 'sea' | null

export type GroundVisitMode = 'rail' | 'road' | null

export interface CountryData {
  name: string
  nativeName: string
  continent: Continent
  flagColors: string[]
  dominantColor: string
  stampShape: StampShape
  timezone: string
}

export interface CountryClaim {
  id: string
  userId: string
  countryCode: string
  claimedAt: string
}

export interface GroundVisit {
  id: string
  userId: string
  countryCode: string
  visitYear: number | null
  entryMethod: EntryMethod
  mode: GroundVisitMode
  linkedFlightId?: number | null
  note: string | null
  createdAt: string | null
}

export interface PassportEntry {
  countryCode: string
  countryName: string
  nativeName: string
  continent: Continent
  stampShape: StampShape
  dominantColor: string
  flagColors: string[]
  firstVisit: string
  lastVisit: string
  visitCount: number
  source: 'flight' | 'claim' | 'both'
  airports: string[]
}

export interface CountryStats {
  countryCode: string
  countryName: string
  firstVisit: string
  lastVisit: string
  totalVisits: number
  airports: Array<{
    iata: string
    name: string
    city: string
    visitCount: number
  }>
  isClaimed: boolean
  groundVisits: GroundVisit[]
}

export interface ExtendedUserStats extends UserStats {
  timeZonesCount: number
  mostVisitedCountry: string | null
  mostVisitedCount: number
  worldCompletionPct: number
}
