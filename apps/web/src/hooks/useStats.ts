import { useQuery } from '@tanstack/react-query'
import { getFlightStats, type FlightStats } from '@/lib/flights'
import { useAuthStore } from '@/stores/authStore'

const FLIGHT_STATS_KEY = 'flightStats'

/**
 * Hook for aggregated flight statistics
 */
export function useFlightStats() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [FLIGHT_STATS_KEY, userId],
    queryFn: () => {
      if (!userId) {
        return {
          totalFlights: 0,
          totalDistance: 0,
          countriesVisited: 0,
          airlinesFlown: 0,
          uniqueAirports: 0,
          upcomingFlights: 0,
        } as FlightStats
      }
      return getFlightStats(userId)
    },
    enabled: !!userId,
  })
}

// Re-export type
export type { FlightStats }
