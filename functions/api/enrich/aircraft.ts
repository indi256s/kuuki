import { GoogleGenAI, Type } from '@google/genai'
import {
  type EnrichmentRequest,
  type EnrichmentResponse,
  type EnrichmentResult,
  buildBatchPrompt,
  MAX_BATCH_SIZE,
} from './_shared'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, type RequestData } from '../_lib/auth'
import { rateLimit } from '../_lib/ratelimit'

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

export const onRequestPost: PagesFunction<Env, string, RequestData> = async (context) => {
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

  // Auth gate — burns paid Gemini quota, so reject anonymous callers
  const user = (context.data && context.data.user) || null
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required', code: 'UNAUTHENTICATED', results: [] }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  // Per-user rate limit — paid Gemini quota. Prevents one user from running up cost
  // (security finding: AI quota / cost abuse — no per-user limit).
  try {
    await rateLimit(env.IMPORT_JOBS, `enrich:${user.id}`, 30, 3600)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Too many requests — please slow down', code: 'RATE_LIMITED', results: [] }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...cors } }
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

    // --- Gemini enrichment (grounded web search) ---
    const geminiResults = new Map<string, EnrichmentResult>()

    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY })
    const prompt = buildBatchPrompt(flights)

    console.log(JSON.stringify({ event: 'gemini_enrichment_start', flight_count: flights.length }))

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

        for (const flight of flights) {
          const geminiIndex = flights.indexOf(flight) + 1
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

    // --- Merge results (Gemini-only) ---
    const results: EnrichmentResult[] = flights.map((flight) => {
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
    // Security finding #7: do NOT echo error.message to the client. Log detail server-side only.
    console.error(JSON.stringify({ event: 'enrichment_error', error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }))
    return Response.json(
      { error: 'Internal server error', results: [] } as EnrichmentResponse,
      { status: 500, headers: cors }
    )
  }
}
