import { GoogleGenAI, Type } from '@google/genai'
import {
  type EnrichmentRequest,
  type EnrichmentResponse,
  type EnrichmentResult,
  buildBatchPrompt,
  MAX_BATCH_SIZE,
} from './_shared'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'
import { DEFAULT_MODEL, ProviderResponseError, providerFailure, usageBucket } from '../import/_provider'

// Below the 30s web client deadline; cancellation stops local work even if the provider stalls.
const ENRICHMENT_DEADLINE_MS = 20_000

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
          evidence: { type: Type.STRING, nullable: true },
          uncertainty: { type: Type.STRING, nullable: true },
        },
        required: ['index', 'confidence'],
      },
    },
  },
  required: ['results'],
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env, data } = context
  const cors = corsHeaders(request, env, 'POST, OPTIONS')

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'POST, OPTIONS')
  }

  return runHandler(async () => {
    // CSRF: state-changing, paid-quota endpoint — require same-origin + double-submit token.
    requireCsrf(request)
    // Auth gate — burns paid Gemini quota, so reject anonymous callers
    const user = requireUser(data)
    // Per-user rate limit — paid Gemini quota. Prevents one user from running up cost
    // (security finding: AI quota / cost abuse — no per-user limit).
    await rateLimit(env.DB, `import-enrich:${user.id}`, 30, 3600)

    if (!env.GEMINI_API_KEY) throw new HttpError(500, 'Gemini API key not configured')

    const body = await readJson<Partial<EnrichmentRequest>>(request, { maxBytes: 50_000 })
    const flights = body?.flights

    // Validate input
    if (!flights || !Array.isArray(flights) || flights.length === 0) {
      throw new HttpError(400, 'flights array is required and cannot be empty')
    }
    if (flights.length > MAX_BATCH_SIZE) throw new HttpError(400, `Maximum ${MAX_BATCH_SIZE} flights per request`)

    // Validate each flight has required fields
    for (const flight of flights) {
      if (!flight || typeof flight.id !== 'string' || !flight.id ||
          typeof flight.date !== 'string' || !flight.date ||
          typeof flight.origin !== 'string' || !flight.origin ||
          typeof flight.destination !== 'string' || !flight.destination) {
        throw new HttpError(400, 'Each flight must have id, date, origin, and destination')
      }
    }
    if (new Set(flights.map(flight => flight.id)).size !== flights.length) {
      throw new HttpError(400, 'Flight IDs must be unique')
    }

    const model = context.env.GEMINI_ENRICH_MODEL?.trim() || DEFAULT_MODEL
    const started = Date.now()
    try {
      // --- Gemini enrichment (grounded web search) ---
      const geminiResults = new Map<string, EnrichmentResult>()

      const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY })
      const prompt = buildBatchPrompt(flights)
      const controller = new AbortController()
      let deadlineExpired = false
      const deadline = setTimeout(() => {
        deadlineExpired = true
        controller.abort()
      }, ENRICHMENT_DEADLINE_MS)

      console.log(JSON.stringify({ event: 'gemini_enrichment_start', model, flight_count: flights.length }))

      let response: Awaited<ReturnType<typeof ai.models.generateContent>>
      try {
        response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [
            { googleSearch: {} },
          ],
          responseMimeType: 'application/json',
          responseSchema: ENRICHMENT_RESPONSE_SCHEMA,
          httpOptions: { timeout: ENRICHMENT_DEADLINE_MS },
          abortSignal: controller.signal,
        },
        })
      } catch (error) {
        if (deadlineExpired) throw new HttpError(504, 'The AI service timed out. Please try again.', 'PROVIDER_TIMEOUT')
        throw error
      } finally {
        clearTimeout(deadline)
      }

      if (!response.text) throw new ProviderResponseError('Empty enrichment response')
      let parsedResponse: { results: Array<{ index: number; icao: string | null; name: string | null; confidence: number; evidence?: string | null; uncertainty?: string | null }> }
      try {
        parsedResponse = JSON.parse(response.text)
      } catch {
        throw new ProviderResponseError('Invalid enrichment JSON')
      }
      if (!parsedResponse || !Array.isArray(parsedResponse.results) ||
          parsedResponse.results.length !== flights.length ||
          new Set(parsedResponse.results.map(r => r?.index)).size !== flights.length ||
          parsedResponse.results.some(r => !r || !Number.isInteger(r.index) ||
            r.index < 1 || r.index > flights.length ||
            (r.icao != null && typeof r.icao !== 'string') ||
            (r.name != null && typeof r.name !== 'string') ||
            (r.evidence != null && typeof r.evidence !== 'string') ||
            (r.uncertainty != null && typeof r.uncertainty !== 'string') ||
            !Number.isFinite(r.confidence))) {
        throw new ProviderResponseError('Invalid enrichment response shape')
      }
      for (const [index, flight] of flights.entries()) {
        const geminiResult = parsedResponse.results.find(r => r.index === index + 1)
        if (geminiResult) {
          geminiResults.set(flight.id, {
            flight_id: flight.id,
            aircraft_icao: geminiResult.confidence >= 0.7 && geminiResult.evidence?.trim() ? geminiResult.icao?.toUpperCase() || null : null,
            aircraft_name: geminiResult.name || null,
            confidence: geminiResult.evidence?.trim() ? Math.min(1, Math.max(0, geminiResult.confidence)) : 0,
            evidence: geminiResult.evidence ?? null,
            uncertainty: geminiResult.uncertainty ?? null,
            source: 'gemini',
          })
        }
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

      console.log(JSON.stringify({ event: 'enrichment_complete', model, outcome: 'success', duration_ms: Date.now() - started,
        usage_bucket: usageBucket(response.usageMetadata?.totalTokenCount), identified: results.filter(r => r.aircraft_icao).length, total: flights.length }))

      return Response.json(
        { results } as EnrichmentResponse,
        { headers: cors }
      )
    } catch (error) {
      if (error instanceof HttpError) throw error
      const failure = providerFailure(error)
      console.error(JSON.stringify({ event: 'enrichment_provider_error', model, code: failure.code, duration_ms: Date.now() - started }))
      throw failure
    }
  }, { headers: cors, fields: { results: [] } })
}
