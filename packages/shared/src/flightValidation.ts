export interface FlightInput {
  date?: string
  origin?: string
  destination?: string
  airline_iata?: string | null
  aircraft_icao?: string | null
  flight_number?: string | null
  departure_time?: string | null
  arrival_time?: string | null
  origin_tz?: string | null
  dest_tz?: string | null
  distance_km?: number | null
  duration_minutes?: number | null
  source?: 'manual' | 'ai_import'
  enrichment_status?: 'pending' | 'enriched' | 'failed' | 'skipped'
}

/** Most flights one POST /api/flights/bulk request may carry. */
export const FLIGHT_BULK_CREATE_MAX = 50

const fields = new Set<keyof FlightInput>([
  'date', 'origin', 'destination', 'airline_iata', 'aircraft_icao', 'flight_number',
  'departure_time', 'arrival_time', 'origin_tz', 'dest_tz', 'distance_km',
  'duration_minutes', 'source', 'enrichment_status',
])

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}

/** Pure syntax and range validation. Reference-table existence is checked by the API adapter. */
export function validateFlightInput(value: unknown, mode: 'create' | 'patch'): FlightInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Flight must be an object')
  const input = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(input)) {
    if (!fields.has(key as keyof FlightInput)) throw new Error(`Unknown flight field: ${key}`)
    if (raw === undefined) continue
    let normalized = raw
    if (['origin', 'destination', 'airline_iata', 'aircraft_icao'].includes(key) && typeof raw === 'string') normalized = raw.trim().toUpperCase()
    else if (typeof raw === 'string') normalized = raw.trim()
    if ((key === 'origin' || key === 'destination') && !(typeof normalized === 'string' && /^[A-Z]{3}$/.test(normalized))) throw new Error(`${key} must be a three-letter IATA code`)
    if (key === 'date' && !(typeof normalized === 'string' && validDate(normalized))) throw new Error('date must be a real YYYY-MM-DD calendar date')
    if (key === 'airline_iata' && normalized !== null && !(typeof normalized === 'string' && /^[A-Z0-9]{2}$/.test(normalized))) throw new Error('airline_iata is invalid')
    if (key === 'aircraft_icao' && normalized !== null && !(typeof normalized === 'string' && /^[A-Z0-9]{2,4}$/.test(normalized))) throw new Error('aircraft_icao is invalid')
    if (key === 'flight_number' && normalized !== null && !(typeof normalized === 'string' && normalized.length <= 20)) throw new Error('flight_number is invalid')
    if ((key === 'departure_time' || key === 'arrival_time') && normalized !== null && !(typeof normalized === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(normalized))) throw new Error(`${key} is invalid`)
    if (key === 'origin_tz' || key === 'dest_tz') {
      if (normalized !== null) {
        if (typeof normalized !== 'string' || normalized.length > 64) throw new Error(`${key} is invalid`)
        try { new Intl.DateTimeFormat('en-US', { timeZone: normalized }) } catch { throw new Error(`${key} is invalid`) }
      }
    }
    if (key === 'distance_km' && normalized !== null && !(typeof normalized === 'number' && Number.isFinite(normalized) && normalized >= 0 && normalized <= 20_000)) throw new Error('distance_km is invalid')
    if (key === 'duration_minutes' && normalized !== null && !(typeof normalized === 'number' && Number.isInteger(normalized) && normalized >= 0 && normalized <= 1_200)) throw new Error('duration_minutes is invalid')
    if (key === 'source' && normalized !== 'manual' && normalized !== 'ai_import') throw new Error('source is invalid')
    if (key === 'enrichment_status' && !['pending', 'enriched', 'failed', 'skipped'].includes(String(normalized))) throw new Error('enrichment_status is invalid')
    result[key] = normalized
  }
  if (mode === 'create' && (!result.date || !result.origin || !result.destination)) throw new Error('date, origin and destination are required')
  return result as FlightInput
}
