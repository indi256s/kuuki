import { useQuery } from '@tanstack/react-query'
import {
  getLeaderboard,
  getUserLeaderboardPositions,
  getTotalRankedUsers,
  type LeaderboardCategory,
  type LeaderboardEntryWithProfile,
} from '@/lib/leaderboard'
import { useAuthStore } from '@/stores/authStore'

export const LEADERBOARD_KEY = 'leaderboard'
export const USER_POSITIONS_KEY = 'userLeaderboardPositions'
export const TOTAL_USERS_KEY = 'totalRankedUsers'

/**
 * Hook for fetching leaderboard entries by category
 */
export function useLeaderboard(category: LeaderboardCategory, limit = 50) {
  return useQuery({
    queryKey: [LEADERBOARD_KEY, category, limit],
    queryFn: () => getLeaderboard(category, { limit }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for fetching current user's leaderboard positions
 */
export function useUserLeaderboardPositions() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [USER_POSITIONS_KEY, userId],
    queryFn: () => {
      if (!userId) return null
      return getUserLeaderboardPositions(userId)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for getting total ranked users count
 */
export function useTotalRankedUsers() {
  return useQuery({
    queryKey: [TOTAL_USERS_KEY],
    queryFn: getTotalRankedUsers,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

// Re-export types
export type { LeaderboardCategory, LeaderboardEntryWithProfile }
