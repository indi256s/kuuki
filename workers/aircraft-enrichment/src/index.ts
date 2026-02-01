/**
 * Aircraft Enrichment Cron Worker
 *
 * Runs daily at midnight UTC to:
 * 1. Query flights missing aircraft_icao with < 3 lookup attempts
 * 2. Use Gemini with web search grounding to identify aircraft types
 * 3. Update flights and optionally add to user_aircraft table
 */

import { GoogleGenAI, Type } from '@google/genai'

interface Env {
  GEMINI_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

interface FlightToEnrich {
  id: number
  user_id: string
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  flight_number: string | null
  aircraft_lookup_attempts: number
}

interface AircraftLookupResult {
  found: boolean
  icao?: string
  iata?: string
  name?: string
  manufacturer?: string
  model?: string
  type?: string
  confidence: number
}

// ICAO codes for common aircraft
const AIRCRAFT_ICAO_MAP: Record<string, string> = {
  // Boeing
  '737': 'B737',
  '737-700': 'B737',
  '737-800': 'B738',
  '737-900': 'B739',
  '737 MAX 8': 'B38M',
  '737 MAX 9': 'B39M',
  '747': 'B744',
  '747-400': 'B744',
  '747-8': 'B748',
  '757': 'B752',
  '757-200': 'B752',
  '757-300': 'B753',
  '767': 'B763',
  '767-300': 'B763',
  '767-400': 'B764',
  '777': 'B77W',
  '777-200': 'B772',
  '777-300': 'B773',
  '777-300ER': 'B77W',
  '777-9': 'B779',
  '787': 'B788',
  '787-8': 'B788',
  '787-9': 'B789',
  '787-10': 'B78X',
  // Airbus
  'A319': 'A319',
  'A320': 'A320',
  'A320neo': 'A20N',
  'A321': 'A321',
  'A321neo': 'A21N',
  'A330': 'A333',
  'A330-200': 'A332',
  'A330-300': 'A333',
  'A330-900': 'A339',
  'A340': 'A343',
  'A350': 'A359',
  'A350-900': 'A359',
  'A350-1000': 'A35K',
  'A380': 'A388',
  // Embraer
  'E170': 'E170',
  'E175': 'E75S',
  'E190': 'E190',
  'E195': 'E195',
  'ERJ-145': 'E145',
  // Regional
  'CRJ-200': 'CRJ2',
  'CRJ-700': 'CRJ7',
  'CRJ-900': 'CRJ9',
  'ATR 72': 'AT72',
  'ATR 42': 'AT45',
  'Dash 8': 'DH8D',
  'Q400': 'DH8D',
}

// Normalize aircraft name to ICAO code
function normalizeToIcao(aircraftName: string): string | null {
  const name = aircraftName.toUpperCase().trim()

  // Direct ICAO code (4 letters)
  if (/^[A-Z0-9]{4}$/.test(name)) {
    return name
  }

  // Check our mapping
  for (const [pattern, icao] of Object.entries(AIRCRAFT_ICAO_MAP)) {
    if (name.includes(pattern.toUpperCase())) {
      return icao
    }
  }

  // Try to extract from common formats like "Boeing 737-800"
  const boeingMatch = name.match(/BOEING\s*(\d{3})(?:-(\d{1,3}))?/i)
  if (boeingMatch) {
    const model = boeingMatch[1]
    const variant = boeingMatch[2]
    if (model === '737' && variant === '800') return 'B738'
    if (model === '737' && variant === '900') return 'B739'
    if (model === '737' && variant === '700') return 'B737'
    if (model === '777' && variant === '300') return 'B77W'
    if (model === '787' && variant === '9') return 'B789'
    return `B${model.slice(0, 3)}`
  }

  const airbusMatch = name.match(/AIRBUS\s*A(\d{3})(?:-(\d{1,4}))?/i)
  if (airbusMatch) {
    const model = airbusMatch[1]
    const variant = airbusMatch[2]
    if (model === '320' && name.includes('NEO')) return 'A20N'
    if (model === '321' && name.includes('NEO')) return 'A21N'
    if (model === '350' && variant === '1000') return 'A35K'
    return `A${model}`
  }

  return null
}

// Create prompt for Gemini with web search grounding
function createSearchPrompt(flight: FlightToEnrich): string {
  const parts = [
    `Search for the aircraft type that operated flight`,
    flight.airline_iata && flight.flight_number
      ? `${flight.airline_iata}${flight.flight_number}`
      : null,
    `from ${flight.origin} to ${flight.destination}`,
    `on ${flight.date}.`,
    '',
    'Search FlightRadar24, FlightAware, or airline schedules to find the aircraft type.',
    '',
    'Return the aircraft information in this JSON format:',
    '{',
    '  "found": true,',
    '  "aircraft_type": "Boeing 737-800" or similar,',
    '  "icao_code": "B738" (4-letter ICAO type code),',
    '  "confidence": 0.9 (how confident you are)',
    '}',
    '',
    'If you cannot find the aircraft type, return:',
    '{ "found": false, "confidence": 0 }',
  ]

  return parts.filter(Boolean).join('\n')
}

// Parse Gemini response
function parseAircraftResponse(responseText: string): AircraftLookupResult {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { found: false, confidence: 0 }
    }

