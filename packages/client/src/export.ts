/**
 * CSV Export Utilities
 *
 * Generates CSV files for flights and country claims with optional enrichment.
 * Uses client-side Blob API for download - no server required.
 */

import type { Flight } from './flights'
import type { CountryClaim } from './passport'
import { airports, airlines, aircraft } from '@kuuki/data'
import countriesData from '@kuuki/data/countries.json'

interface Country {
  name: string
  continent: string
}

// Create lookup maps for enrichment (Map provides O(1) lookup)
const airportMap = new Map(airports.map((a) => [a.iata, a]))
const airlineMap = new Map(airlines.map((a) => [a.iata, a]))
const aircraftMap = new Map(aircraft.map((a) => [a.icao, a]))
const countryMap = countriesData as Record<string, Country>

export interface ExportOptions {
  enriched?: boolean
}

/**
 * Portable columns - essential fields only, no IDs
 */
const FLIGHT_COLUMNS_PORTABLE = [
  'date',
  'origin',
  'destination',
  'airline_iata',
  'aircraft_icao',
  'flight_number',
  'distance_km',
  'duration_minutes',
  'source',
]

/**
 * Enriched columns - adds human-readable names
 */
const FLIGHT_COLUMNS_ENRICHED = [
  'date',
  'origin',
  'origin_name',
  'origin_city',
  'origin_country',
  'destination',
  'destination_name',
  'destination_city',
  'destination_country',
  'airline_iata',
  'airline_name',
  'aircraft_icao',
  'aircraft_name',
  'flight_number',
  'distance_km',
  'duration_minutes',
  'source',
]

/**
 * Country claims columns
 */
const CLAIM_COLUMNS = ['country_code', 'country_name', 'continent', 'claimed_at']

/**
 * Escape a value for CSV
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes quotes by doubling them
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const str = String(value)

  // Check if we need to quote
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Generate a row from an object based on columns
 */
function generateRow(
  obj: Record<string, string | number | null | undefined>,
  columns: string[],
): string {
  return columns.map((col) => escapeCSV(obj[col])).join(',')
}

/**
 * Generate CSV content with UTF-8 BOM for Excel compatibility
 */
function generateCSV(headers: string[], rows: string[]): string {
  // UTF-8 BOM helps Excel recognize the encoding
  const BOM = '\uFEFF'
  return BOM + headers.join(',') + '\n' + rows.join('\n')
}

/**
 * Generate flights CSV
 */
function generateFlightsCsv(flights: Flight[], options: ExportOptions = {}): string {
  const { enriched = false } = options
  const columns = enriched ? FLIGHT_COLUMNS_ENRICHED : FLIGHT_COLUMNS_PORTABLE

  const rows = flights.map((flight) => {
    // Start with base data
    const row: Record<string, string | number | null | undefined> = {
      date: flight.date,
      origin: flight.origin,
      destination: flight.destination,
      airline_iata: flight.airline_iata,
      aircraft_icao: flight.aircraft_icao,
      flight_number: flight.flight_number,
      distance_km: flight.distance_km,
      duration_minutes: flight.duration_minutes,
      source: flight.source,
    }

    // Add enriched data if requested
    if (enriched) {
      const originAirport = airportMap.get(flight.origin)
      const destAirport = airportMap.get(flight.destination)
      const airline = flight.airline_iata ? airlineMap.get(flight.airline_iata) : null
      const aircraft = flight.aircraft_icao ? aircraftMap.get(flight.aircraft_icao) : null

      row.origin_name = originAirport?.name ?? null
      row.origin_city = originAirport?.city ?? null
      row.origin_country = originAirport?.country ?? null
      row.destination_name = destAirport?.name ?? null
      row.destination_city = destAirport?.city ?? null
      row.destination_country = destAirport?.country ?? null
      row.airline_name = airline?.name ?? null
      row.aircraft_name = aircraft?.name ?? null
    }

    return generateRow(row, columns)
  })

  return generateCSV(columns, rows)
}

/**
 * Generate country claims CSV
 */
function generateClaimsCsv(claims: CountryClaim[]): string {
  const rows = claims.map((claim) => {
    const countryInfo = countryMap[claim.country_code]

    const row: Record<string, string | number | null | undefined> = {
      country_code: claim.country_code,
      country_name: countryInfo?.name ?? null,
      continent: countryInfo?.continent ?? null,
      claimed_at: claim.claimed_at,
    }

    return generateRow(row, CLAIM_COLUMNS)
  })

  return generateCSV(CLAIM_COLUMNS, rows)
}

/**
 * Get a timestamped filename
 */
export function getTimestampedFilename(base: string): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return `kuuki-${base}-${date}.csv`
}

/**
 * Download CSV content as a file
 */
export function downloadCsv(content: string, filename: string): void {
  // Create blob with CSV content
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  // Trigger download
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export flights as CSV file
 */
export function exportFlights(flights: Flight[], options: ExportOptions = {}): void {
  const csv = generateFlightsCsv(flights, options)
  const filename = getTimestampedFilename('flights')
  downloadCsv(csv, filename)
}

/**
 * Export country claims as CSV file
 */
export function exportClaims(claims: CountryClaim[]): void {
  const csv = generateClaimsCsv(claims)
  const filename = getTimestampedFilename('countries')
  downloadCsv(csv, filename)
}
