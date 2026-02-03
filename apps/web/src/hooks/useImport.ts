import { useMutation } from '@tanstack/react-query'

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'

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
}

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string
}

export function useParseImport() {
  return useMutation({
    mutationFn: async (request: ParseRequest): Promise<ParseResult> => {
      // Add timeout to prevent indefinite hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      try {
        const response = await fetch('/api/import/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to parse document')
        }

        return response.json()
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        throw error
      }
    },
  })
}
