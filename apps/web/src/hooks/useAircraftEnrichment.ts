import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import { reconcileDerivedState, type DerivedAck } from '@/lib/derivedStateFeedback'

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
  evidence?: string | null
  uncertainty?: string | null
  source?: 'gemini'
}

export interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

export interface AircraftBatchResponse extends DerivedAck {
  results: Array<
    | { id: number; status: 'accepted'; flight: { id: number; aircraft_icao: string | null } }
    | { id: number | null; status: 'error'; http_status: number; code: string; error: string }
  >
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
    mutationFn: (updates: { id: number; aircraft_icao: string }[]) =>
      api.post<AircraftBatchResponse>('/api/flights/aircraft-batch', { items: updates }),
    onSuccess: (ack) => {
      if (!userId || !ack.results.some(result => result.status === 'accepted')) return
      reconcileDerivedState(ack, queryClient, userId)
      // Aircraft-specific reads can be outside the main flight list prefix.
      void queryClient.invalidateQueries({ queryKey: queryKeys.flightAircraft(userId) })
    },
  })
}

// Re-export types for convenience
export type { FlightToEnrich as EnrichmentFlightInput }
