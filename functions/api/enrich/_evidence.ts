import { findAircraft } from '../../../packages/data/src/aircraft-lookup'
import { normalizeFlightNumber } from '../_services/blockTimeMedian'
import { ProviderResponseError } from '../import/_provider'
import type { FlightToEnrich, EnrichmentResult } from './_shared'

export interface ProviderAircraft {
  index: number
  icao?: string | null
  name?: string | null
  confidence: number
  evidence?: string | null
  uncertainty?: string | null
  equipment_basis?: 'actual' | 'scheduled' | 'unknown'
  evidence_date?: string | null
  evidence_origin?: string | null
  evidence_destination?: string | null
  evidence_flight?: string | null
  source_urls?: string[]
  registration?: string | null
  operating_airline?: string | null
}

export function parseAircraftResults(
  text: string | undefined,
  flights: FlightToEnrich[],
): ProviderAircraft[] {
  if (!text) throw new ProviderResponseError('Empty enrichment response')
  let parsed: { results: ProviderAircraft[] }
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1'))
  } catch {
    throw new ProviderResponseError('Invalid enrichment JSON')
  }
  const nullableStrings = [
    'icao',
    'name',
    'evidence',
    'uncertainty',
    'evidence_date',
    'evidence_origin',
    'evidence_destination',
    'evidence_flight',
    'registration',
    'operating_airline',
  ] as const
  if (
    !parsed ||
    !Array.isArray(parsed.results) ||
    parsed.results.length !== flights.length ||
    new Set(parsed.results.map((row) => row?.index)).size !== flights.length ||
    parsed.results.some(
      (row) =>
        !row ||
        !Number.isInteger(row.index) ||
        row.index < 1 ||
        row.index > flights.length ||
        !Number.isFinite(row.confidence) ||
        nullableStrings.some((key) => row[key] != null && typeof row[key] !== 'string') ||
        (row.equipment_basis != null &&
          !['actual', 'scheduled', 'unknown'].includes(row.equipment_basis)) ||
        (row.source_urls != null &&
          (!Array.isArray(row.source_urls) ||
            row.source_urls.some((url) => typeof url !== 'string'))),
    )
  ) {
    throw new ProviderResponseError('Invalid enrichment response shape')
  }
  return parsed.results
}

/** A source-backed suggestion still requires review; this does not authorize a journal write. */
export function normalizeAircraftEvidence(
  row: ProviderAircraft,
  flight: FlightToEnrich,
  sources: Array<{ url: string; title: string }>,
  source: NonNullable<EnrichmentResult['source']>,
): EnrichmentResult {
  const flightNumber = normalizeFlightNumber(flight.airline_iata, flight.flight_number)
  const matchesFlight =
    row.evidence_date === flight.date &&
    row.evidence_origin === flight.origin &&
    row.evidence_destination === flight.destination &&
    !!flightNumber &&
    !!flight.airline_iata &&
    row.evidence_flight
      ?.toUpperCase()
      .replace(/\s/g, '')
      .startsWith(flight.airline_iata.toUpperCase()) &&
    normalizeFlightNumber(flight.airline_iata, row.evidence_flight) === flightNumber
  const icao = row.icao?.trim().toUpperCase()
  const offered =
    !!icao &&
    !!findAircraft(icao) &&
    row.confidence >= 0.7 &&
    !!row.evidence?.trim() &&
    matchesFlight &&
    sources.length > 0 &&
    (row.equipment_basis === 'actual' || row.equipment_basis === 'scheduled') &&
    (row.equipment_basis !== 'actual' ||
      flight.date <= new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10))
  return {
    flight_id: flight.id,
    aircraft_icao: offered ? icao : null,
    aircraft_name: offered ? (findAircraft(icao)?.name ?? row.name ?? null) : null,
    confidence: offered
      ? Math.min(row.equipment_basis === 'scheduled' ? 0.89 : 1, row.confidence)
      : 0,
    equipment_basis: offered ? row.equipment_basis : 'unknown',
    evidence_date: matchesFlight ? (row.evidence_date ?? null) : null,
    evidence: offered ? (row.evidence ?? null) : null,
    uncertainty: offered
      ? (row.uncertainty ?? null)
      : 'No matching dated search evidence for this flight.',
    sources,
    registration:
      offered && row.equipment_basis === 'actual'
        ? row.registration?.trim().toUpperCase() || null
        : null,
    operating_airline: offered ? row.operating_airline?.trim() || null : null,
    source,
  }
}
