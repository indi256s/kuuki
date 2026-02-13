import { GoogleGenAI, Type } from '@google/genai'
import {
  type ParseRequest,
  type ParseResponse,
  type ExtractedFlight,
  type RejectedFlight,
  type EnrichmentStatus,
  detectImageMimeType,
  EXTRACTION_PROMPT,
  CLEANING_PROMPT,
  parseCleanedText,
  createJob,
  updateJob,
  ASYNC_THRESHOLD,
} from './_shared'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Helper to clean messy text using Gemini (Stage 1 of two-stage parsing)
async function cleanTextWithGemini(ai: GoogleGenAI, rawText: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${CLEANING_PROMPT}\n\nRaw data to clean:\n${rawText}`,
    })

    return response.text || ''
  } catch (error) {
    console.error(JSON.stringify({ event: 'cleaning_error', error: String(error) }))
    // Return empty to fall back to original text
    return ''
  }
}

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
                description: 'true if year was explicitly visible in document, false if inferred',
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

// Count estimated flights from cleaned text (one flight per line)
function estimateFlightCount(cleanedText: string): number {
  return cleanedText.trim().split('\n').filter(line => line.trim()).length
}

// Core extraction logic (Phase 2 - full Gemini extraction with aircraft/times)
async function extractFlightsWithGemini(
  ai: GoogleGenAI,
  contents: (string | { inlineData: { data: string; mimeType: string } })[],
  cleanedText?: string
): Promise<{
  flights: ExtractedFlight[]
  raw_text?: string
  rejected?: RejectedFlight[]
  gemini_count?: number
  cleaned_text?: string
}> {
  // Call Gemini API using the official SDK
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: FLIGHT_RESPONSE_SCHEMA,
    },
  })

  // Extract response text
  const responseText = response.text
  if (!responseText) {
    throw new Error('No response from AI model')
  }

  // Parse JSON response
  let parsedResponse: { flights: ExtractedFlight[]; raw_text?: string }
  try {
    parsedResponse = JSON.parse(responseText)
  } catch {
    console.error(JSON.stringify({ event: 'gemini_parse_error', response_length: responseText.length }))
    throw new Error('Invalid response format from AI model')
  }

  console.log(JSON.stringify({ event: 'gemini_parsed', flight_count: parsedResponse.flights?.length ?? 0 }))

  // Validate and normalize flights, collecting rejected ones for diagnostics
  const rejectedFlights: RejectedFlight[] = []
  const geminiCount = parsedResponse.flights?.length || 0

  const validFlights = (parsedResponse.flights || [])
    .filter((flight, index): flight is ExtractedFlight => {
      const reasons: string[] = []

      if (typeof flight.date !== 'string' || !flight.date) {
        reasons.push('missing date')
      }
      if (typeof flight.origin !== 'string') {
        reasons.push('missing origin')
      } else if (flight.origin.length !== 3) {
        reasons.push(`origin "${flight.origin}" is not 3 letters`)
      }
      if (typeof flight.destination !== 'string') {
        reasons.push('missing destination')
      } else if (flight.destination.length !== 3) {
        reasons.push(`destination "${flight.destination}" is not 3 letters`)
      }
      if (typeof flight.airline_iata !== 'string') {
        reasons.push('missing airline code')
      } else if (flight.airline_iata.length !== 2) {
        reasons.push(`airline "${flight.airline_iata}" is not 2 letters`)
      }

      if (reasons.length > 0) {
        rejectedFlights.push({
          index,
          date: flight.date,
          origin: flight.origin,
          destination: flight.destination,
          airline_iata: flight.airline_iata,
          reason: reasons.join(', '),
        })
        console.log(JSON.stringify({ event: 'flight_rejected', index, reasons }))
        return false
      }

      return true
    })
    .map((flight) => {
      // Normalize codes to uppercase, convert empty time strings to undefined
      const normalizedFlight = {
        ...flight,
        origin: flight.origin.toUpperCase(),
        destination: flight.destination.toUpperCase(),
        airline_iata: flight.airline_iata.toUpperCase(),
        aircraft_icao: flight.aircraft_icao?.toUpperCase(),
        departure_time: flight.departure_time || undefined,
        arrival_time: flight.arrival_time || undefined,
        // Ensure confidence is a number between 0 and 1 (use ?? to preserve explicit 0)
        confidence: Math.min(1, Math.max(0, flight.confidence ?? 0.5)),
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

  return {
    flights: validFlights,
    raw_text: parsedResponse.raw_text,
    ...(cleanedText && { cleaned_text: cleanedText }),
    ...(rejectedFlights.length > 0 && {
      rejected: rejectedFlights,
      gemini_count: geminiCount,
    }),
  }
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
        { error: 'Gemini API key not configured', flights: [] } as ParseResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    // Parse request
    const body = await context.request.json() as ParseRequest
    const { type, content } = body

    // Validate input
    if (!type || !['pdf', 'image', 'text'].includes(type)) {
      return Response.json(
        { error: 'Invalid type. Must be pdf, image, or text', flights: [] } as ParseResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    if (!content) {
      return Response.json(
        { error: 'Content is required', flights: [] } as ParseResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    // Check file size for base64 content
    if (type !== 'text') {
      const estimatedSize = (content.length * 3) / 4
      if (estimatedSize > MAX_FILE_SIZE) {
        return Response.json(
          { error: 'File too large. Maximum size is 10 MB', flights: [] } as ParseResponse,
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY })
    const kv = context.env.IMPORT_JOBS

    // Build content parts for full extraction
    type ContentPart = string | { inlineData: { data: string; mimeType: string } }
    const contents: ContentPart[] = [EXTRACTION_PROMPT]

    // Track cleaned text for transparency (only for text input)
    let cleanedText: string | undefined

    if (type === 'text') {
      // ========================================================================
      // TWO-PHASE IMPORT FOR TEXT
      // Phase 1: Clean → Regex parse → Return basic flights immediately
      // Phase 2: Full Gemini extraction in background → Update via polling
      // ========================================================================

      console.log(JSON.stringify({ event: 'phase1_start', action: 'cleaning_text' }))
      cleanedText = await cleanTextWithGemini(ai, content)
      console.log(JSON.stringify({ event: 'phase1_cleaned', cleaned_length: cleanedText.length }))

      // If cleaning produced empty result, fall back to original text
      const textForExtraction = cleanedText.trim() ? cleanedText : content
      contents.push(`\n\nDocument content:\n${textForExtraction}`)

      const estimatedCount = estimateFlightCount(textForExtraction)
      console.log(JSON.stringify({ event: 'flight_estimate', count: estimatedCount }))

      const basicFlights = parseCleanedText(textForExtraction)
      console.log(JSON.stringify({ event: 'phase1_regex_parsed', flight_count: basicFlights.length }))

      // For large imports (10+), use two-phase approach
      if (estimatedCount >= ASYNC_THRESHOLD && basicFlights.length > 0) {
        // Create enrichment job in KV
        const job = await createJob(kv, 'enrichment')
        console.log(JSON.stringify({ event: 'two_phase_start', job_id: job.id, flight_count: basicFlights.length }))

        // Phase 2: Background Gemini extraction
        context.waitUntil(
          (async () => {
            try {
              const result = await extractFlightsWithGemini(ai, contents, cleanedText)
              await updateJob(kv, job.id, {
                status: 'completed',
                flights: result.flights,
                rejected: result.rejected,
                gemini_count: result.gemini_count,
                cleaned_text: result.cleaned_text,
              })
              console.log(JSON.stringify({ event: 'enrichment_job_complete', job_id: job.id, flight_count: result.flights.length }))
            } catch (error) {
              console.error(JSON.stringify({ event: 'enrichment_job_failed', job_id: job.id, error: String(error) }))
              await updateJob(kv, job.id, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          })()
        )

        // Return basic flights immediately with enrichment job ID
        return Response.json(
          {
            flights: basicFlights,
            enrichmentJobId: job.id,
            enrichmentStatus: 'pending',
            cleaned_text: cleanedText,
          } as ParseResponse,
          { headers: corsHeaders }
        )
      }

      // For small imports (<10 flights), do synchronous full extraction
      // This is faster overall than two-phase for small batches
    } else {
      // Single-stage parsing for PDF/image (no two-phase for now - harder to estimate)
      const mimeType = type === 'pdf' ? 'application/pdf' : detectImageMimeType(content)
      contents.push({
        inlineData: {
          data: content,
          mimeType,
        },
      })
    }

    // Sync path: full extraction and return immediately
    const result = await extractFlightsWithGemini(ai, contents, cleanedText)

    return Response.json(
      {
        ...result,
        enrichmentStatus: 'completed', // Mark as complete since we did full extraction
      } as ParseResponse,
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error(JSON.stringify({ event: 'parse_error', error: String(error) }))
    return Response.json(
      { error: 'Internal server error', flights: [] } as ParseResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
