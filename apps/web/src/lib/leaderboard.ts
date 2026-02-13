import { supabase } from './supabase'
import type { Tables } from './database.types'

export type LeaderboardEntry = Tables<'leaderboard_cache'>

export type LeaderboardCategory = 'flights' | 'distance' | 'countries' | 'cities' | 'airlines'

export interface LeaderboardEntryWithProfile extends LeaderboardEntry {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Get leaderboard entries for a specific category
 */
export async function getLeaderboard(
  category: LeaderboardCategory,
  options: {
    limit?: number
    offset?: number
  } = {}
): Promise<{ entries: LeaderboardEntryWithProfile[]; total: number }> {
  const { limit = 50, offset = 0 } = options

  const { data, error, count } = await supabase
    .from('leaderboard_cache')
    .select('*', { count: 'exact' })
    .eq('category', category)
    .order('rank', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching leaderboard:', error)
    return { entries: [], total: 0 }
  }

  // Parse metadata to extract profile info
  const entries: LeaderboardEntryWithProfile[] = (data ?? []).map((entry) => {
    const metadata = entry.metadata as { username?: string; display_name?: string; avatar_url?: string } | null
    return {
      ...entry,
      username: metadata?.username ?? '',
      displayName: metadata?.display_name ?? null,
      avatarUrl: metadata?.avatar_url ?? null,
    }
  })

  return { entries, total: count ?? 0 }
}

/**
 * Get the current user's position in all categories
 */
export async function getUserLeaderboardPositions(userId: string): Promise<Record<LeaderboardCategory, LeaderboardEntry | null>> {
  const categories: LeaderboardCategory[] = ['flights', 'distance', 'countries', 'cities', 'airlines']
  const result: Record<LeaderboardCategory, LeaderboardEntry | null> = {
    flights: null,
    distance: null,
    countries: null,
    cities: null,
    airlines: null,
  }

  const { data, error } = await supabase
    .from('leaderboard_cache')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user leaderboard positions:', error)
    return result
  }

  for (const entry of data ?? []) {
    if (categories.includes(entry.category as LeaderboardCategory)) {
      result[entry.category as LeaderboardCategory] = entry
    }
  }

  return result
}

/**
 * Get total number of ranked users
 */
export async function getTotalRankedUsers(): Promise<number> {
  const { count, error } = await supabase
    .from('leaderboard_cache')
    .select('user_id', { count: 'exact', head: true })
    .eq('category', 'flights') // Any category works, they all have same users

  if (error) {
    console.error('Error fetching total ranked users:', error)
    return 0
  }

  return count ?? 0
}
