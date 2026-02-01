import { useMutation } from '@tanstack/react-query'

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
      const response = await fetch('/api/import/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to parse document')
      }

      return response.json()
    },
  })
}
