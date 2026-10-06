import { useQuery } from '@tanstack/react-query'
import { getUserBadges, type BadgeDefinition, type UserBadge } from '@/lib/profiles'
import { useAuthStore } from '@/stores/authStore'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Hook for fetching current user's earned badges
 */
export function useUserBadges() {
  const userId = useAuthStore((state) => state.user?.id)
  const authLoading = useAuthStore((state) => state.isLoading)

  return useQuery({
    queryKey: queryKeys.userBadges(userId),
    queryFn: () => {
      if (!userId) return []
      return getUserBadges(userId)
    },
    enabled: !!userId && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Re-export types
export type { BadgeDefinition, UserBadge }
