import { useQuery } from '@tanstack/react-query'
import { api } from '@kuuki/client/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { queryKeys } from '@/lib/queryKeys'

export interface FlightDuration {
  aircraft_icao: string
  duration_minutes: number
}

export function useFlightDurations() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: queryKeys.flightDurations(userId),
    queryFn: async () => {
      const data = await api.get<FlightDuration[]>('/api/flights/durations')
      return data ?? []
    },
    enabled: !!userId,
  })
}
