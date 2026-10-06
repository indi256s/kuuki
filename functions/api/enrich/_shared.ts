import { AIRCRAFT_BATCH_SIZE } from '../../../packages/shared/src/constants'
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
  evidence?: string | null
  uncertainty?: string | null
  source?: 'gemini'
}

export interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

// Maximum number of flights per batch request
export const MAX_BATCH_SIZE = AIRCRAFT_BATCH_SIZE

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
 * Searches for evidence about the dated flight, not current route equipment.
 */
export function buildBatchPrompt(flights: FlightToEnrich[]): string {
  const flightLines = flights.map((f, i) => buildFlightLine(f, i)).join('\n')

  return `You are researching historical flight equipment. Each date below is the date of that flight. Find evidence that applies to that flight on that date, including historical schedules or flight records. Today's route or fleet equipment is not evidence for a past flight.

Search the web for dated evidence. An aircraft type is a suggestion for the user to review, never a confirmed fact. If the exact dated flight cannot be supported, prefer unknown. State uncertainty and cite the source and relevant date in a short evidence field. Do not invent sources.

Flights to identify:
${flightLines}

For each flight, provide:
- index: The flight number from the list (1-based)
- icao: 4-letter ICAO aircraft type code (e.g., B77W, A388, B789)
- name: Full aircraft name (e.g., "Boeing 777-300ER")
- confidence: Score from 0 to 1 based on these rules:
  * 0.9-1.0: Dated record for this specific flight confirms one type
  * 0.7-0.89: Dated schedule or multiple historical sources support one type, but the exact flight is unconfirmed
  * Below 0.7: Evidence is absent or conflicts → return null
- evidence: Short dated source or record supporting this suggestion, or null
- uncertainty: What remains unverified, or null

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

If dated evidence does not support confidence ≥0.7, return icao: null, name: null and confidence: 0. Never infer historical equipment solely from today's service.

Return JSON:
{
  "results": [
    { "index": 1, "icao": "B77W", "name": "Boeing 777-300ER", "confidence": 0.85, "evidence": "Dated schedule, source and date", "uncertainty": "Exact tail unverified" },
    { "index": 2, "icao": null, "name": null, "confidence": 0, "evidence": null, "uncertainty": "No dated record found" }
  ]
}`
}
