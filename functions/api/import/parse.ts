import { GoogleGenAI, Type } from '@google/genai'
import {
  type ParseRequest,
  type ParseResponse,
  type ExtractedFlight,
  type RejectedFlight,
  type EnrichmentStatus,
  detectImageMimeType,
  EXTRACTION_PROMPT,
} from './_shared'
import { decodedBase64Size } from './_body'
import { DEFAULT_MODEL, PROVIDER_TIMEOUT_MS, ProviderResponseError, providerFailure, usageBucket } from './_provider'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_TEXT_LENGTH = 100_000 // chars — cap the (previously uncapped) text branch; controls Gemini cost
// A 10 MiB file becomes at most 13,981,016 base64 bytes; 14 MiB includes
// the JSON envelope. The stream limit applies even without Content-Length.
const MAX_IMPORT_BODY_BYTES = 14 * 1024 * 1024

// JSON schema for structured output (full extraction with aircraft/times)
const FLIGHT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    flights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: {
            type: Type.STRING,
            description: 'Flight date in YYYY-MM-DD format',
          },
          origin: {
            type: Type.STRING,
            description: '3-letter IATA airport code for departure',
          },
          destination: {
            type: Type.STRING,
            description: '3-letter IATA airport code for arrival',
          },
          airline_iata: {
            type: Type.STRING,
            description: '2-letter IATA airline code',
          },
          flight_number: {
            type: Type.STRING,
            description: 'Flight number (digits only)',
          },
          aircraft_icao: {
            type: Type.STRING,
            description: '4-letter ICAO aircraft type code',
          },
          departure_time: {
            type: Type.STRING,
            description: 'Departure time in HH:mm format',
          },
          arrival_time: {
            type: Type.STRING,
            description: 'Arrival time in HH:mm format',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Overall confidence score 0-1',
          },
          field_confidence: {
            type: Type.OBJECT,
            description: 'Per-field confidence scores',
            properties: {
              date: { type: Type.NUMBER, description: 'Confidence for date field 0-1' },
              date_year_explicit: {
                type: Type.BOOLEAN,
                description: 'true only if the year is explicitly visible; false when absent, with date empty',
              },
              origin: { type: Type.NUMBER, description: 'Confidence for origin field 0-1' },
              destination: { type: Type.NUMBER, description: 'Confidence for destination field 0-1' },
              airline_iata: { type: Type.NUMBER, description: 'Confidence for airline code 0-1' },
              flight_number: { type: Type.NUMBER, description: 'Confidence for flight number 0-1' },
              aircraft_icao: { type: Type.NUMBER, description: 'Confidence for aircraft type 0-1' },
              departure_time: { type: Type.NUMBER, description: 'Confidence for departure time 0-1' },
              arrival_time: { type: Type.NUMBER, description: 'Confidence for arrival time 0-1' },
            },
          },
        },
        required: ['date', 'origin', 'destination', 'airline_iata', 'departure_time', 'arrival_time', 'confidence'],
      },
    },
    raw_text: {
      type: Type.STRING,
      description: 'Extracted text from the document',
    },
  },
  required: ['flights'],
}

