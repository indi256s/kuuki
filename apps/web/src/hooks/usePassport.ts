import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUserCountries,
  getUserClaims,
  claimCountry,
  unclaimCountry,
  getCountryStats,
  getPassportStats,
  isCountryClaimed,
  type CountryClaim,
} from '@/lib/passport'
import { useAuthStore } from '@/stores/authStore'
import type { PassportEntry, CountryStats, EntryMethod } from '@kuuki/shared'

const PASSPORT_COUNTRIES_KEY = 'passportCountries'
const PASSPORT_CLAIMS_KEY = 'passportClaims'
const PASSPORT_STATS_KEY = 'passportStats'
const COUNTRY_STATS_KEY = 'countryStats'

/**
 * Hook for all passport countries (flights + claims combined)
 */
export function usePassportCountries() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery<PassportEntry[]>({
    queryKey: [PASSPORT_COUNTRIES_KEY, userId],
    queryFn: () => {
      if (!userId) return []
      return getUserCountries(userId)
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook for manual country claims only
 */
export function usePassportClaims() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery<CountryClaim[]>({
    queryKey: [PASSPORT_CLAIMS_KEY, userId],
    queryFn: () => {
      if (!userId) return []
      return getUserClaims(userId)
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook for passport summary stats
 */
export function usePassportStats() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [PASSPORT_STATS_KEY, userId],
    queryFn: () => {
      if (!userId) return { countriesCount: 0, continentsCount: 0, worldCompletion: 0 }
      return getPassportStats(userId)
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook for country-specific stats (for popup)
 */
export function useCountryStats(countryCode: string | null) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery<CountryStats | null>({
    queryKey: [COUNTRY_STATS_KEY, userId, countryCode],
    queryFn: () => {
      if (!userId || !countryCode) return null
      return getCountryStats(userId, countryCode)
    },
    enabled: !!userId && !!countryCode,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook to claim a country
 */
export function useClaimCountry() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async ({
      countryCode,
      visitYear,
      note,
      entryMethod,
    }: {
      countryCode: string
      visitYear?: number | null
      note?: string | null
      entryMethod?: EntryMethod
    }) => {
      if (!userId) throw new Error('Not authenticated')
      return claimCountry(userId, countryCode, { visitYear, note, entryMethod })
    },
    onSuccess: () => {
      // Invalidate all passport-related queries
      queryClient.invalidateQueries({ queryKey: [PASSPORT_COUNTRIES_KEY] })
      queryClient.invalidateQueries({ queryKey: [PASSPORT_CLAIMS_KEY] })
      queryClient.invalidateQueries({ queryKey: [PASSPORT_STATS_KEY] })
      // Also invalidate user stats since countries_count will change
      queryClient.invalidateQueries({ queryKey: ['userStats'] })
      queryClient.invalidateQueries({ queryKey: ['flightStats'] })
    },
  })
}

/**
 * Hook to unclaim a country
 */
export function useUnclaimCountry() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (countryCode: string) => {
      if (!userId) throw new Error('Not authenticated')
      return unclaimCountry(userId, countryCode)
    },
    onSuccess: (_, countryCode) => {
      // Invalidate all passport-related queries
      queryClient.invalidateQueries({ queryKey: [PASSPORT_COUNTRIES_KEY] })
      queryClient.invalidateQueries({ queryKey: [PASSPORT_CLAIMS_KEY] })
      queryClient.invalidateQueries({ queryKey: [PASSPORT_STATS_KEY] })
      queryClient.invalidateQueries({ queryKey: [COUNTRY_STATS_KEY, userId, countryCode] })
      // Also invalidate user stats
      queryClient.invalidateQueries({ queryKey: ['userStats'] })
      queryClient.invalidateQueries({ queryKey: ['flightStats'] })
    },
  })
}

/**
 * Hook to check if country is claimed (for map display)
 */
export function useIsCountryClaimed(countryCode: string | null) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: ['isCountryClaimed', userId, countryCode],
    queryFn: () => {
      if (!userId || !countryCode) return false
      return isCountryClaimed(userId, countryCode)
    },
    enabled: !!userId && !!countryCode,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Re-export types
export type { CountryClaim }
