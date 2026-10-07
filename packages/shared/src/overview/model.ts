import type { DurationSource } from '../types'
import type { Alliance } from '../../../data/src/alliance-membership'
import type { MakerKey } from '../../../data/src/aircraft-makers'

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
  airports?: string[]
  alliances?: Alliance[]
  families?: string[]
  makers?: MakerKey[]
  bodies?: Array<'narrow' | 'wide'>
  depHours?: number[]
  arrHours?: number[]
  haul?: Haul[]
  domestic?: Array<'domestic' | 'international'>
  departureBands?: DepartureBand[]
}
export type FacetKey = Exclude<keyof OverviewFilter, 'period'>
export const HAUL_KM = { medium: 1500, long: 4000 } as const
export const BAND_START_HOUR = { night: 22, morning: 6, afternoon: 12, evening: 18 } as const

export interface RecordRef { flightId: number | null; origin: string; destination: string; value: number }
// Source identities stay numeric until the cabinet is projected, including legacy carried extrema.
export interface SourceRecordRef { flightId: number; origin: string; destination: string; value: number }
export interface DistanceRecordWitness extends SourceRecordRef {
  date?: string | null
  airline?: string | null
  flightNumber?: string | null
  durationMinutes?: number | null
  durationSource?: DurationSource | null
  clockShiftMinutes?: number | null
}
export interface RecordExtrema {
  longest: DistanceRecordWitness | null; shortest: DistanceRecordWitness | null
  longestDuration: SourceRecordRef | null; shortestDuration: SourceRecordRef | null
  biggestClockJump: SourceRecordRef | null
}
export interface LatestFlightWitness {
  flightId: number; origin: string; destination: string; value: number | null; date: string
}
export interface DepartureWitness extends SourceRecordRef { date: string; depMinute: number }
export interface RecordFlights {
  latest: LatestFlightWitness | null
  earliestDeparture: DepartureWitness | null
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
  recordFlights?: RecordFlights
  clockShiftMinutes?: number | null
}

export interface OverviewPayload {
  schemaVersion: 3
  etag: string
  generatedAt: string
  mode: 'flights' | 'aggregate'
  derivedReady: boolean
  passport: { countries: number; regions: number; countryCodes: string[] }
  homeOverride: string | null
  rows: OverviewRow[]
  refs: {
    airports: Record<string, { lat: number | null; lon: number | null; country: string | null; city: string | null; name: string }>
    aircraft: Record<string, { manufacturer: string | null; type: string | null; family: string | null; name: string | null }>
    regions: Record<string, string>
  }
}
