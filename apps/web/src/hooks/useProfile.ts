import { useQuery } from '@tanstack/react-query'
import {
  getPublicProfile,
  type PublicProfileData,
} from '@/lib/profiles'

const PROFILE_KEY = 'profile'

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

// Re-export types
export type { PublicProfileData }
