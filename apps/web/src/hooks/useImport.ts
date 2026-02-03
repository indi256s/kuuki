import { useMutation } from '@tanstack/react-query'

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'
export type JobStatus = 'processing' | 'completed' | 'failed'

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
  // Async mode fields
  jobId?: string
  status?: JobStatus
}

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string
}

// Polling configuration
const POLL_INTERVAL_MS = 2500 // Poll every 2.5 seconds
const MAX_POLL_ATTEMPTS = 120 // Max 5 minutes of polling (120 * 2.5s)

// Helper to poll for job status
async function pollJobStatus(jobId: string, signal?: AbortSignal): Promise<ParseResult> {
  let attempts = 0

  while (attempts < MAX_POLL_ATTEMPTS) {
    if (signal?.aborted) {
      throw new Error('Request cancelled')
    }

    const response = await fetch(`/api/import/status/${jobId}`, {
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to check job status')
    }

    const result: ParseResult = await response.json()

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
        const response = await fetch('/api/import/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to parse document')
        }

        const result: ParseResult = await response.json()

        // Check if this is async mode
        if (result.status === 'processing' && result.jobId) {
          console.log(`Async import started, polling job ${result.jobId}...`)
          return await pollJobStatus(result.jobId, controller.signal)
        }

        // Sync mode - return result directly
        return result
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request cancelled')
        }
        throw error
      }
    },
  })
}
