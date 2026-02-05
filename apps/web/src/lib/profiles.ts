import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type UserStats = Tables<'user_stats'>
export type BadgeDefinition = Tables<'badge_definitions'>
export type UserBadge = Tables<'user_badges'>
export type LeaderboardEntry = Tables<'leaderboard_cache'>

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
  // First, get the profile by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', username)
    .single()

  if (profileError || !profile) {
    return null
  }

  // If profile is not public, only return basic info
  if (!profile.is_public) {
    return {
      profile,
      stats: null,
      badges: [],
      rankings: [],
    }
  }

  // Fetch stats, badges, and rankings in parallel
  const [statsResult, badgesResult, rankingsResult] = await Promise.all([
    supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', profile.id)
      .single(),
    supabase
      .from('user_badges')
      .select('*, badge:badge_definitions(*)')
      .eq('user_id', profile.id)
      .order('earned_at', { ascending: false }),
    supabase
      .from('leaderboard_cache')
      .select('*')
      .eq('user_id', profile.id),
  ])

  return {
    profile,
    stats: statsResult.data,
    badges: (badgesResult.data ?? []) as Array<UserBadge & { badge: BadgeDefinition }>,
    rankings: rankingsResult.data ?? [],
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

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .ilike('username', `%${query}%`)
    .limit(limit)

  if (error) {
    console.error('Error searching users:', error)
    return []
  }

  return data ?? []
}

/**
 * Get user stats for the current user
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // PGRST116 = not found (user has no stats yet)
    if (error.code !== 'PGRST116') {
      console.error('Error fetching user stats:', error)
    }
    return null
  }

  return data
}

/**
 * Get user's badges with badge definitions
 */
export async function getUserBadges(userId: string): Promise<Array<UserBadge & { badge: BadgeDefinition }>> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badge_definitions(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error) {
    console.error('Error fetching user badges:', error)
    return []
  }

  return (data ?? []) as Array<UserBadge & { badge: BadgeDefinition }>
}

/**
 * Get all badge definitions (for showing progress)
 */
export async function getAllBadges(): Promise<BadgeDefinition[]> {
  const { data, error } = await supabase
    .from('badge_definitions')
    .select('*')
    .order('category')
    .order('tier')

  if (error) {
    console.error('Error fetching badge definitions:', error)
    return []
  }

  return data ?? []
}

/**
 * Get user's leaderboard rankings
 */
export async function getUserRankings(userId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard_cache')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user rankings:', error)
    return []
  }

  return data ?? []
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  let query = supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    console.error('Error checking username:', error)
    return false
  }

  return !data || data.length === 0
}

/**
 * Generate a deterministic avatar URL based on user ID
 * Uses Facehash-style hash to create a unique avatar
 */
export function generateAvatarUrl(userId: string, themeColor: ThemeColorKey = 'teal'): string {
  // Use DiceBear Avatars API for deterministic avatars
  // 'shapes' style gives geometric patterns similar to Facehash
  const bgColor = THEME_COLORS[themeColor].replace('#', '')
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${userId}&backgroundColor=${bgColor}`
}

/**
 * Get the CSS custom property value for a theme color
 */
export function getThemeColorVar(themeColor: ThemeColorKey): string {
  return THEME_COLORS[themeColor]
}
