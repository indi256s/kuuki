// Leaderboard categories
export const LEADERBOARD_CATEGORIES = [
  'countries',
  'cities',
  'flights',
  'distance',
  'airlines',
] as const

export type LeaderboardCategory = typeof LEADERBOARD_CATEGORIES[number]

// Aircraft types
export const AIRCRAFT_TYPES = ['widebody', 'narrowbody', 'regional', 'bizjet', 'turboprop', 'piston'] as const
export type AircraftTypeConst = typeof AIRCRAFT_TYPES[number]

// Engine types
export const ENGINE_TYPES = ['jet', 'turboprop', 'piston'] as const
export type EngineTypeConst = typeof ENGINE_TYPES[number]

// Badge tiers
export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const
export type BadgeTier = typeof BADGE_TIERS[number]

// Earth's circumference in km
export const EARTH_CIRCUMFERENCE_KM = 40075

// Distance to the moon in km
export const MOON_DISTANCE_KM = 384400
