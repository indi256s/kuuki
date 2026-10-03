import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'

export interface FlightToEnrich {
  id: string
  flight_number: string | null
  airline_iata: string | null
  airline_name?: string | null // Optional airline name for better search context
  date: string
  origin: string
  destination: string
}

export interface EnrichmentResult {
  flight_id: string
  aircraft_icao: string | null
  aircraft_name: string | null
  confidence: number
  source?: 'gemini'
}

export interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

/**
 * Hook to enrich flights with aircraft information using Gemini AI.
 * Sends a batch of flights to the API and returns identified aircraft types.
 */
export function useAircraftEnrichment() {
  return useMutation({
    mutationFn: async (flights: FlightToEnrich[]): Promise<EnrichmentResponse> => {
      return api.post<EnrichmentResponse>('/api/enrich/aircraft', { flights })
    },
  })
}

/**
 * Hook to update flight aircraft after user accepts enrichment results.
 * Accepts multiple flights at once for batch update.
 */
export function useUpdateFlightAircraft() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (updates: { id: number; aircraft_icao: string }[]) => {
      // PATCH each flight individually; ownership is enforced server-side per id.
      const results = await Promise.all(
        updates.map(({ id, aircraft_icao }) =>
          api.patch(`/api/flights/${id}`, { aircraft_icao })
        )
      )

      return results
    },
    onSuccess: () => {
      // Invalidate flight-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: queryKeys.flights(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.flightAircraft(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.flightStats(userId) })
    },
  })
}

// Re-export types for convenience
export type { FlightToEnrich as EnrichmentFlightInput }
