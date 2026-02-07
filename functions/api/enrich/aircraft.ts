import { GoogleGenAI, Type } from '@google/genai'
import {
  type EnrichmentRequest,
  type EnrichmentResponse,
  type EnrichmentResult,
  type FlightToEnrich,
  buildBatchPrompt,
  buildRouteKey,
  queryAirLabsRoute,
  checkDailyLimit,
  incrementDailyUsage,
  MAX_BATCH_SIZE,
} from './_shared'

interface Env {
  GEMINI_API_KEY: string
  AIRLABS_API_KEY: string
  IMPORT_JOBS: KVNamespace
}

// JSON schema for structured output from Gemini
const ENRICHMENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.NUMBER,
            description: 'Flight index from the input list (1-based)',
          },
          icao: {
            type: Type.STRING,
            description: '4-letter ICAO aircraft type code (e.g., B77W, A388)',
            nullable: true,
          },
          name: {
            type: Type.STRING,
            description: 'Full aircraft name (e.g., Boeing 777-300ER)',
            nullable: true,
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score between 0 and 1',
          },
        },
        required: ['index', 'confidence'],
      },
    },
  },
  required: ['results'],
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
    if (!context.env.GEMINI_API_KEY) {
      return Response.json(
        { error: 'Gemini API key not configured', results: [] } as EnrichmentResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    // Parse request
    const body = await context.request.json() as EnrichmentRequest
    const { flights } = body

    // Validate input
    if (!flights || !Array.isArray(flights) || flights.length === 0) {
      return Response.json(
        { error: 'flights array is required and cannot be empty', results: [] } as EnrichmentResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    if (flights.length > MAX_BATCH_SIZE) {
      return Response.json(
        { error: `Maximum ${MAX_BATCH_SIZE} flights per request`, results: [] } as EnrichmentResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate each flight has required fields
    for (const flight of flights) {
      if (!flight.id || !flight.date || !flight.origin || !flight.destination) {
        return Response.json(
          { error: 'Each flight must have id, date, origin, and destination', results: [] } as EnrichmentResponse,
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // --- Two-tier enrichment pipeline ---
    const airLabsResults = new Map<string, EnrichmentResult>() // flight_id → result
    const flightsForGemini: FlightToEnrich[] = []

    // Logging counters
    let airlabsQueries = 0
    let airlabsCacheHits = 0
    let airlabsHits = 0

    const hasAirLabs = !!context.env.AIRLABS_API_KEY && !!context.env.IMPORT_JOBS

    if (hasAirLabs) {
      // Step 1: Check daily limit
      const dailyUsage = await checkDailyLimit(context.env.IMPORT_JOBS)
      const overLimit = dailyUsage >= 50

      if (overLimit) {
        console.log(`AirLabs daily limit reached (${dailyUsage}/50), skipping to Gemini`)
      }

      if (!overLimit) {
        // Step 2: Deduplicate by route key
        const routeKeyToFlights = new Map<string, FlightToEnrich[]>()
        const noRouteKeyFlights: FlightToEnrich[] = []

        for (const flight of flights) {
          const key = buildRouteKey(flight)
          if (!key) {
            noRouteKeyFlights.push(flight)
            continue
          }
          const group = routeKeyToFlights.get(key)
          if (group) {
            group.push(flight)
          } else {
            routeKeyToFlights.set(key, [flight])
          }
        }

        // Flights without route keys go straight to Gemini
        for (const flight of noRouteKeyFlights) {
          flightsForGemini.push(flight)
        }

        // Step 3 & 4: Query AirLabs (cache-first) for each unique route
        const uniqueRouteKeys = Array.from(routeKeyToFlights.keys())
        const routeResults = await Promise.all(
          uniqueRouteKeys.map(async (routeKey) => {
            const representativeFlight = routeKeyToFlights.get(routeKey)![0]
            const result = await queryAirLabsRoute(
              context.env.AIRLABS_API_KEY,
              context.env.IMPORT_JOBS,
              representativeFlight
            )
            return { routeKey, result }
          })
        )

        // Count queries vs cache hits
        let actualApiCalls = 0
        for (const { routeKey, result } of routeResults) {
          const flightsForKey = routeKeyToFlights.get(routeKey)!

          if (!result) {
            // queryAirLabsRoute returned null (no route key) — shouldn't happen here
            for (const f of flightsForKey) flightsForGemini.push(f)
            continue
          }

          if (result.fromCache) {
            airlabsCacheHits++
          } else {
            actualApiCalls++
          }

          if (result.aircraft_icao) {
            airlabsHits++
            // Map result to all flights sharing this route
            for (const f of flightsForKey) {
              airLabsResults.set(f.id, {
                flight_id: f.id,
                aircraft_icao: result.aircraft_icao,
                aircraft_name: null, // AirLabs gives ICAO only
                confidence: 1.0,
                source: 'airlabs',
              })
            }
          } else {
            // AirLabs returned no aircraft — fall through to Gemini
            for (const f of flightsForKey) flightsForGemini.push(f)
          }
        }

        airlabsQueries = actualApiCalls

        // Step 5: Update daily counter
        if (actualApiCalls > 0) {
          await incrementDailyUsage(context.env.IMPORT_JOBS, actualApiCalls)
        }

        console.log(
          `AirLabs enrichment:`,
          JSON.stringify({
            unique_routes: uniqueRouteKeys.length,
            airlabs_queries: actualApiCalls,
            airlabs_cache_hits: airlabsCacheHits,
            airlabs_hits: airlabsHits,
            gemini_fallback: flightsForGemini.length,
            daily_usage: dailyUsage + actualApiCalls,
          })
        )
      } else {
        // Over daily limit — all flights go to Gemini
        flightsForGemini.push(...flights)
      }
    } else {
      // No AirLabs configured — all flights go to Gemini
      flightsForGemini.push(...flights)
    }

    // --- Tier 2: Gemini phase (only for flights not resolved by AirLabs) ---
    const geminiResults = new Map<string, EnrichmentResult>()

    if (flightsForGemini.length > 0) {
      const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY })
      const prompt = buildBatchPrompt(flightsForGemini)

      console.log('Sending Gemini enrichment request for', flightsForGemini.length, 'flights')

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [
            { googleSearch: {} },
          ],
          responseMimeType: 'application/json',
          responseSchema: ENRICHMENT_RESPONSE_SCHEMA,
        },
      })

      const responseText = response.text
      if (responseText) {
        try {
          const parsedResponse: { results: Array<{ index: number; icao: string | null; name: string | null; confidence: number }> } = JSON.parse(responseText)

          console.log('Gemini enrichment response:', JSON.stringify(parsedResponse, null, 2))

          for (const flight of flightsForGemini) {
            const geminiIndex = flightsForGemini.indexOf(flight) + 1
            const geminiResult = parsedResponse.results.find(r => r.index === geminiIndex)

            if (geminiResult) {
              geminiResults.set(flight.id, {
                flight_id: flight.id,
                aircraft_icao: geminiResult.icao?.toUpperCase() || null,
                aircraft_name: geminiResult.name || null,
                confidence: Math.min(1, Math.max(0, geminiResult.confidence ?? 0)),
                source: 'gemini',
              })
            }
          }
        } catch {
          console.error('Failed to parse Gemini response:', responseText)
        }
      } else {
        console.error('No response from Gemini')
      }
    }

    // --- Merge results ---
    const results: EnrichmentResult[] = flights.map((flight) => {
      // AirLabs results take priority
      const airLabsResult = airLabsResults.get(flight.id)
      if (airLabsResult) return airLabsResult

      const geminiResult = geminiResults.get(flight.id)
      if (geminiResult) return geminiResult

      return {
        flight_id: flight.id,
        aircraft_icao: null,
        aircraft_name: null,
        confidence: 0,
      }
    })

    console.log(`Enrichment complete: ${results.filter(r => r.aircraft_icao).length} of ${flights.length} identified`)

    return Response.json(
      { results } as EnrichmentResponse,
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Enrichment error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { message: errorMessage, stack: errorStack })
    return Response.json(
      { error: `Internal server error: ${errorMessage}`, results: [] } as EnrichmentResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
