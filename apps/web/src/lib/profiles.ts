import { api } from './apiClient'
import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type UserStats = Tables<'user_stats'>
export type BadgeDefinition = Tables<'badge_definitions'>
export type UserBadge = Tables<'user_badges'>
// LeaderboardEntry is canonical in ./leaderboard (flat shape from the rankings endpoints).
export type { LeaderboardEntry } from './leaderboard'
import type { LeaderboardEntry } from './leaderboard'

// Theme color presets with hex values
export const THEME_COLORS = {
  teal: '#17A2A2',
  red: '#E86B5F',
  coral: '#F58B7C',
  olive: '#9C8B1B',
  yellow: '#E8C84A',
  orange: '#F5A55A',
  purple: '#A98ED9',
  blue: '#4A9FF5',
  gray: '#95999E',
} as const

export type ThemeColorKey = keyof typeof THEME_COLORS

// Public profile data shape
export interface PublicProfileData {
  profile: Profile
  stats: UserStats | null
  badges: Array<UserBadge & { badge: BadgeDefinition }>
  rankings: LeaderboardEntry[]
}

/**
 * Fetch a public profile by username
 * Returns null if user doesn't exist or profile is private
 */
export async function getPublicProfile(username: string): Promise<PublicProfileData | null> {
  try {
    // The public endpoint returns the public profile DTO (a column-allowlisted subset of the
    // profiles row). Consumers only read public columns, so we present it as the Profile type.
    const data = await api.get<{
      profile: Profile
      stats: UserStats | null
      badges: Array<UserBadge & { badge: BadgeDefinition }>
      rankings: LeaderboardEntry[]
    }>(`/api/public/profiles/${encodeURIComponent(username)}`)

    return {
      profile: data.profile,
      stats: data.stats ?? null,
      badges: data.badges ?? [],
      rankings: data.rankings ?? [],
    }
  } catch (error) {
    console.error('Error fetching public profile:', error)
    return null
  }
}

/**
 * Search for users by username (for compare feature)
 * Only returns public profiles
 */
export async function searchUsers(query: string, limit = 10): Promise<Profile[]> {
  if (!query || query.length < 2) {
    return []
  }

  try {
    // The search endpoint returns public profile DTOs; consumers read only public columns.
    const results = await api.get<Profile[]>('/api/profiles/search', { q: query })
    return (results ?? []).slice(0, limit)
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

/**
 * Get user stats for the current user
 * (userId is accepted for signature compatibility; the API resolves the user from the session.)
 */
export async function getUserStats(_userId: string): Promise<UserStats | null> {
  try {
    return await api.get<UserStats | null>('/api/me/stats')
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return null
  }
}

/**
 * Get user's badges with badge definitions
 * (userId is accepted for signature compatibility; the API resolves the user from the session.)
 */
export async function getUserBadges(
  _userId: string
): Promise<Array<UserBadge & { badge: BadgeDefinition }>> {
  try {
    const badges = await api.get<Array<UserBadge & { badge: BadgeDefinition }>>('/api/me/badges')
    return badges ?? []
  } catch (error) {
    console.error('Error fetching user badges:', error)
    return []
  }
}

/**
 * Get all badge definitions (for showing progress)
 */
export async function getAllBadges(): Promise<BadgeDefinition[]> {
  try {
    const badges = await api.get<BadgeDefinition[]>('/api/badges')
    return badges ?? []
  } catch (error) {
    console.error('Error fetching badge definitions:', error)
    return []
  }
}

/**
 * Get user's leaderboard rankings
 * (userId is accepted for signature compatibility; the API resolves the user from the session.)
 */
export async function getUserRankings(_userId: string): Promise<LeaderboardEntry[]> {
  try {
    const rankings = await api.get<LeaderboardEntry[]>('/api/me/rankings')
    return rankings ?? []
  } catch (error) {
    console.error('Error fetching user rankings:', error)
    return []
  }
}

/**
 * Check if a username is available
 * (excludeUserId is accepted for signature compatibility; the API excludes the
 * authenticated user's own row server-side.)
 */
export async function checkUsernameAvailable(
  username: string,
  _excludeUserId?: string
): Promise<boolean> {
  try {
    const data = await api.get<{ available: boolean }>('/api/profiles/check-username', { username })
    return data.available ?? false
  } catch (error) {
    console.error('Error checking username:', error)
    return false
  }
}


/**
 * Get the CSS custom property value for a theme color
 */
export function getThemeColorVar(themeColor: ThemeColorKey): string {
  return THEME_COLORS[themeColor]
}
