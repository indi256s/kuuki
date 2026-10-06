import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@kuuki/client/apiClient'

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
}

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string
}

export function useParseImport() {
  return useMutation({
    mutationFn: async (request: ParseRequest): Promise<ParseResult> => {
      try {
        return await api.post<ParseResult>('/api/import/parse', request, { timeoutMs: 120_000 })
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
