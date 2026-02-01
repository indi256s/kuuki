import {
  type ParseRequest,
  type ParseResponse,
  type ExtractedFlight,
  detectImageMimeType,
  EXTRACTION_PROMPT,
  FLIGHT_SCHEMA,
} from './_shared'

interface Env {
  GEMINI_API_KEY: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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

    // Build Gemini API request
    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []

    // Add the extraction prompt first
    parts.push({ text: EXTRACTION_PROMPT })

    // Add content based on type
    if (type === 'text') {
      parts.push({ text: `\n\nDocument content:\n${content}` })
    } else {
      const mimeType = type === 'pdf' ? 'application/pdf' : detectImageMimeType(content)
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: content,
        },
      })
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': context.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: FLIGHT_SCHEMA,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return Response.json(
        { error: 'Failed to process document', flights: [] } as ParseResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    const geminiResult = await geminiResponse.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
      error?: { message: string }
    }

    // Check for API error
    if (geminiResult.error) {
      console.error('Gemini error:', geminiResult.error)
      return Response.json(
        { error: geminiResult.error.message, flights: [] } as ParseResponse,
        { status: 502, headers: corsHeaders }
      )
    }

    // Extract response text
    const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text
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

    // Validate and normalize flights
    const validFlights = (parsedResponse.flights || [])
      .filter((flight): flight is ExtractedFlight => {
        return (
          typeof flight.date === 'string' &&
          typeof flight.origin === 'string' &&
          typeof flight.destination === 'string' &&
          typeof flight.airline_iata === 'string' &&
          flight.origin.length === 3 &&
          flight.destination.length === 3 &&
          flight.airline_iata.length === 2
        )
      })
      .map((flight) => ({
        ...flight,
        // Normalize codes to uppercase
        origin: flight.origin.toUpperCase(),
        destination: flight.destination.toUpperCase(),
        airline_iata: flight.airline_iata.toUpperCase(),
        aircraft_icao: flight.aircraft_icao?.toUpperCase(),
        // Ensure confidence is a number between 0 and 1
        confidence: Math.min(1, Math.max(0, flight.confidence || 0.5)),
      }))

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
