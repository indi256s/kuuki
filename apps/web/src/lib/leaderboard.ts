import { api } from './apiClient'

export type LeaderboardCategory = 'flights' | 'distance' | 'countries' | 'cities' | 'airlines'

const CATEGORIES: LeaderboardCategory[] = ['flights', 'distance', 'countries', 'cities', 'airlines']

/** Raw entry as returned by the API: the leaderboard_cache row with metadata flattened server-side. */
interface ApiLeaderboardEntry {
  id: number
  user_id: string
  category: string
  value: number
  rank: number
  percentile: number | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

/** A single leaderboard position (the current user's row in one category). */
export type LeaderboardEntry = ApiLeaderboardEntry

/** A list row with camelCase profile fields the table/components read directly. */
export interface LeaderboardEntryWithProfile extends ApiLeaderboardEntry {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

function withProfile(entry: ApiLeaderboardEntry): LeaderboardEntryWithProfile {
  return {
    ...entry,
    username: entry.username ?? '',
    displayName: entry.display_name,
    avatarUrl: entry.avatar_url,
  }
}

/**
 * Get leaderboard entries for a specific category.
 */
export async function getLeaderboard(
  category: LeaderboardCategory,
  options: {
    limit?: number
    offset?: number
  } = {}
): Promise<{ entries: LeaderboardEntryWithProfile[]; total: number }> {
  const { limit = 50, offset = 0 } = options

  try {
    const data = await api.get<{ entries: ApiLeaderboardEntry[]; total: number }>('/api/leaderboard', {
      category,
      limit,
      offset,
    })
    return { entries: (data.entries ?? []).map(withProfile), total: data.total ?? 0 }
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return { entries: [], total: 0 }
  }
}

/**
 * Get the current user's position in all categories.
 * (userId is accepted for signature compatibility; the API resolves the user from the session.)
 */
export async function getUserLeaderboardPositions(
  _userId: string
): Promise<Record<LeaderboardCategory, LeaderboardEntry | null>> {
  const result: Record<LeaderboardCategory, LeaderboardEntry | null> = {
    flights: null,
    distance: null,
    countries: null,
    cities: null,
    airlines: null,
  }

  try {
    const entries = await api.get<ApiLeaderboardEntry[]>('/api/me/rankings')
    for (const entry of entries ?? []) {
      if (CATEGORIES.includes(entry.category as LeaderboardCategory)) {
        result[entry.category as LeaderboardCategory] = entry
      }
    }
  } catch (error) {
    console.error('Error fetching user leaderboard positions:', error)
  }

  return result
}

/**
 * Get total number of ranked users.
 */
export async function getTotalRankedUsers(): Promise<number> {
  try {
    const data = await api.get<{ total: number }>('/api/leaderboard/total-users')
    return data.total ?? 0
  } catch (error) {
    console.error('Error fetching total ranked users:', error)
    return 0
  }
}
