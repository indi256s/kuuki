import { GoogleGenAI, Type } from '@google/genai'
import {
  type ParseRequest,
  type ParseResponse,
  type ExtractedFlight,
  detectImageMimeType,
  EXTRACTION_PROMPT,
} from './_shared'

interface Env {
  GEMINI_API_KEY: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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

    // Validate and normalize flights
    const validFlights = (parsedResponse.flights || [])
      .filter((flight, index): flight is ExtractedFlight => {
        const isValid =
          typeof flight.date === 'string' &&
          typeof flight.origin === 'string' &&
          typeof flight.destination === 'string' &&
          typeof flight.airline_iata === 'string' &&
          flight.origin.length === 3 &&
          flight.destination.length === 3 &&
          flight.airline_iata.length === 2

        if (!isValid) {
          console.log(`Flight ${index} rejected:`, {
            date: flight.date,
            origin: `${flight.origin} (len=${flight.origin?.length})`,
            destination: `${flight.destination} (len=${flight.destination?.length})`,
            airline_iata: `${flight.airline_iata} (len=${flight.airline_iata?.length})`,
          })
        }

        return isValid
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
    console.log(`Validated ${validFlights.length} of ${parsedResponse.flights?.length || 0} flights`)

    return Response.json(
      {
        flights: validFlights,
        raw_text: parsedResponse.raw_text,
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