    const data = JSON.parse(jsonMatch[0])

    if (!data.found) {
      return { found: false, confidence: data.confidence || 0 }
    }

    const icao = data.icao_code || normalizeToIcao(data.aircraft_type || '')

    if (!icao) {
      return { found: false, confidence: 0 }
    }

    return {
      found: true,
      icao,
      name: data.aircraft_type,
      confidence: data.confidence || 0.5,
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', error)
    return { found: false, confidence: 0 }
  }
}

// Main cron handler
async function handleScheduled(env: Env): Promise<void> {
  console.log('Aircraft enrichment cron started')

  // Query flights needing enrichment
  const pendingFlightsResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/flights?aircraft_icao=is.null&aircraft_lookup_attempts=lt.3&select=id,user_id,date,origin,destination,airline_iata,flight_number,aircraft_lookup_attempts&limit=50`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!pendingFlightsResponse.ok) {
    console.error('Failed to fetch pending flights:', await pendingFlightsResponse.text())
    return
  }

  const flights: FlightToEnrich[] = await pendingFlightsResponse.json()
  console.log(`Found ${flights.length} flights to enrich`)

  if (flights.length === 0) {
    return
  }

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })

  // Process each flight
  let enrichedCount = 0
  let failedCount = 0

  for (const flight of flights) {
    try {
      console.log(`Processing flight ${flight.id}: ${flight.airline_iata || '??'}${flight.flight_number || '?'} ${flight.origin}-${flight.destination} on ${flight.date}`)

      // Call Gemini with web search grounding
      const prompt = createSearchPrompt(flight)

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          // Enable web search grounding
          tools: [{ googleSearch: {} }],
        },
      })

      const responseText = response.text || ''
      console.log(`Gemini response for flight ${flight.id}:`, responseText.slice(0, 200))

      const result = parseAircraftResponse(responseText)

      // Update the flight
      const updateData: Record<string, unknown> = {
        aircraft_lookup_attempts: flight.aircraft_lookup_attempts + 1,
      }

      if (result.found && result.icao && result.confidence >= 0.7) {
        updateData.aircraft_icao = result.icao
        enrichedCount++
        console.log(`Flight ${flight.id}: Found aircraft ${result.icao} (confidence: ${result.confidence})`)
      } else {
        failedCount++
        console.log(`Flight ${flight.id}: Could not identify aircraft (confidence: ${result.confidence})`)
      }

      // Update the flight in Supabase
      const updateResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/flights?id=eq.${flight.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(updateData),
        }
      )

      if (!updateResponse.ok) {
        console.error(`Failed to update flight ${flight.id}:`, await updateResponse.text())
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Error processing flight ${flight.id}:`, error)
      failedCount++

      // Increment attempts even on error
      await fetch(`${env.SUPABASE_URL}/rest/v1/flights?id=eq.${flight.id}`, {
        method: 'PATCH',
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          aircraft_lookup_attempts: flight.aircraft_lookup_attempts + 1,
        }),
      })
    }
  }

  console.log(`Aircraft enrichment completed: ${enrichedCount} enriched, ${failedCount} failed`)
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env))
  },

  // Also allow HTTP trigger for testing
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only allow POST for manual trigger
    if (request.method !== 'POST') {
      return new Response('Method not allowed. Use POST to trigger manually.', { status: 405 })
    }

    // Check for a secret trigger token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }

    ctx.waitUntil(handleScheduled(env))
    return new Response(JSON.stringify({ message: 'Aircraft enrichment triggered' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
