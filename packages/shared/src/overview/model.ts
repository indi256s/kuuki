import type { DurationSource } from '../types'

export const AGGREGATE_THRESHOLD = 5000

export type Haul = 'short' | 'medium' | 'long'
export type DepartureBand = 'night' | 'morning' | 'afternoon' | 'evening'
export interface OverviewFilter {
  period?: { years: number[] } | { from: string; to: string }
  countries?: string[]
  regions?: string[]
  airlines?: string[]
  aircraft?: string[]
  routes?: string[]
  manufacturers?: string[]
  bodyTypes?: string[]
  haul?: Haul[]
  domestic?: Array<'domestic' | 'international'>
  departureBands?: DepartureBand[]
}
export const HAUL_KM = { medium: 1500, long: 4000 } as const
export const BAND_START_HOUR = { night: 22, morning: 6, afternoon: 12, evening: 18 } as const

export interface RecordRef { flightId: number; origin: string; destination: string; value: number }
export interface RecordExtrema {
  longest: RecordRef | null; shortest: RecordRef | null
  longestDuration: RecordRef | null; shortestDuration: RecordRef | null
  biggestClockJump: RecordRef | null
}

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
  arrMinute: number | null
  distanceKm: number | null
  durationMinutes: number | null
  zonesOverflown: number | null
  durationSource: DurationSource | null
  originTz: string | null
  destTz: string | null
  departureUtc: string | null
  suppressed: 0 | 1 | 2 | 3
  recordExtrema?: RecordExtrema
  clockShiftMinutes?: number | null
}

export interface OverviewPayload {
  schemaVersion: 3
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
