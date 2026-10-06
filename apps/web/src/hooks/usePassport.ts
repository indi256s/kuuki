import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getUserCountries,
  getUserClaims,
  claimCountry,
  addGroundVisit,
  deleteGroundVisit,
  unclaimCountry,
  getCountryStats,
  type CountryClaim,
} from '@kuuki/client/passport'
import { useAuthStore } from '@/stores/authStore'
import type { PassportEntry, CountryStats, EntryMethod } from '@kuuki/shared'
import { reconcileDerivedState } from '@/lib/derivedStateFeedback'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Hook for all passport countries (flights + claims combined)
 */
export function usePassportCountries() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery<PassportEntry[]>({
    queryKey: queryKeys.passportCountries(userId),
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
    queryKey: queryKeys.passportClaims(userId),
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
    queryKey: queryKeys.countryStats(userId, countryCode),
    queryFn: () => {
      if (!userId || !countryCode) return null
      return getCountryStats(userId, countryCode)
    },
    enabled: !!userId && !!countryCode,
    staleTime: 2 * 60 * 1000,
  })
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
      const claim = await claimCountry(userId, countryCode)

      // Step 2: Insert ground visit if any details provided
      const hasDetails = visitYear != null || note || entryMethod
      if (!hasDetails) return claim
      // The stamp is committed even if the visit insert fails, so refresh for it now.
      reconcileDerivedState(claim, queryClient, userId)
      return addGroundVisit(userId, countryCode, { visitYear, note, entryMethod })
    },
    onSuccess: (ack, { countryCode }) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
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
    onSuccess: (ack) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
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
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (visitId: string) => {
      if (!userId) throw new Error('Not authenticated')
      return deleteGroundVisit(userId, visitId)
    },
    onSuccess: (ack) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
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
    onSuccess: (ack, countryCode) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
      toast.success(`Removed ${countryCode} from your passport`)
    },
    onError: (error) => {
      console.error('Unclaim country failed:', error)
      toast.error("Couldn't update your passport. Please try again.")
    },
  })
}

// Re-export types
export type { CountryClaim }
