import type { DurationSource } from '../types'

export const AGGREGATE_THRESHOLD = 5000

export interface OverviewRow {
  id: number
  weight: number
  date: string
  state: 'upcoming' | 'awaiting' | 'logged'
  origin: string
  destination: string
  airline: string | null
  aircraft: string | null
  flightNumber: string | null
  depMinute: number | null
  distanceKm: number | null
  durationMinutes: number | null
  zonesOverflown: number | null
  durationSource: DurationSource | null
  originTz: string | null
  destTz: string | null
  departureUtc: string | null
  suppressed: 0 | 1 | 2 | 3
}

export interface OverviewPayload {
  schemaVersion: 2
  etag: string
  generatedAt: string
  mode: 'flights' | 'aggregate'
  derivedReady: boolean
  passport: { countries: number; regions: number }
  homeOverride: string | null
  rows: OverviewRow[]
  refs: {
    airports: Record<string, { lat: number | null; lon: number | null; country: string | null; city: string | null; name: string }>
    aircraft: Record<string, { manufacturer: string | null; type: string | null; family: string | null; name: string | null }>
    regions: Record<string, string>
  }
}
