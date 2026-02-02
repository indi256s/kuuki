// Shared types and utilities for aircraft enrichment API

export interface FlightToEnrich {
  id: string
  flight_number: string | null
  airline_iata: string | null
  date: string
  origin: string
  destination: string
}

export interface EnrichmentRequest {
  flights: FlightToEnrich[]
}

export interface EnrichmentResult {
  flight_id: string
  aircraft_icao: string | null
  aircraft_name: string | null
  confidence: number
}

export interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

// Maximum number of flights per batch request
export const MAX_BATCH_SIZE = 20

/**
 * Build the batch prompt for Gemini to identify aircraft types.
 * Uses grounded web search for accurate, real-time information.
 */
export function buildBatchPrompt(flights: FlightToEnrich[]): string {
  const flightLines = flights.map((f, i) => {
    const flightId = f.flight_number
      ? `${f.airline_iata || ''}${f.flight_number}`
      : `${f.airline_iata || 'Unknown'} flight`
    return `${i + 1}. ${flightId} on ${f.date}: ${f.origin} → ${f.destination}`
  }).join('\n')

  return `You are an aviation expert. For each flight below, identify the aircraft type typically used.

Use Google Search to find information from:
- FlightRadar24 flight history (flightradar24.com)
- FlightAware flight tracking (flightaware.com)
- Airline fleet information pages
- Aviation databases like Planespotters.net

Flights to identify:
${flightLines}

For each flight, provide:
- index: The flight number from the list above (1-based)
- icao: 4-letter ICAO aircraft type code (e.g., B77W, A388, B789, A320, B738)
- name: Full aircraft name (e.g., "Boeing 777-300ER", "Airbus A380-800")
- confidence: Your confidence level from 0 to 1 based on how certain you are

Common ICAO codes reference:
- Boeing 777-300ER = B77W
- Boeing 787-9 = B789
- Boeing 787-10 = B78X
- Boeing 737-800 = B738
- Boeing 737 MAX 8 = B38M
- Airbus A380-800 = A388
- Airbus A350-900 = A359
- Airbus A350-1000 = A35K
- Airbus A321neo = A21N
- Airbus A320neo = A20N
- Airbus A320 = A320

If you cannot determine the aircraft with reasonable confidence (e.g., route is operated by multiple aircraft types), set icao to null and confidence to 0.

Return results as a JSON object with this exact structure:
{
  "results": [
    { "index": 1, "icao": "B77W", "name": "Boeing 777-300ER", "confidence": 0.95 },
    { "index": 2, "icao": null, "name": null, "confidence": 0 }
  ]
}`
}
