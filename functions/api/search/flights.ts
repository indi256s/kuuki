import {
  checkDailyLimit,
  incrementDailyUsage,
} from '../enrich/_shared'

interface Env {
  AIRLABS_API_KEY: string
  IMPORT_JOBS: KVNamespace
}

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
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check API key
    if (!context.env.AIRLABS_API_KEY) {
      return Response.json(
        { error: 'AirLabs API key not configured', flights: [] } as SearchResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    // Parse request
    const body = await context.request.json() as SearchRequest
    const { origin, destination, date, time, windowMinutes = 180 } = body

    // Validate input
    if (!origin || !destination || !date || !time) {
      return Response.json(
        { error: 'origin, destination, date, and time are required', flights: [] } as SearchResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    if (origin.length !== 3 || destination.length !== 3) {
      return Response.json(
        { error: 'origin and destination must be 3-letter IATA codes', flights: [] } as SearchResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/
    if (!timeRegex.test(time)) {
      return Response.json(
        { error: 'time must be in HH:MM format', flights: [] } as SearchResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    // Check KV cache first (keyed by route and date, not time)
    const cacheKey = `flight_search:${origin.toUpperCase()}-${destination.toUpperCase()}:${date}`
    const cached = await context.env.IMPORT_JOBS.get<FlightScheduleResult[]>(cacheKey, 'json')

    let schedules: FlightScheduleResult[]

    if (cached) {
      console.log(`Cache hit for flight search: ${cacheKey}`)
      schedules = cached
    } else {
      // Check daily limit
      const dailyUsage = await checkDailyLimit(context.env.IMPORT_JOBS)
      if (dailyUsage >= 50) {
        return Response.json(
          { error: 'Daily search limit reached. Try again tomorrow.', flights: [] } as SearchResponse,
          { status: 429, headers: corsHeaders }
        )
      }

      // Call AirLabs Schedules API
      const url = `https://airlabs.co/api/v9/schedules?dep_iata=${origin.toUpperCase()}&arr_iata=${destination.toUpperCase()}&api_key=${context.env.AIRLABS_API_KEY}`

      console.log(`Fetching schedules from AirLabs: ${origin} -> ${destination}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`AirLabs API error: ${response.status} ${response.statusText}`)
        return Response.json(
          { error: 'Flight search service unavailable', flights: [] } as SearchResponse,
          { status: 503, headers: corsHeaders }
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

      console.log(`AirLabs schedules: ${schedules.length} flights found, daily usage: ${dailyUsage + 1}/50`)
    }

    // Filter by time window
    const matchingFlights = schedules
      .filter(flight => isWithinTimeWindow(flight.departure_time, time, windowMinutes))
      .slice(0, 3) // Max 3 results

    console.log(`Time window filter: ${matchingFlights.length} of ${schedules.length} flights match`)

    return Response.json(
      { flights: matchingFlights } as SearchResponse,
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Flight search error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { error: `Internal server error: ${errorMessage}`, flights: [] } as SearchResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
