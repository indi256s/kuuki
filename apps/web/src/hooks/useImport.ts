import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
import { api, ApiError } from '@/lib/apiClient'

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'
export type JobStatus = 'processing' | 'completed' | 'failed'
export type EnrichmentStatusType = 'pending' | 'completed' | 'failed'

export interface ExtractedFlight {
  date: string
  origin: string
  destination: string
  airline_iata: string
  flight_number?: string
  aircraft_icao?: string
  departure_time?: string
  arrival_time?: string
  confidence: number
  enrichment_status?: EnrichmentStatus // Aircraft enrichment state
  field_confidence?: {
    date?: number
    date_year_explicit?: boolean // true if year was in source, false if inferred
    origin?: number
    destination?: number
    airline_iata?: number
    flight_number?: number
    aircraft_icao?: number
    departure_time?: number
    arrival_time?: number
  }
}

export interface RejectedFlight {
  index: number
  date?: string
  origin?: string
  destination?: string
  airline_iata?: string
  reason: string
}

export interface ParseResult {
  flights: ExtractedFlight[]
  raw_text?: string
  error?: string
  // Diagnostic info
  rejected?: RejectedFlight[]
  gemini_count?: number
  cleaned_text?: string // Normalized text from Stage 1 (text input only)
  // Legacy async mode fields
  jobId?: string
  status?: JobStatus
  // Two-phase import fields
  enrichmentJobId?: string
  enrichmentStatus?: EnrichmentStatusType
}

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string
}

// Enrichment response from /api/import/enrichment/[jobId]
interface EnrichmentResponse {
  status: EnrichmentStatusType
  flights?: ExtractedFlight[]
  error?: string
}

// Polling configuration
const POLL_INTERVAL_MS = 2500 // Poll every 2.5 seconds
const MAX_POLL_ATTEMPTS = 120 // Max 5 minutes of polling (120 * 2.5s)

// Helper to poll for legacy job status (backwards compatibility)
async function pollJobStatus(jobId: string, signal?: AbortSignal): Promise<ParseResult> {
  let attempts = 0

  while (attempts < MAX_POLL_ATTEMPTS) {
    if (signal?.aborted) {
      throw new Error('Request cancelled')
    }

    const result = await api.get<ParseResult>(`/api/import/status/${jobId}`, undefined, signal)

    // Check if job is complete
    if (result.status === 'completed') {
      return result
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Import processing failed')
    }

    // Still processing - wait and try again
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    attempts++
  }

  throw new Error('Import timed out. Please try again with fewer flights.')
}

export function useParseImport() {
  return useMutation({
    mutationFn: async (request: ParseRequest): Promise<ParseResult> => {
      // No timeout for the initial request since we handle async mode
      const controller = new AbortController()

      try {
        const result = await api.post<ParseResult>('/api/import/parse', request, undefined, 120_000)

        // Check if this is legacy async mode (no flights returned, just jobId)
        if (result.status === 'processing' && result.jobId && result.flights.length === 0) {
          console.log(`Legacy async import started, polling job ${result.jobId}...`)
          return await pollJobStatus(result.jobId, controller.signal)
        }

        // Two-phase mode: return result with basic flights and enrichmentJobId
        // The UI will handle polling for enrichment separately
        return result
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request cancelled')
        }
        if (error instanceof ApiError) throw new Error(error.message || 'Failed to parse document')
        throw error
      }
    },
  })
}

/**
 * Hook for polling enrichment status in two-phase import.
 *
 * @param jobId - The enrichment job ID to poll
 * @param onComplete - Called when enrichment completes with enriched flights
 * @param onError - Called when enrichment fails
 * @param enabled - Whether polling is active (default: true if jobId is provided)
 */
export function useEnrichmentPolling(
  jobId: string | null | undefined,
  onComplete: (flights: ExtractedFlight[]) => void,
  onError?: (error: string) => void,
  enabled = true
) {
  const attemptsRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Keep callbacks fresh without restarting polling.
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    attemptsRef.current = 0
  }, [])

  useEffect(() => {
    if (!jobId || !enabled) {
      stopPolling()
      return
    }

    const controller = new AbortController()
    let active = true
    let inFlight = false
    const poll = async () => {
      if (!active || inFlight) return
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        stopPolling()
        onErrorRef.current?.('Enrichment timed out. You can still save the basic flights.')
        return
      }

      inFlight = true
      try {
        const data = await api.get<EnrichmentResponse>(`/api/import/enrichment/${jobId}`, undefined, controller.signal)
        if (!active) return

        if (data.status === 'completed' && data.flights) {
          stopPolling()
          onCompleteRef.current(data.flights)
          return
        }

        if (data.status === 'failed') {
          stopPolling()
          onErrorRef.current?.(data.error || 'Enrichment failed')
          return
        }

        // Still pending, continue polling
        attemptsRef.current++
      } catch (error) {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) {
          // Job expired or not found
          stopPolling()
          onErrorRef.current?.('Enrichment job expired. You can still save the basic flights.')
          return
        }
        console.error('Enrichment poll error:', error)
        attemptsRef.current++
        // Don't stop polling on transient errors
      } finally {
        inFlight = false
      }
    }

    // Start polling immediately
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      active = false
      controller.abort()
      stopPolling()
    }
  }, [jobId, enabled, stopPolling])

  return { stopPolling }
}
