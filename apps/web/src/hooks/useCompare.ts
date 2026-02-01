import { useQuery } from '@tanstack/react-query'
import { getUserStats, type UserStats } from '@/lib/profiles'

const COMPARE_STATS_KEY = 'compareStats'

/**
 * Hook for fetching stats for comparison
 */
export function useCompareStats(userId: string | null) {
  return useQuery({
    queryKey: [COMPARE_STATS_KEY, userId],
    queryFn: () => {
      if (!userId) return null
      return getUserStats(userId)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Re-export types
export type { UserStats }
