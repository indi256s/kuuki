// Theme color options for profiles
export type ThemeColor = 'teal' | 'red' | 'coral' | 'olive' | 'yellow' | 'orange' | 'purple' | 'blue' | 'gray' | 'green'

// User profile
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

// User stats (denormalized for performance)
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

// Public profile data (for /fly/:username pages)
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

// Flight record
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
  source: 'manual' | 'ai_import'
  createdAt: string
}

// Visited place (computed from flights)
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

// Leaderboard categories
export type LeaderboardCategory = 'countries' | 'cities' | 'flights' | 'distance' | 'airlines'

// Leaderboard entry
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

// User's ranking in a specific category
export interface LeaderboardRanking {
  category: LeaderboardCategory
  rank: number
  value: number
  percentile: number
}

// Badge categories
export type BadgeCategory = 'flights' | 'distance' | 'airlines' | 'aircraft' | 'achievement' | 'secret'

// Badge tiers
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null

// Badge definition
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

// User's earned badge
export interface UserBadge {
  userId: string
  badgeId: number
  earnedAt: string
  badge: Badge
}

// Airport reference
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

// Airline reference
export interface Airline {
  iata: string
  icao: string | null
  name: string
  country: string
  logoUrl: string | null
  primaryColor: string | null
  alliance: 'star_alliance' | 'oneworld' | 'skyteam' | null
  callsign: string | null
}

// Aircraft reference
export interface Aircraft {
  icao: string                    // "B738" - primary key
  iata: string | null             // "738"
  manufacturer: string            // "Boeing"
  model: string                   // "737-800"
  name: string                    // "Boeing 737-800"
  type: AircraftType
  engineType: EngineType
  engineCount: number
  capacity: number | null
}

export type AircraftType = 'widebody' | 'narrowbody' | 'regional' | 'bizjet' | 'turboprop' | 'piston'
export type EngineType = 'jet' | 'turboprop' | 'piston'
