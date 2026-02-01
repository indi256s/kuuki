import { GoogleGenAI, Type } from '@google/genai'
import {
  type ParseRequest,
  type ParseResponse,
  type ExtractedFlight,
  type RejectedFlight,
  detectImageMimeType,
  EXTRACTION_PROMPT,
  CLEANING_PROMPT,
} from './_shared'

interface Env {
  GEMINI_API_KEY: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Helper to clean messy text using Gemini (Stage 1 of two-stage parsing)
async function cleanTextWithGemini(ai: GoogleGenAI, rawText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.0-flash',
    contents: [CLEANING_PROMPT, `\n\nRaw data to clean:\n${rawText}`],
  })

  return response.text || ''
}

// JSON schema for structured output
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
        },
        required: ['date', 'origin', 'destination', 'airline_iata', 'confidence'],
      },
    },
    raw_text: {
      type: Type.STRING,
      description: 'Extracted text from the document',
    },
  },
  required: ['flights'],
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
        { error: 'Gemini API key not configured' } as ParseResponse,
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

    // Build content parts for the request
    type ContentPart = string | { inlineData: { data: string; mimeType: string } }
    const contents: ContentPart[] = [EXTRACTION_PROMPT]

    // Track cleaned text for transparency (only for text input)
    let cleanedText: string | undefined

    if (type === 'text') {
      // Two-stage parsing for text: Clean first, then extract
      console.log('Stage 1: Cleaning text input...')
      cleanedText = await cleanTextWithGemini(ai, content)
      console.log('Cleaned text:', cleanedText)

      // If cleaning produced empty result, fall back to original
      if (!cleanedText.trim()) {
        console.log('Cleaning returned empty, using original text')
        contents.push(`\n\nDocument content:\n${content}`)
      } else {
        contents.push(`\n\nDocument content:\n${cleanedText}`)
      }
    } else {
      // Single-stage parsing for PDF/image
      const mimeType = type === 'pdf' ? 'application/pdf' : detectImageMimeType(content)
      contents.push({
        inlineData: {
          data: content,
          mimeType,
        },
      })
    }

    // Call Gemini API using the official SDK
    const response = await ai.models.generateContent({
      model: 'gemini-3.0-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: FLIGHT_RESPONSE_SCHEMA,
      },
    })

    // Extract response text
    const responseText = response.text
    if (!responseText) {
      return Response.json(
        { error: 'No response from AI model', flights: [] } as ParseResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    // Parse JSON response
    let parsedResponse: { flights: ExtractedFlight[]; raw_text?: string }
    try {
      parsedResponse = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse Gemini response:', responseText)
      return Response.json(
        { error: 'Invalid response format from AI model', flights: [] } as ParseResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    // Debug: Log raw parsed flights from Gemini
    console.log('Gemini parsed flights:', JSON.stringify(parsedResponse.flights, null, 2))

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
          console.log(`Flight ${index} rejected:`, reasons.join(', '))
          return false
        }

        return true
      })
      .map((flight) => ({
        ...flight,
        // Normalize codes to uppercase
        origin: flight.origin.toUpperCase(),
        destination: flight.destination.toUpperCase(),
        airline_iata: flight.airline_iata.toUpperCase(),
        aircraft_icao: flight.aircraft_icao?.toUpperCase(),
        // Ensure confidence is a number between 0 and 1 (use ?? to preserve explicit 0)
        confidence: Math.min(1, Math.max(0, flight.confidence ?? 0.5)),
      }))

    // Debug: Log validation summary
    console.log(`Validated ${validFlights.length} of ${geminiCount} flights, rejected ${rejectedFlights.length}`)

    return Response.json(
      {
        flights: validFlights,
        raw_text: parsedResponse.raw_text,
        // Include cleaned text for transparency (text input only)
        ...(cleanedText && { cleaned_text: cleanedText }),
        // Include diagnostic info when there are rejected flights
        ...(rejectedFlights.length > 0 && {
          rejected: rejectedFlights,
          gemini_count: geminiCount,
        }),
      } as ParseResponse,
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Parse error:', error)
    return Response.json(
      { error: 'Internal server error', flights: [] } as ParseResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
