import { GoogleGenAI, Type } from '@google/genai'
import {
  type EnrichmentRequest,
  type EnrichmentResponse,
  type EnrichmentResult,
  type FlightToEnrich,
  buildBatchPrompt,
  MAX_BATCH_SIZE,
} from './_shared'

interface Env {
  GEMINI_API_KEY: string
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

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY })

    // Build the batch prompt
    const prompt = buildBatchPrompt(flights)

    console.log('Sending batch enrichment request for', flights.length, 'flights')

    // Call Gemini API with grounded web search
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [
          { googleSearch: {} },
        ],
        responseMimeType: 'application/json',
        responseSchema: ENRICHMENT_RESPONSE_SCHEMA,
      },
    })

    // Extract response text
    const responseText = response.text
    if (!responseText) {
      return Response.json(
        { error: 'No response from AI model', results: [] } as EnrichmentResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    // Parse JSON response
    let parsedResponse: { results: Array<{ index: number; icao: string | null; name: string | null; confidence: number }> }
    try {
      parsedResponse = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse Gemini response:', responseText)
      return Response.json(
        { error: 'Invalid response format from AI model', results: [] } as EnrichmentResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    console.log('Gemini enrichment response:', JSON.stringify(parsedResponse, null, 2))

    // Map Gemini results back to flight IDs
    const results: EnrichmentResult[] = flights.map((flight, index) => {
      const geminiResult = parsedResponse.results.find(r => r.index === index + 1)

      if (!geminiResult) {
        return {
          flight_id: flight.id,
          aircraft_icao: null,
          aircraft_name: null,
          confidence: 0,
        }
      }

      return {
        flight_id: flight.id,
        aircraft_icao: geminiResult.icao?.toUpperCase() || null,
        aircraft_name: geminiResult.name || null,
        confidence: Math.min(1, Math.max(0, geminiResult.confidence ?? 0)),
      }
    })

    console.log(`Enrichment complete: ${results.filter(r => r.aircraft_icao).length} of ${flights.length} identified`)

    return Response.json(
      { results } as EnrichmentResponse,
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Enrichment error:', error)
    return Response.json(
      { error: 'Internal server error', results: [] } as EnrichmentResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
