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
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf } from '../_lib/auth'

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
      JSON.stringify({ error: 'Invalid CSRF token', code: 'CSRF', results: [] }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  // Auth gate — burns paid Gemini/AirLabs quota, so reject anonymous callers
  const user = (context.data && context.data.user) || null
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required', code: 'UNAUTHENTICATED', results: [] }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  try {
    // Check API key
    if (!context.env.GEMINI_API_KEY) {
      return Response.json(
        { error: 'Gemini API key not configured', results: [] } as EnrichmentResponse,
        { status: 500, headers: cors }
      )
    }

    // Guard against oversized request bodies (50KB limit for enrichment payloads)
    const contentLength = parseInt(context.request.headers.get('content-length') || '0')
    if (contentLength > 50_000) {
      return Response.json(
        { error: 'Request too large', results: [] } as EnrichmentResponse,
        { status: 413, headers: cors }
      )
    }

    // Parse request
    const body = await context.request.json() as EnrichmentRequest
    const { flights } = body

    // Validate input
    if (!flights || !Array.isArray(flights) || flights.length === 0) {
      return Response.json(
        { error: 'flights array is required and cannot be empty', results: [] } as EnrichmentResponse,
        { status: 400, headers: cors }
      )
    }

    if (flights.length > MAX_BATCH_SIZE) {
      return Response.json(
        { error: `Maximum ${MAX_BATCH_SIZE} flights per request`, results: [] } as EnrichmentResponse,
        { status: 400, headers: cors }
      )
    }

    // Validate each flight has required fields
    for (const flight of flights) {
      if (!flight.id || !flight.date || !flight.origin || !flight.destination) {
        return Response.json(
          { error: 'Each flight must have id, date, origin, and destination', results: [] } as EnrichmentResponse,
          { status: 400, headers: cors }
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
        console.log(JSON.stringify({ event: 'airlabs_limit_reached', daily_usage: dailyUsage }))
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

        console.log(JSON.stringify({
          event: 'airlabs_enrichment',
          unique_routes: uniqueRouteKeys.length,
          airlabs_queries: actualApiCalls,
          airlabs_cache_hits: airlabsCacheHits,
          airlabs_hits: airlabsHits,
          gemini_fallback: flightsForGemini.length,
          daily_usage: dailyUsage + actualApiCalls,
        }))
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

      console.log(JSON.stringify({ event: 'gemini_enrichment_start', flight_count: flightsForGemini.length }))

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

          console.log(JSON.stringify({ event: 'gemini_enrichment_response', result_count: parsedResponse.results.length }))

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
          console.error(JSON.stringify({ event: 'gemini_parse_error', response_length: responseText.length }))
        }
      } else {
        console.error(JSON.stringify({ event: 'gemini_no_response' }))
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

    console.log(JSON.stringify({ event: 'enrichment_complete', identified: results.filter(r => r.aircraft_icao).length, total: flights.length }))

    return Response.json(
      { results } as EnrichmentResponse,
      { headers: cors }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ event: 'enrichment_error', error: errorMessage, stack: error instanceof Error ? error.stack : undefined }))
    return Response.json(
      { error: `Internal server error: ${errorMessage}`, results: [] } as EnrichmentResponse,
      { status: 500, headers: cors }
    )
  }
}
