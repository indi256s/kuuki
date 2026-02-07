// Shared types and utilities for aircraft enrichment API

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
  source?: 'airlabs' | 'gemini'
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

// --- AirLabs Routes API integration ---

export interface AirLabsRouteResult {
  airline_iata: string
  airline_icao: string
  flight_iata: string
  flight_icao: string
  flight_number: string
  dep_iata: string
  dep_icao: string
  arr_iata: string
  arr_icao: string
  aircraft_icao: string
  duration: number // minutes
  dep_time: string
  arr_time: string
}

interface AirLabsCacheEntry {
  aircraft_icao: string | null
  duration: number | null
  cached_at: number
}

const AIRLABS_CACHE_TTL = 6_048_000 // 70 days in seconds
const AIRLABS_DAILY_LIMIT = 50
const AIRLABS_USAGE_TTL = 172_800 // 2 days in seconds

/**
 * Build a deduplication key for a flight route.
 * Format: "EK:1:DXB-LHR"
 * Returns null if flight has no flight_number (those skip AirLabs).
 */
export function buildRouteKey(flight: FlightToEnrich): string | null {
  if (!flight.flight_number || !flight.airline_iata) return null
  return `${flight.airline_iata}:${flight.flight_number}:${flight.origin}-${flight.destination}`
}

/**
 * Check how many AirLabs API calls have been made today.
 */
export async function checkDailyLimit(kv: KVNamespace): Promise<number> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const key = `airlabs:usage:${today}`
  const val = await kv.get(key)
  return val ? parseInt(val, 10) : 0
}

/**
 * Increment the daily AirLabs usage counter.
 */
export async function incrementDailyUsage(kv: KVNamespace, count: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `airlabs:usage:${today}`
  const current = await checkDailyLimit(kv)
  await kv.put(key, String(current + count), { expirationTtl: AIRLABS_USAGE_TTL })
}

/**
 * Query AirLabs Routes API for a single flight route.
 * Checks KV cache first; on cache miss, calls the API and caches the result.
 * Returns { aircraft_icao, duration, fromCache } or null.
 */
export async function queryAirLabsRoute(
  apiKey: string,
  kv: KVNamespace,
  flight: FlightToEnrich
): Promise<{ aircraft_icao: string | null; duration: number | null; fromCache: boolean } | null> {
  const routeKey = buildRouteKey(flight)
  if (!routeKey) return null

  const cacheKey = `airlabs:route:${routeKey}`

  // Check KV cache first
  const cached = await kv.get<AirLabsCacheEntry>(cacheKey, 'json')
  if (cached) {
    return { aircraft_icao: cached.aircraft_icao, duration: cached.duration, fromCache: true }
  }

  // Cache miss — call AirLabs API
  const flightIata = `${flight.airline_iata}${flight.flight_number}`
  const url = `https://airlabs.co/api/v9/routes?flight_iata=${encodeURIComponent(flightIata)}&api_key=${apiKey}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`AirLabs API error: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json() as { response: AirLabsRouteResult[] }
    const routes = data.response

    if (!routes || routes.length === 0) {
      // Cache null result to avoid re-querying
      const nullEntry: AirLabsCacheEntry = { aircraft_icao: null, duration: null, cached_at: Date.now() }
      await kv.put(cacheKey, JSON.stringify(nullEntry), { expirationTtl: AIRLABS_CACHE_TTL })
      return { aircraft_icao: null, duration: null, fromCache: false }
    }

    // Find the matching route (prefer exact dep/arr match)
    const match = routes.find(
      r => r.dep_iata === flight.origin && r.arr_iata === flight.destination
    ) || routes[0]

    const entry: AirLabsCacheEntry = {
      aircraft_icao: match.aircraft_icao || null,
      duration: match.duration || null,
      cached_at: Date.now(),
    }
    await kv.put(cacheKey, JSON.stringify(entry), { expirationTtl: AIRLABS_CACHE_TTL })

    return { aircraft_icao: entry.aircraft_icao, duration: entry.duration, fromCache: false }
  } catch (err) {
    console.error('AirLabs API fetch error:', err)
    return null
  }
}
