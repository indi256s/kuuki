import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { classifyError } from '@/lib/errors'
import i18n from '@/lib/i18n'

// Keys for cache invalidation
const FLIGHTS_KEY = 'flights'
const FLIGHT_AIRCRAFT_KEY = 'flightAircraft'

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
  source?: 'airlabs' | 'gemini'
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
      const response = await fetch('/api/enrich/aircraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flights }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      return response.json()
    },
    onError: (error) => {
      console.error('Aircraft enrichment failed:', error)
      const classified = classifyError(error)
      toast.error(i18n.t(classified.messageKey, i18n.t('errors.generic.1')))
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
      if (!userId) throw new Error('Not authenticated')

      // Use Supabase to update each flight
      // We do individual updates to ensure proper ownership checks
      const results = await Promise.all(
        updates.map(async ({ id, aircraft_icao }) => {
          const { data, error } = await supabase
            .from('flights')
            .update({ aircraft_icao })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

          if (error) throw error
          return data
        })
      )

      return results
    },
    onSuccess: () => {
      // Invalidate flight-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [FLIGHTS_KEY] })
      queryClient.invalidateQueries({ queryKey: [FLIGHT_AIRCRAFT_KEY] })
      queryClient.invalidateQueries({ queryKey: ['flightStats'] })
    },
    onError: (error) => {
      console.error('Update flight aircraft failed:', error)
      const classified = classifyError(error, 'save')
      toast.error(i18n.t(classified.messageKey, i18n.t('errors.generic.1')))
    },
  })
}

// Re-export types for convenience
export type { FlightToEnrich as EnrichmentFlightInput }
