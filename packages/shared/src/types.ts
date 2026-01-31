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
  createdAt: string
  updatedAt: string
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

// Leaderboard entry
export interface LeaderboardEntry {
  category: 'countries' | 'cities' | 'flights' | 'distance' | 'airlines'
  userId: string
  rank: number
  value: number
  metadata: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

// Badge definition
export interface Badge {
  id: number
  code: string
  name: string
  description: string
  category: 'milestone' | 'geographic' | 'airline' | 'aircraft' | 'special'
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  points: number
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
