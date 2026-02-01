import { useQuery } from '@tanstack/react-query'
import {
  getPublicProfile,
  getUserStats,
  getUserBadges,
  getUserRankings,
  searchUsers,
  type PublicProfileData,
  type UserStats,
  type LeaderboardEntry,
} from '@/lib/profiles'
import { useAuthStore } from '@/stores/authStore'

const PROFILE_KEY = 'profile'
const USER_STATS_KEY = 'userStats'
const USER_BADGES_KEY = 'userBadges'
const USER_RANKINGS_KEY = 'userRankings'
const SEARCH_USERS_KEY = 'searchUsers'

/**
 * Hook for fetching a public profile by username
 * Used on /fly/:username pages
 */
export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: [PROFILE_KEY, 'public', username],
    queryFn: () => {
      if (!username) return null
      return getPublicProfile(username)
    },
    enabled: !!username,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for fetching current user's stats from user_stats table
 * More accurate than calculated stats from flights
 */
export function useUserStats() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [USER_STATS_KEY, userId],
    queryFn: () => {
      if (!userId) return null
      return getUserStats(userId)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes (stats update via triggers)
  })
}

/**
 * Hook for fetching current user's badges
 */
export function useUserBadges() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [USER_BADGES_KEY, userId],
    queryFn: () => {
      if (!userId) return []
      return getUserBadges(userId)
    },
    enabled: !!userId,
  })
}

/**
 * Hook for fetching current user's leaderboard rankings
 */
export function useUserRankings() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [USER_RANKINGS_KEY, userId],
    queryFn: () => {
      if (!userId) return []
      return getUserRankings(userId)
    },
    enabled: !!userId,
  })
}

/**
 * Hook for searching users by username
 * Used in compare feature
 */
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: [SEARCH_USERS_KEY, query],
    queryFn: () => searchUsers(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  })
}

// Re-export types
export type { PublicProfileData, UserStats, LeaderboardEntry }