// One structured extraction for text, image, and PDF.
async function extractFlightsWithGemini(
  ai: GoogleGenAI,
  model: string,
  contents: (string | { inlineData: { data: string; mimeType: string } })[],
  signal: AbortSignal,
): Promise<{
  flights: ExtractedFlight[]
  raw_text?: string
  rejected?: RejectedFlight[]
  gemini_count?: number
}> {
  // Call Gemini API using the official SDK
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: FLIGHT_RESPONSE_SCHEMA,
      httpOptions: { timeout: PROVIDER_TIMEOUT_MS },
      abortSignal: signal,
    },
  })

  // Extract response text
  const responseText = response.text
  if (!responseText) {
    throw new ProviderResponseError('Empty AI response')
  }

  // Parse JSON response
  let parsedResponse: { flights: ExtractedFlight[]; raw_text?: string }
  try {
    parsedResponse = JSON.parse(responseText)
  } catch {
    console.error(JSON.stringify({ event: 'gemini_parse_error', response_length: responseText.length }))
    throw new ProviderResponseError('Invalid AI JSON')
  }
  if (!parsedResponse || !Array.isArray(parsedResponse.flights)) {
    throw new ProviderResponseError('Invalid AI response shape')
  }

  console.log(JSON.stringify({ event: 'gemini_parsed', flight_count: parsedResponse.flights?.length ?? 0 }))
  console.log(JSON.stringify({ event: 'import_provider_usage', model, usage_bucket: usageBucket(response.usageMetadata?.totalTokenCount) }))

  // Validate and normalize flights, collecting rejected ones for diagnostics
  const rejectedFlights: RejectedFlight[] = []
  const geminiCount = parsedResponse.flights?.length || 0

  const validFlights = parsedResponse.flights
    .filter((flight, index): flight is ExtractedFlight => {
      const reasons: string[] = []

      if (!flight || typeof flight !== 'object') {
        rejectedFlights.push({ index, reason: 'invalid flight object' })
        return false
      }
      if (typeof flight.origin !== 'string') {
        reasons.push('missing origin')
      } else if (flight.origin.length !== 3) {
        reasons.push('origin is not 3 letters')
      }
      if (typeof flight.destination !== 'string') {
        reasons.push('missing destination')
      } else if (flight.destination.length !== 3) {
        reasons.push('destination is not 3 letters')
      }
      // Apply ZZ placeholder for missing airline instead of rejecting
      if (typeof flight.airline_iata !== 'string' || !flight.airline_iata) {
        flight.airline_iata = 'ZZ'
        flight.airline_was_placeholder = true
        flight.field_confidence = {
          ...flight.field_confidence,
          airline_iata: 0,  // Zero confidence for placeholder
        }
      } else if (flight.airline_iata.length !== 2) {
        // Still reject invalid lengths
        reasons.push('airline is not 2 letters')
      }

      if (reasons.length > 0) {
        rejectedFlights.push({ index, reason: reasons.join(', ') })
        console.log(JSON.stringify({ event: 'flight_rejected', index }))
        return false
      }

      return true
    })
    .map((flight) => {
      // Normalize codes to uppercase, convert empty time strings to undefined
      // A model-supplied year without explicit source evidence is never a save-ready fact.
      // Keep the draft for review with a blank date and a visible provenance flag.
      const explicitYear = flight.field_confidence?.date_year_explicit === true
      const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value)) : 0
      const fields = flight.field_confidence
      const normalizedFlight: ExtractedFlight = {
        date: explicitYear && /^\d{4}-\d{2}-\d{2}$/.test(flight.date) ? flight.date : '',
        origin: flight.origin.toUpperCase(),
        destination: flight.destination.toUpperCase(),
        airline_iata: flight.airline_iata.toUpperCase(),
        flight_number: typeof flight.flight_number === 'string' ? flight.flight_number : undefined,
        aircraft_icao: typeof flight.aircraft_icao === 'string' ? flight.aircraft_icao.toUpperCase() : undefined,
        departure_time: typeof flight.departure_time === 'string' ? flight.departure_time || undefined : undefined,
        arrival_time: typeof flight.arrival_time === 'string' ? flight.arrival_time || undefined : undefined,
        confidence: score(flight.confidence),
        airline_was_placeholder: flight.airline_was_placeholder === true,
        field_confidence: {
          date: score(fields?.date),
          date_year_explicit: explicitYear,
          origin: score(fields?.origin),
          destination: score(fields?.destination),
          airline_iata: score(fields?.airline_iata),
          flight_number: score(fields?.flight_number),
          aircraft_icao: score(fields?.aircraft_icao),
          departure_time: score(fields?.departure_time),
          arrival_time: score(fields?.arrival_time),
        },
      }

      // Determine enrichment_status based on aircraft data
      // - 'skipped' if aircraft_icao is present with high confidence
      // - 'pending' if we need to enrich it later
      const aircraftConfidence = flight.field_confidence?.aircraft_icao ?? 0
      const enrichmentStatus: EnrichmentStatus =
        normalizedFlight.aircraft_icao && aircraftConfidence >= 0.8
          ? 'skipped'
          : 'pending'

      return {
        ...normalizedFlight,
        enrichment_status: enrichmentStatus,
      }
    })

  console.log(JSON.stringify({ event: 'validation_complete', valid: validFlights.length, total: geminiCount, rejected: rejectedFlights.length }))
  if (geminiCount > 0 && validFlights.length === 0) {
    throw new ProviderResponseError('No usable extracted flights')
  }

  return {
    flights: validFlights,
    raw_text: typeof parsedResponse.raw_text === 'string' ? parsedResponse.raw_text.slice(0, MAX_TEXT_LENGTH) : undefined,
    ...(rejectedFlights.length > 0 && {
      rejected: rejectedFlights,
      gemini_count: geminiCount,
    }),
  }
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  parseImportRequest(context.request, context.env, context.data)

