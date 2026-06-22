// Shared flight list filtering / sorting / pagination, used by GET /api/flights (list) and
// GET /api/flights/ids so the two stay in lockstep. SECURITY: sort field + direction are
// allowlisted because the column name is interpolated into SQL; every value is bound. Mirrors the
// frontend FlightFilters in apps/web/src/lib/flights.ts (Phase 6 maps those onto these query params).

export interface FlightFilters {
  year?: number
  airlineIata?: string
  aircraftIcao?: string
  isUpcoming?: boolean
  origin?: string
  destination?: string
  originCodes?: string[]
  destinationCodes?: string[]
  airlineIataCodes?: string[]
}

const SORT_FIELDS = new Set([
  'date',
  'origin',
  'destination',
  'airline_iata',
  'aircraft_icao',
  'distance_km',
  'duration_minutes',
])

// Cap multi-value filters so a caller can't blow past D1's ~100 bound-variable limit
// (security hardening: uncapped IN-clause arrays → self-DoS at runtime).
const MAX_FILTER_VALUES = 25

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts.slice(0, MAX_FILTER_VALUES) : undefined
}

/** Parse FlightFilters from the request query string (?year=&airlineIata=&originCodes=a,b ...). */
export function parseFlightFilters(params: URLSearchParams): FlightFilters {
  const filters: FlightFilters = {}
  const year = params.get('year')
  if (year && /^\d{4}$/.test(year)) filters.year = Number(year)
  const airlineIata = params.get('airlineIata')
  if (airlineIata) filters.airlineIata = airlineIata
  const aircraftIcao = params.get('aircraftIcao')
  if (aircraftIcao) filters.aircraftIcao = aircraftIcao
  const isUpcoming = params.get('isUpcoming')
  if (isUpcoming === 'true') filters.isUpcoming = true
  else if (isUpcoming === 'false') filters.isUpcoming = false
  const origin = params.get('origin')
  if (origin) filters.origin = origin.toUpperCase()
  const destination = params.get('destination')
  if (destination) filters.destination = destination.toUpperCase()
  const originCodes = csv(params.get('originCodes'))
  if (originCodes) filters.originCodes = originCodes.map((c) => c.toUpperCase())
  const destinationCodes = csv(params.get('destinationCodes'))
  if (destinationCodes) filters.destinationCodes = destinationCodes.map((c) => c.toUpperCase())
  const airlineIataCodes = csv(params.get('airlineIataCodes'))
  if (airlineIataCodes) filters.airlineIataCodes = airlineIataCodes
  return filters
}

/** Build the WHERE clause (always scoped to user_id) + bound params for a flight list / ids query. */
export function buildFlightWhere(userId: string, filters: FlightFilters): { where: string; binds: (string | number)[] } {
  const clauses: string[] = ['user_id = ?']
  const binds: (string | number)[] = [userId]
  if (filters.year) {
    clauses.push('date >= ? AND date <= ?')
    binds.push(`${filters.year}-01-01`, `${filters.year}-12-31`)
  }
  if (filters.airlineIataCodes?.length) {
    clauses.push(`airline_iata IN (${filters.airlineIataCodes.map(() => '?').join(', ')})`)
    binds.push(...filters.airlineIataCodes)
  } else if (filters.airlineIata) {
    clauses.push('airline_iata = ?')
    binds.push(filters.airlineIata)
  }
  if (filters.aircraftIcao) {
    clauses.push('aircraft_icao = ?')
    binds.push(filters.aircraftIcao)
  }
  if (filters.isUpcoming !== undefined) {
    clauses.push('is_upcoming = ?')
    binds.push(filters.isUpcoming ? 1 : 0)
  }
  if (filters.originCodes?.length) {
    clauses.push(`origin IN (${filters.originCodes.map(() => '?').join(', ')})`)
    binds.push(...filters.originCodes)
  } else if (filters.origin) {
    clauses.push('origin = ?')
    binds.push(filters.origin)
  }
  if (filters.destinationCodes?.length) {
    clauses.push(`destination IN (${filters.destinationCodes.map(() => '?').join(', ')})`)
    binds.push(...filters.destinationCodes)
  } else if (filters.destination) {
    clauses.push('destination = ?')
    binds.push(filters.destination)
  }
  return { where: clauses.join(' AND '), binds }
}

export interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

/** Allowlisted sort (?sortField=&sortOrder=). Unknown fields fall back to date; default desc. */
export function parseSort(params: URLSearchParams): SortConfig {
  const field = params.get('sortField') ?? 'date'
  const order = params.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  return { field: SORT_FIELDS.has(field) ? field : 'date', order }
}

/** ORDER BY built from an already-validated SortConfig, with a stable id tiebreak. */
export function orderByClause(sort: SortConfig): string {
  const dir = sort.order === 'asc' ? 'ASC' : 'DESC'
  return `ORDER BY ${sort.field} ${dir}, id ${dir}`
}

export function parsePagination(params: URLSearchParams, defaultLimit = 20): { limit: number; offset: number } {
  const rawLimit = Number(params.get('limit'))
  const rawOffset = Number(params.get('offset'))
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : defaultLimit
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0
  return { limit, offset }
}
