import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getUserCountries,
  getUserClaims,
  claimCountry,
  addGroundVisit,
  getGroundVisits,
  deleteGroundVisit,
  unclaimCountry,
  getCountryStats,
  isCountryClaimed,
  type CountryClaim,
} from '@/lib/passport'
import { useAuthStore } from '@/stores/authStore'
import type { PassportEntry, CountryStats, GroundVisit, EntryMethod } from '@kuuki/shared'

const PASSPORT_COUNTRIES_KEY = 'passportCountries'
const PASSPORT_CLAIMS_KEY = 'passportClaims'
const COUNTRY_STATS_KEY = 'countryStats'
const GROUND_VISITS_KEY = 'groundVisits'

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
 * Hook for passport summary stats — derived from cached countries data
 * to avoid a redundant Supabase round-trip (getPassportStats internally
 * calls getUserCountries which is already cached by usePassportCountries).
 */
export function usePassportStats() {
  const { data: entries } = usePassportCountries()

  const stats = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        countriesCount: 0,
        continentsCount: 0,
        flightCountries: 0,
        groundCountries: 0,
        newThisYear: 0,
        lastStamp: null,
      }
    }

    const continents = new Set(entries.map(e => e.continent))
    const currentYear = new Date().getFullYear()

    let flightCountries = 0
    let groundCountries = 0
    let newThisYear = 0
    let lastStamp: { countryCode: string; countryName: string; date: string } | null = null
    let latestDate = ''

    for (const entry of entries) {
      if (entry.source === 'flight') {
        flightCountries++
      } else if (entry.source === 'claim') {
        groundCountries++
      } else {
        flightCountries++
      }

      const firstVisitYear = new Date(entry.firstVisit).getFullYear()
      if (firstVisitYear === currentYear) {
        newThisYear++
      }

      // Track most recent visit
      if (entry.lastVisit > latestDate) {
        latestDate = entry.lastVisit
        lastStamp = {
          countryCode: entry.countryCode,
          countryName: entry.countryName,
          date: entry.lastVisit,
        }
      }
    }

    return {
      countriesCount: entries.length,
      continentsCount: continents.size,
      flightCountries,
      groundCountries,
      newThisYear,
      lastStamp,
    }
  }, [entries])

  return { data: stats }
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
 * Hook for ground visits for a specific country
 */
export function useGroundVisits(countryCode: string | null) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery<GroundVisit[]>({
    queryKey: [GROUND_VISITS_KEY, userId, countryCode],
    queryFn: () => {
      if (!userId || !countryCode) return []
      return getGroundVisits(userId, countryCode)
    },
    enabled: !!userId && !!countryCode,
    staleTime: 2 * 60 * 1000,
  })
}

/** Invalidate all passport-related queries */
function invalidatePassportQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [PASSPORT_COUNTRIES_KEY] })
  queryClient.invalidateQueries({ queryKey: [PASSPORT_CLAIMS_KEY] })
  // Stats are derived from countries via useMemo — no separate invalidation needed
  queryClient.invalidateQueries({ queryKey: ['userStats'] })
  queryClient.invalidateQueries({ queryKey: ['flightStats'] })
}

/**
 * Hook to claim a country (two-step: upsert stamp + insert ground visit)
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

      // Step 1: Upsert the stamp
      await claimCountry(userId, countryCode)

      // Step 2: Insert ground visit if any details provided
      const hasDetails = visitYear != null || note || entryMethod
      if (hasDetails) {
        await addGroundVisit(userId, countryCode, { visitYear, note, entryMethod })
      }
    },
    onSuccess: (_, { countryCode }) => {
      invalidatePassportQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: [COUNTRY_STATS_KEY, userId, countryCode] })
      queryClient.invalidateQueries({ queryKey: [GROUND_VISITS_KEY, userId, countryCode] })
      toast.success(`Added ${countryCode} to your passport`)
    },
    onError: (error) => {
      console.error('Claim country failed:', error)
      toast.error("Couldn't update your passport. Please try again.")
    },
  })
}

/**
 * Hook to add a ground visit to an already-claimed country
 */
export function useAddGroundVisit() {
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
      return addGroundVisit(userId, countryCode, { visitYear, note, entryMethod })
    },
    onSuccess: (_, { countryCode }) => {
      invalidatePassportQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: [COUNTRY_STATS_KEY, userId, countryCode] })
      queryClient.invalidateQueries({ queryKey: [GROUND_VISITS_KEY, userId, countryCode] })
      toast.success('Visit added')
    },
    onError: (error) => {
      console.error('Add ground visit failed:', error)
      toast.error("Couldn't add visit. Please try again.")
    },
  })
}

/**
 * Hook to delete a ground visit
 */
export function useDeleteGroundVisit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (visitId: string) => {
      return deleteGroundVisit(visitId)
    },
    onSuccess: () => {
      invalidatePassportQueries(queryClient)
      // Invalidate all country stats (we don't know which country)
      queryClient.invalidateQueries({ queryKey: [COUNTRY_STATS_KEY] })
      queryClient.invalidateQueries({ queryKey: [GROUND_VISITS_KEY] })
      toast.success('Visit removed')
    },
    onError: (error) => {
      console.error('Delete ground visit failed:', error)
      toast.error("Couldn't remove visit. Please try again.")
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
      invalidatePassportQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: [COUNTRY_STATS_KEY, userId, countryCode] })
      queryClient.invalidateQueries({ queryKey: [GROUND_VISITS_KEY, userId, countryCode] })
      toast.success(`Removed ${countryCode} from your passport`)
    },
    onError: (error) => {
      console.error('Unclaim country failed:', error)
      toast.error("Couldn't update your passport. Please try again.")
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
