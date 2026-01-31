// Leaderboard categories
export const LEADERBOARD_CATEGORIES = [
  'countries',
  'cities',
  'flights',
  'distance',
  'airlines',
] as const

export type LeaderboardCategory = typeof LEADERBOARD_CATEGORIES[number]

// Seat classes
export const SEAT_CLASSES = ['economy', 'business', 'first'] as const
export type SeatClass = typeof SEAT_CLASSES[number]

// Badge tiers
export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const
export type BadgeTier = typeof BADGE_TIERS[number]

// Earth's circumference in km
export const EARTH_CIRCUMFERENCE_KM = 40075

// Distance to the moon in km
export const MOON_DISTANCE_KM = 384400
