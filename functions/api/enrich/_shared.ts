// Shared types and utilities for aircraft enrichment (Gemini-backed).
//
// NOTE: the AirLabs Routes API tier was removed — enrichment is Gemini-only now.

export interface FlightToEnrich {
  id: string
  flight_number: string | null
  airline_iata: string | null
  airline_name?: string | null // Optional airline name for better search context
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
  source?: 'gemini'
}

export interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

// Maximum number of flights per batch request
export const MAX_BATCH_SIZE = 20

/**
 * Build flight line with optional airline name for better search context.
 * Format: "EK1 (Emirates) DXB-LHR 2024-03-15"
 */
function buildFlightLine(f: FlightToEnrich, index: number): string {
  const flightId = f.flight_number
    ? `${f.airline_iata || ''}${f.flight_number}`
    : `${f.airline_iata || 'Unknown'} flight`
  const airlinePart = f.airline_name ? ` (${f.airline_name})` : ''
  return `${index + 1}. ${flightId}${airlinePart} ${f.origin}-${f.destination} ${f.date}`
}

/**
 * Build the batch prompt for Gemini to identify aircraft types.
 * Uses grounded web search for accurate, real-time information.
 */
export function buildBatchPrompt(flights: FlightToEnrich[]): string {
  const flightLines = flights.map((f, i) => buildFlightLine(f, i)).join('\n')

  return `You are an aviation expert. For each flight below, identify the aircraft CURRENTLY operated on this route.

IMPORTANT: Return the aircraft type the airline flies TODAY on this route, not historical equipment.

Search the web to find current information. Use your judgment on which sources are accessible and reliable.

Flights to identify:
${flightLines}

For each flight, provide:
- index: The flight number from the list (1-based)
- icao: 4-letter ICAO aircraft type code (e.g., B77W, A388, B789)
- name: Full aircraft name (e.g., "Boeing 777-300ER")
- confidence: Score from 0 to 1 based on these rules:
  * 0.9-1.0: Single aircraft type found in 2+ reliable sources
  * 0.8-0.89: Single aircraft type found in 1 source
  * 0.7-0.79: Two types historically but one clearly dominant currently
  * Below 0.7: Multiple types with unclear current assignment → return null

Common ICAO codes by family:

Boeing 737: B731, B732, B733, B734, B735, B736, B737, B738, B739, B38M, B39M, B3XM
Boeing 747: B741, B742, B743, B744, B748, B74S
Boeing 757: B752, B753
Boeing 767: B762, B763, B764
Boeing 777: B772, B773, B77W, B77L, B779
Boeing 787: B788, B789, B78X

Airbus A220: BCS1, BCS3
Airbus A300/A310: A306, A310
Airbus A318-A321: A318, A319, A320, A321, A19N, A20N, A21N
Airbus A330: A332, A333, A338, A339
Airbus A340: A342, A343, A345, A346
Airbus A350: A359, A35K
Airbus A380: A388

Embraer: E170, E75L, E75S, E190, E195, E290, E295
Bombardier CRJ: CRJ1, CRJ2, CRJ7, CRJ9, CRJX
ATR: AT43, AT45, AT72, AT76
De Havilland: DH8A, DH8B, DH8C, DH8D

Regional/Other: RJ85, RJ1H, F70, F100, SU95, C919, ARJ21, AN24, AN26, T204, T214

If you cannot determine the aircraft with confidence ≥0.7, return icao: null and confidence: 0.
Do NOT guess - it's better to return null than an uncertain result.

Return JSON:
{
  "results": [
    { "index": 1, "icao": "B77W", "name": "Boeing 777-300ER", "confidence": 0.95 },
    { "index": 2, "icao": null, "name": null, "confidence": 0 }
  ]
}`
}
