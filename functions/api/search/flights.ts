import {
  checkDailyLimit,
  incrementDailyUsage,
} from '../enrich/_shared'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf } from '../_lib/auth'

interface SearchRequest {
  origin: string
  destination: string
  date: string
  time: string
  windowMinutes: number
}

export interface FlightScheduleResult {
  airline_iata: string
  flight_number: string
  departure_time: string
  arrival_time: string
  aircraft_icao: string | null
  duration_minutes: number | null
}

interface SearchResponse {
  flights: FlightScheduleResult[]
  error?: string
}

interface AirLabsScheduleResponse {
  response: Array<{
    airline_iata: string
    flight_iata: string
    flight_number: string
    dep_time: string
    arr_time: string
    aircraft_icao?: string
    duration?: number
  }>
}

const FLIGHT_SEARCH_CACHE_TTL = 7200 // 2 hours in seconds

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Check if a flight departure time falls within the search window
 */
function isWithinTimeWindow(
  flightTime: string,
  searchTime: string,
  windowMinutes: number
): boolean {
  const flightMinutes = timeToMinutes(flightTime)
  const searchMinutes = timeToMinutes(searchTime)
  const diff = Math.abs(flightMinutes - searchMinutes)

  // Handle midnight wraparound (e.g., 23:30 and 00:30)
  const diffWrapped = Math.min(diff, 1440 - diff) // 1440 = 24 hours

  return diffWrapped <= windowMinutes
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(request, env, 'POST, OPTIONS')

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'POST, OPTIONS')
  }

  // CSRF: state-changing, paid-quota endpoint — require same-origin + double-submit token.
  try {
    requireCsrf(request)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid CSRF token', code: 'CSRF', flights: [] }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  // Auth gate — burns paid AirLabs quota, so reject anonymous callers
  const user = (context.data && context.data.user) || null
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required', code: 'UNAUTHENTICATED', flights: [] }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  try {
    // Check API key
    if (!context.env.AIRLABS_API_KEY) {
      return Response.json(
        { error: 'AirLabs API key not configured', flights: [] } as SearchResponse,
        { status: 500, headers: cors }
      )
    }

    // Guard against oversized request bodies (50KB limit for search payloads)
    const contentLength = parseInt(context.request.headers.get('content-length') || '0')
    if (contentLength > 50_000) {
      return Response.json(
        { error: 'Request too large', flights: [] } as SearchResponse,
        { status: 413, headers: cors }
      )
    }

    // Parse request
    const body = await context.request.json() as SearchRequest
    const { origin, destination, date, time, windowMinutes = 180 } = body

    // Validate input
    if (!origin || !destination || !date || !time) {
      return Response.json(
        { error: 'origin, destination, date, and time are required', flights: [] } as SearchResponse,
        { status: 400, headers: cors }
      )
    }

    if (origin.length !== 3 || destination.length !== 3) {
      return Response.json(
        { error: 'origin and destination must be 3-letter IATA codes', flights: [] } as SearchResponse,
        { status: 400, headers: cors }
      )
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/
    if (!timeRegex.test(time)) {
      return Response.json(
        { error: 'time must be in HH:MM format', flights: [] } as SearchResponse,
        { status: 400, headers: cors }
      )
    }

    // Check KV cache first (keyed by route and date, not time)
    const cacheKey = `flight_search:${origin.toUpperCase()}-${destination.toUpperCase()}:${date}`
    const cached = await context.env.IMPORT_JOBS.get<FlightScheduleResult[]>(cacheKey, 'json')

    let schedules: FlightScheduleResult[]

    if (cached) {
      console.log(JSON.stringify({ event: 'flight_search_cache_hit', cache_key: cacheKey }))
      schedules = cached
    } else {
      // Check daily limit
      const dailyUsage = await checkDailyLimit(context.env.IMPORT_JOBS)
      if (dailyUsage >= 50) {
        return Response.json(
          { error: 'Daily search limit reached. Try again tomorrow.', flights: [] } as SearchResponse,
          { status: 429, headers: cors }
        )
      }

      // Call AirLabs Schedules API
      const url = `https://airlabs.co/api/v9/schedules?dep_iata=${origin.toUpperCase()}&arr_iata=${destination.toUpperCase()}&api_key=${context.env.AIRLABS_API_KEY}`

      console.log(JSON.stringify({ event: 'airlabs_fetch', origin, destination }))

      const response = await fetch(url)

      if (!response.ok) {
        console.error(JSON.stringify({ event: 'airlabs_api_error', status: response.status, statusText: response.statusText }))
        return Response.json(
          { error: 'Flight search service unavailable', flights: [] } as SearchResponse,
          { status: 503, headers: cors }
        )
      }

      const data = await response.json() as AirLabsScheduleResponse

      // Transform AirLabs response to our format
      schedules = (data.response || []).map(flight => ({
        airline_iata: flight.airline_iata,
        flight_number: flight.flight_number,
        departure_time: flight.dep_time,
        arrival_time: flight.arr_time,
        aircraft_icao: flight.aircraft_icao || null,
        duration_minutes: flight.duration || null,
      }))

      // Cache the full schedule list for this route/date
      await context.env.IMPORT_JOBS.put(
        cacheKey,
        JSON.stringify(schedules),
        { expirationTtl: FLIGHT_SEARCH_CACHE_TTL }
      )

      // Increment daily usage counter
      await incrementDailyUsage(context.env.IMPORT_JOBS, 1)

      console.log(JSON.stringify({ event: 'airlabs_schedules', flights_found: schedules.length, daily_usage: dailyUsage + 1 }))
    }

    // Filter by time window
    const matchingFlights = schedules
      .filter(flight => isWithinTimeWindow(flight.departure_time, time, windowMinutes))
      .slice(0, 3) // Max 3 results

    console.log(JSON.stringify({ event: 'time_window_filter', matched: matchingFlights.length, total: schedules.length }))

    return Response.json(
      { flights: matchingFlights } as SearchResponse,
      { headers: cors }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ event: 'flight_search_error', error: errorMessage }))
    return Response.json(
      { error: `Internal server error: ${errorMessage}`, flights: [] } as SearchResponse,
      { status: 500, headers: cors }
    )
  }
}
