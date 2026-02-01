// Shared types and utilities for import API

export interface ExtractedFlight {
  date: string // YYYY-MM-DD
  origin: string // IATA code
  destination: string // IATA code
  airline_iata: string // IATA code
  flight_number?: string
  aircraft_icao?: string
  departure_time?: string // HH:mm
  arrival_time?: string // HH:mm
  confidence: number // 0-1 overall confidence
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

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string // base64 for pdf/image, plain text for text
}

export interface ParseResponse {
  flights: ExtractedFlight[]
  raw_text?: string
  error?: string
}

export function getMimeType(type: 'pdf' | 'image' | 'text'): string {
  switch (type) {
    case 'pdf':
      return 'application/pdf'
    case 'image':
      return 'image/jpeg' // Will be overridden if PNG detected
    default:
      return 'text/plain'
  }
}

export function detectImageMimeType(base64: string): string {
  // Check magic bytes in base64
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // Default fallback
}

export const EXTRACTION_PROMPT = `You are a flight data extraction assistant. Extract ALL flight information from the provided document (boarding pass, itinerary, confirmation email, or screenshot).

For EACH flight found, extract:
- date: Flight date in YYYY-MM-DD format
- origin: 3-letter IATA airport code for departure
- destination: 3-letter IATA airport code for arrival
- airline_iata: 2-letter IATA airline code
- flight_number: Flight number (digits only, no airline prefix)
- aircraft_icao: 4-letter ICAO aircraft type code if visible (e.g., B738, A320)
- departure_time: Departure time in HH:mm 24-hour format
- arrival_time: Arrival time in HH:mm 24-hour format

Also provide confidence scores (0.0 to 1.0) for each field based on how clearly the information was visible/readable.

Important rules:
1. Extract ALL flights if multiple are present (round trips, connections)
2. Use IATA codes for airports (3 letters) and airlines (2 letters)
3. Use ICAO codes for aircraft (4 letters)
4. If a field is not visible or unclear, omit it rather than guessing
5. Dates should be in YYYY-MM-DD format
6. Times should be in HH:mm 24-hour format
7. Overall confidence should reflect how certain you are about the extraction

Return your response as a JSON object with this structure:
{
  "flights": [
    {
      "date": "2024-03-15",
      "origin": "JFK",
      "destination": "LAX",
      "airline_iata": "AA",
      "flight_number": "123",
      "aircraft_icao": "B738",
      "departure_time": "08:30",
      "arrival_time": "11:45",
      "confidence": 0.95,
      "field_confidence": {
        "date": 0.99,
        "origin": 0.99,
        "destination": 0.99,
        "airline_iata": 0.95,
        "flight_number": 0.9,
        "aircraft_icao": 0.7,
        "departure_time": 0.85,
        "arrival_time": 0.85
      }
    }
  ],
  "raw_text": "Extracted text from the document for reference"
}

If no flights can be extracted, return: {"flights": [], "raw_text": "..."}`

export const FLIGHT_SCHEMA = {
  type: 'object',
  properties: {
    flights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Flight date in YYYY-MM-DD format',
          },
          origin: {
            type: 'string',
            description: '3-letter IATA airport code for departure',
          },
          destination: {
            type: 'string',
            description: '3-letter IATA airport code for arrival',
          },
          airline_iata: {
            type: 'string',
            description: '2-letter IATA airline code',
          },
          flight_number: {
            type: 'string',
            description: 'Flight number (digits only)',
          },
          aircraft_icao: {
            type: 'string',
            description: '4-letter ICAO aircraft type code',
          },
          departure_time: {
            type: 'string',
            description: 'Departure time in HH:mm format',
          },
          arrival_time: {
            type: 'string',
            description: 'Arrival time in HH:mm format',
          },
          confidence: {
            type: 'number',
            description: 'Overall confidence score 0-1',
          },
          field_confidence: {
            type: 'object',
            properties: {
              date: { type: 'number' },
              origin: { type: 'number' },
              destination: { type: 'number' },
              airline_iata: { type: 'number' },
              flight_number: { type: 'number' },
              aircraft_icao: { type: 'number' },
              departure_time: { type: 'number' },
              arrival_time: { type: 'number' },
            },
          },
        },
        required: ['date', 'origin', 'destination', 'airline_iata', 'confidence'],
      },
    },
    raw_text: {
      type: 'string',
      description: 'Extracted text from the document',
    },
  },
  required: ['flights'],
}
