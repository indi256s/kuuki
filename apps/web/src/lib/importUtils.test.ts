import { describe, it, expect } from 'vitest'
import {
  detectImageMimeType,
  getMimeType,
  validateFlight,
  normalizeFlight,
  processFlights,
  estimateBase64Size,
  isFileTooLarge,
  MAX_FILE_SIZE,
} from './importUtils'
import type { ExtractedFlight } from '@/hooks/useImport'

describe('detectImageMimeType', () => {
  it('detects JPEG from base64 magic bytes', () => {
    const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD'
    expect(detectImageMimeType(jpegBase64)).toBe('image/jpeg')
  })

  it('detects PNG from base64 magic bytes', () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
    expect(detectImageMimeType(pngBase64)).toBe('image/png')
  })

  it('detects GIF from base64 magic bytes', () => {
    const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    expect(detectImageMimeType(gifBase64)).toBe('image/gif')
  })

  it('detects WebP from base64 magic bytes', () => {
    const webpBase64 = 'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAUAmJYgCdAEO'
    expect(detectImageMimeType(webpBase64)).toBe('image/webp')
  })

  it('defaults to JPEG for unknown formats', () => {
    const unknownBase64 = 'AAAAAAAAAAAAAAAAAAAAAA=='
    expect(detectImageMimeType(unknownBase64)).toBe('image/jpeg')
  })
})

describe('getMimeType', () => {
  it('returns application/pdf for pdf type', () => {
    expect(getMimeType('pdf')).toBe('application/pdf')
  })

  it('returns image/jpeg for image type', () => {
    expect(getMimeType('image')).toBe('image/jpeg')
  })

  it('returns text/plain for text type', () => {
    expect(getMimeType('text')).toBe('text/plain')
  })
})

describe('validateFlight', () => {
  const validFlight: ExtractedFlight = {
    date: '2024-03-15',
    origin: 'JFK',
    destination: 'LAX',
    airline_iata: 'AA',
    confidence: 0.95,
  }

  it('returns true for valid flight with 3-letter airports and 2-letter airline', () => {
    expect(validateFlight(validFlight)).toBe(true)
  })

  it('returns false when origin is not 3 characters', () => {
    expect(validateFlight({ ...validFlight, origin: 'JFKK' })).toBe(false)
    expect(validateFlight({ ...validFlight, origin: 'JF' })).toBe(false)
    expect(validateFlight({ ...validFlight, origin: '' })).toBe(false)
  })

  it('returns false when destination is not 3 characters', () => {
    expect(validateFlight({ ...validFlight, destination: 'LAXX' })).toBe(false)
    expect(validateFlight({ ...validFlight, destination: 'LA' })).toBe(false)
  })

  it('returns false when airline_iata is not 2 characters', () => {
    expect(validateFlight({ ...validFlight, airline_iata: 'AAA' })).toBe(false)
    expect(validateFlight({ ...validFlight, airline_iata: 'A' })).toBe(false)
    expect(validateFlight({ ...validFlight, airline_iata: '' })).toBe(false)
  })

  it('returns false when date is missing or empty', () => {
    expect(validateFlight({ ...validFlight, date: '' })).toBe(false)
  })

  it('accepts valid flight with optional fields', () => {
    const flightWithOptionals: ExtractedFlight = {
      ...validFlight,
      flight_number: '123',
      aircraft_icao: 'B738',
      departure_time: '08:30',
      arrival_time: '11:45',
    }
    expect(validateFlight(flightWithOptionals)).toBe(true)
  })
})

