/**
 * Import utility functions for flight data validation and normalization
 */

import type { ExtractedFlight } from '@/hooks/useImport'

/**
 * Detect image MIME type from base64 magic bytes
 */
export function detectImageMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // Default fallback
}

/**
 * Get MIME type for import content type
 */
export function getMimeType(type: 'pdf' | 'image' | 'text'): string {
  switch (type) {
    case 'pdf':
      return 'application/pdf'
    case 'image':
      return 'image/jpeg'
    default:
      return 'text/plain'
  }
}

/**
 * Validate an extracted flight has required fields with correct lengths
 * - origin: 3-letter IATA airport code
 * - destination: 3-letter IATA airport code
 * - airline_iata: 2-letter IATA airline code
 * - date: non-empty string
 */
export function validateFlight(flight: ExtractedFlight): boolean {
  return (
    typeof flight.date === 'string' &&
    flight.date.length > 0 &&
    typeof flight.origin === 'string' &&
    flight.origin.length === 3 &&
    typeof flight.destination === 'string' &&
    flight.destination.length === 3 &&
    typeof flight.airline_iata === 'string' &&
    flight.airline_iata.length === 2
  )
}

/**
 * Normalize a flight by converting codes to uppercase and clamping confidence
 */
export function normalizeFlight(flight: ExtractedFlight): ExtractedFlight {
  // Use nullish coalescing to preserve explicit confidence: 0
  const confidence = flight.confidence ?? 0.5
  return {
    ...flight,
    origin: flight.origin.toUpperCase(),
    destination: flight.destination.toUpperCase(),
    airline_iata: flight.airline_iata.toUpperCase(),
    aircraft_icao: flight.aircraft_icao?.toUpperCase(),
    confidence: Math.min(1, Math.max(0, confidence)),
  }
}

/**
 * Validate and normalize an array of flights, filtering out invalid ones
 */
export function processFlights(flights: ExtractedFlight[]): ExtractedFlight[] {
  return flights.filter(validateFlight).map(normalizeFlight)
}

/**
 * Estimate base64 content size in bytes
 */
export function estimateBase64Size(base64: string): number {
  return (base64.length * 3) / 4
}

/**
 * Check if content exceeds max file size (10 MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function isFileTooLarge(base64: string): boolean {
  return estimateBase64Size(base64) > MAX_FILE_SIZE
}
