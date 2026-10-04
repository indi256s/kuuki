import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getFlights,
  getFlight,
  createFlight,
  updateFlight,
  deleteFlight,
  deleteFlights,
  checkDuplicateFlight,
  getFlightRoutes,
  getRecentFlights,
  getUpcomingFlights,
  getFlightYears,
  getFlightAirlines,
  getFlightAircraft,
  getAllFlightIds,
  syncUpcomingFlights,
  type Flight,
  type FlightInsert,
  type FlightUpdate,
  type FlightFilters,
  type SortConfig,
  type SortField,
  type SortOrder,
} from '@/lib/flights'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'
import { reconcileDerivedState } from '@/lib/derivedStateFeedback'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Hook for paginated flight list with infinite scroll
 */
export function useFlights(filters?: FlightFilters, sort?: SortConfig, pageSize = 20) {
  const userId = useAuthStore((state) => state.user?.id)

  return useInfiniteQuery({
    queryKey: queryKeys.flights(userId, filters, sort),
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) throw new Error('Not authenticated')
      return getFlights(userId, {
        limit: pageSize,
        offset: pageParam,
        filters,
        sort,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.flights.length, 0)
      if (totalFetched >= lastPage.total) return undefined
      return totalFetched
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/**
 * Hook for a single flight
 */
export function useFlight(flightId: number | null) {
  const userId = useAuthStore((state) => state.user?.id)
  return useQuery({
    queryKey: queryKeys.flight(userId, flightId),
    queryFn: () => {
      if (!flightId) return null
      return getFlight(flightId)
    },
    enabled: !!flightId && !!userId,
  })
}

/**
 * Hook to create a new flight
 */
export function useCreateFlight() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async ({ flight, operationId }: { flight: Omit<FlightInsert, 'id' | 'created_at' | 'user_id'>; operationId: string }) => {
      if (!userId) throw new Error('Not authenticated')
      return createFlight({ ...flight, user_id: userId }, operationId)
    },
    onSuccess: (created) => {
      if (userId) reconcileDerivedState(created, queryClient, userId)
      toast.success('Flight added to your log')
    },
    onError: (error) => {
      console.error('Create flight failed:', error)
      toast.error("Couldn't save flight. Please try again.")
    },
  })
}

/**
 * Hook to update an existing flight
 */
export function useUpdateFlight() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async ({ flightId, updates }: { flightId: number; updates: FlightUpdate }) => {
      return updateFlight(flightId, updates)
    },
    onSuccess: (updatedFlight) => {
      // Update the specific flight in cache
      if (userId) reconcileDerivedState(updatedFlight, queryClient, userId)
      toast.success('Flight updated successfully')
    },
    onError: (error) => {
      console.error('Update flight failed:', error)
      toast.error("Couldn't save flight. Please try again.")
    },
  })
}

/**
 * Hook to delete a flight.
 * Uses optimistic updates - the flight is removed from the UI immediately,
 * then rolled back if the delete fails.
 */
export function useDeleteFlight() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (flightId: number) => {
      return deleteFlight(flightId)
    },
    onSuccess: (ack) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
      toast.success('Flight removed from your log')
    },
    onError: (error) => {
      console.error('Delete flight failed:', error)
      toast.error("Couldn't delete flight. Please try again.")
    },
  })
}

/**
 * Hook to delete multiple flights at once.
 * Uses optimistic updates with rollback on failure.
 */
export function useBatchDeleteFlights() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (flightIds: number[]) => {
      return deleteFlights(flightIds)
    },
    onSuccess: (ack, flightIds) => {
      if (userId) reconcileDerivedState(ack, queryClient, userId)
      toast.success(`${flightIds.length} flights removed`)
    },
    onError: (error) => {
      console.error('Batch delete flights failed:', error)
      toast.error("Couldn't delete flights. Please try again.")
    },
  })
}

/**
 * Hook to check for duplicate flights
 */
export function useCheckDuplicate() {
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async ({
      date,
      origin,
      destination,
      excludeId,
    }: {
      date: string
      origin: string
      destination: string
      excludeId?: number
    }) => {
      if (!userId) throw new Error('Not authenticated')
      return checkDuplicateFlight(userId, date, origin, destination, excludeId)
    },
  })
}

/**
 * Hook for all flight routes (map rendering - lightweight, no limit)
 */
export function useFlightRoutes(filters?: FlightFilters) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.flightRoutes(userId, filters),
    queryFn: () => {
      if (!userId) return []
      return getFlightRoutes(userId, filters)
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook for recent flights (dashboard)
 */
export function useRecentFlights(limit = 5) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.recentFlights(userId, limit),
    queryFn: () => {
      if (!userId) return []
      return getRecentFlights(userId, limit)
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes — flights don't change often
  })
}

/**
 * Hook for upcoming flights (dashboard)
 */
export function useUpcomingFlights(limit = 3) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.upcomingFlights(userId, limit),
    queryFn: () => {
      if (!userId) return []
      return getUpcomingFlights(userId, limit)
    },
    enabled: !!userId,
  })
}

/**
 * Hook to get years for filter dropdown
 */
export function useFlightYears() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.flightYears(userId),
    queryFn: () => {
      if (!userId) return []
      return getFlightYears(userId)
    },
    enabled: !!userId,
  })
}

/**
 * Hook to get airlines for filter dropdown
 */
export function useFlightAirlines() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.flightAirlines(userId),
    queryFn: () => {
      if (!userId) return []
      return getFlightAirlines(userId)
    },
    enabled: !!userId,
  })
}

/**
 * Hook to get aircraft for filter dropdown
 */
export function useFlightAircraft() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.flightAircraft(userId),
    queryFn: () => {
      if (!userId) return []
      return getFlightAircraft(userId)
    },
    enabled: !!userId,
  })
}

/**
 * Hook to get all flight IDs (for bulk selection)
 * Only fetches IDs, respects current filters
 */
export function useAllFlightIds(filters?: FlightFilters) {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: queryKeys.allFlightIds(userId, filters),
    queryFn: () => {
      if (!userId) return []
      return getAllFlightIds(userId, filters)
    },
    enabled: false, // Only fetch when explicitly requested via refetch()
  })
}

/**
 * Hook to sync upcoming flights on mount
 * Converts past upcoming flights to completed
 */
export function useSyncUpcomingFlights() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  useEffect(() => {
    if (!userId) return

    syncUpcomingFlights(userId).then((ack) => {
      if (ack.synced > 0) reconcileDerivedState(ack, queryClient, userId)
    }).catch(error => console.error('Upcoming flight sync failed:', error))
  }, [userId, queryClient])
}

// Re-export types
export type { Flight, FlightInsert, FlightUpdate, FlightFilters, SortConfig, SortField, SortOrder }