describe('normalizeFlight', () => {
  const validFlight: ExtractedFlight = {
    date: '2024-03-15',
    origin: 'jfk',
    destination: 'lax',
    airline_iata: 'aa',
    confidence: 0.95,
  }

  it('converts origin to uppercase', () => {
    const normalized = normalizeFlight(validFlight)
    expect(normalized.origin).toBe('JFK')
  })

  it('converts destination to uppercase', () => {
    const normalized = normalizeFlight(validFlight)
    expect(normalized.destination).toBe('LAX')
  })

  it('converts airline_iata to uppercase', () => {
    const normalized = normalizeFlight(validFlight)
    expect(normalized.airline_iata).toBe('AA')
  })

  it('converts aircraft_icao to uppercase when present', () => {
    const flightWithAircraft = { ...validFlight, aircraft_icao: 'b738' }
    const normalized = normalizeFlight(flightWithAircraft)
    expect(normalized.aircraft_icao).toBe('B738')
  })

  it('preserves undefined aircraft_icao', () => {
    const normalized = normalizeFlight(validFlight)
    expect(normalized.aircraft_icao).toBeUndefined()
  })

  it('clamps confidence above 1 to 1', () => {
    const flight = { ...validFlight, confidence: 1.5 }
    expect(normalizeFlight(flight).confidence).toBe(1)
  })

  it('clamps confidence below 0 to 0', () => {
    const flight = { ...validFlight, confidence: -0.5 }
    expect(normalizeFlight(flight).confidence).toBe(0)
  })

  it('preserves confidence within valid range', () => {
    const flight = { ...validFlight, confidence: 0.75 }
    expect(normalizeFlight(flight).confidence).toBe(0.75)
  })

  it('preserves confidence of 0', () => {
    const flightZeroConfidence = { ...validFlight, confidence: 0 }
    expect(normalizeFlight(flightZeroConfidence).confidence).toBe(0)
  })

  it('defaults confidence to 0.5 when undefined', () => {
    const flightNoConfidence = { ...validFlight, confidence: undefined as unknown as number }
    expect(normalizeFlight(flightNoConfidence).confidence).toBe(0.5)
  })

  it('preserves other fields unchanged', () => {
    const flightWithAll: ExtractedFlight = {
      ...validFlight,
      flight_number: '123',
      departure_time: '08:30',
      arrival_time: '11:45',
    }
    const normalized = normalizeFlight(flightWithAll)
    expect(normalized.date).toBe('2024-03-15')
    expect(normalized.flight_number).toBe('123')
    expect(normalized.departure_time).toBe('08:30')
    expect(normalized.arrival_time).toBe('11:45')
  })
})

describe('processFlights', () => {
  it('filters out invalid flights and normalizes valid ones', () => {
    const flights: ExtractedFlight[] = [
      { date: '2024-03-15', origin: 'jfk', destination: 'lax', airline_iata: 'aa', confidence: 0.9 },
      { date: '2024-03-16', origin: 'INVALID', destination: 'LAX', airline_iata: 'AA', confidence: 0.8 },
      { date: '2024-03-17', origin: 'sfo', destination: 'ord', airline_iata: 'ua', confidence: 0.85 },
    ]

    const result = processFlights(flights)

    expect(result).toHaveLength(2)
    expect(result[0].origin).toBe('JFK')
    expect(result[0].destination).toBe('LAX')
    expect(result[1].origin).toBe('SFO')
    expect(result[1].destination).toBe('ORD')
  })

  it('returns empty array when all flights are invalid', () => {
    const flights: ExtractedFlight[] = [
      { date: '', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', confidence: 0.9 },
      { date: '2024-03-16', origin: 'JF', destination: 'LAX', airline_iata: 'AA', confidence: 0.8 },
    ]

    expect(processFlights(flights)).toHaveLength(0)
  })

  it('handles empty input array', () => {
    expect(processFlights([])).toEqual([])
  })
})

describe('estimateBase64Size', () => {
  it('estimates size correctly', () => {
    // 100 base64 chars ≈ 75 bytes
    const base64 = 'A'.repeat(100)
    expect(estimateBase64Size(base64)).toBe(75)
  })
})

describe('isFileTooLarge', () => {
  it('returns false for small files', () => {
    const smallBase64 = 'A'.repeat(1000)
    expect(isFileTooLarge(smallBase64)).toBe(false)
  })

  it('returns true when file exceeds MAX_FILE_SIZE', () => {
    // Create base64 that would decode to > 10 MB
    // 10 MB = 10485760 bytes, need ~13981014 base64 chars
    const largeBase64 = 'A'.repeat(14000000)
    expect(isFileTooLarge(largeBase64)).toBe(true)
  })

  it('MAX_FILE_SIZE is 10 MB', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
  })
})
