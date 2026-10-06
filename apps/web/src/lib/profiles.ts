import { api, ApiError } from '@kuuki/client/apiClient'
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
 * Returns null only when the username does not exist. Private profiles return a public shell.
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
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/**
 * Get user's badges with badge definitions
 * (userId is accepted for signature compatibility; the API resolves the user from the session.)
 */
export async function getUserBadges(
  _userId: string
): Promise<Array<UserBadge & { badge: BadgeDefinition }>> {
  const badges = await api.get<Array<UserBadge & { badge: BadgeDefinition }>>('/api/me/badges')
  return badges ?? []
}