/** Real Request/Response transport entry; provider execution remains single-call. */
export async function parseImportRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
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
    // Per-user rate limit — each parse makes paid Gemini calls (security finding: AI quota/cost abuse).
    await rateLimit(env.DB, `import-parse:${user.id}`, 20, 3600)

    if (!env.GEMINI_API_KEY) throw new HttpError(500, 'Gemini API key not configured')

    const body = await readJson<Partial<ParseRequest>>(request, { maxBytes: MAX_IMPORT_BODY_BYTES })
    const type = body?.type
    const content = body?.content
    if (!type || !['pdf', 'image', 'text'].includes(type)) {
      throw new HttpError(400, 'Invalid type. Must be pdf, image, or text')
    }
    if (typeof content !== 'string' || !content) throw new HttpError(400, 'Content is required')
    if (type !== 'text') {
      if (decodedBase64Size(content) > MAX_FILE_SIZE) throw new HttpError(413, 'File too large. Maximum size is 10 MB')
    } else if (content.length > MAX_TEXT_LENGTH) {
      throw new HttpError(400, 'Text too long. Maximum is 100,000 characters')
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
    type ContentPart = string | { inlineData: { data: string; mimeType: string } }
    const contents: ContentPart[] = [EXTRACTION_PROMPT]
    if (type === 'text') {
      contents.push(`\n\nDocument content:\n${content}`)
    } else {
      const mimeType = type === 'pdf' ? 'application/pdf' : detectImageMimeType(content)
      contents.push({
        inlineData: {
          data: content,
          mimeType,
        },
      })
    }

    const model = env.GEMINI_IMPORT_MODEL?.trim() || DEFAULT_MODEL
    let result: ParseResponse
    const started = Date.now()
    const controller = new AbortController()
    let deadlineExpired = false
    const deadline = setTimeout(() => { deadlineExpired = true; controller.abort() }, PROVIDER_TIMEOUT_MS)
    try {
      result = await extractFlightsWithGemini(ai, model, contents, controller.signal)
      console.log(JSON.stringify({ event: 'import_provider_result', model, outcome: 'success', duration_ms: Date.now() - started }))
    } catch (error) {
      const failure = deadlineExpired
        ? new HttpError(504, 'The AI service timed out. Please try again.', 'PROVIDER_TIMEOUT')
        : providerFailure(error)
      console.error(JSON.stringify({ event: 'import_provider_result', model, outcome: failure.code, duration_ms: Date.now() - started }))
      throw failure
    } finally {
      clearTimeout(deadline)
    }

    return Response.json(result, { headers: cors })
  }, { headers: cors, fields: { flights: [] } })
}
