import { useQuery } from '@tanstack/react-query'
import { getUserBadges, getAllBadges, type BadgeDefinition, type UserBadge } from '@/lib/profiles'
import { useAuthStore } from '@/stores/authStore'

const USER_BADGES_KEY = 'userBadges'
const ALL_BADGES_KEY = 'allBadges'

/**
 * Hook for fetching current user's earned badges
 */
export function useUserBadges() {
  const userId = useAuthStore((state) => state.user?.id)
  const authLoading = useAuthStore((state) => state.isLoading)

  return useQuery({
    queryKey: [USER_BADGES_KEY, userId],
    queryFn: () => {
      if (!userId) return []
      return getUserBadges(userId)
    },
    enabled: !!userId && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for fetching all badge definitions (for progress tracking)
 */
export function useAllBadges() {
  return useQuery({
    queryKey: [ALL_BADGES_KEY],
    queryFn: getAllBadges,
    staleTime: 1000 * 60 * 60, // 1 hour (badge definitions rarely change)
  })
}

/**
 * Hook for computing badge progress
 */
export function useBadgeProgress() {
  const { data: earnedBadges } = useUserBadges()
  const { data: allBadges } = useAllBadges()

  if (!allBadges || !earnedBadges) {
    return { total: 0, earned: 0, progress: 0, byCategory: {} }
  }

  const earnedIds = new Set(earnedBadges.map(b => b.badge_id))
  const visibleBadges = allBadges.filter(b => b.category !== 'secret' || earnedIds.has(b.id))

  const byCategory: Record<string, { total: number; earned: number }> = {}

  for (const badge of visibleBadges) {
    const category = badge.category ?? 'other'
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, earned: 0 }
    }
    byCategory[category].total++
    if (earnedIds.has(badge.id)) {
      byCategory[category].earned++
    }
  }

  const earned = earnedBadges.length
  const total = visibleBadges.length
  const progress = total > 0 ? Math.round((earned / total) * 100) : 0

  return { total, earned, progress, byCategory }
}

// Re-export types
export type { BadgeDefinition, UserBadge }
