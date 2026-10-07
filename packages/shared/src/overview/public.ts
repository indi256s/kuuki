import type { Fleet } from './fleet'
import type { RecordRef } from './model'

type PublicRecord = Omit<RecordRef, 'flightId'> | null
export interface PublicRecords {
  longest: PublicRecord
  shortest: PublicRecord
  longestDuration: PublicRecord
  shortestDuration: PublicRecord
  biggestClockJump: PublicRecord
  northernmost: { iata: string; lat: number } | null
  southernmost: { iata: string; lat: number } | null
  longestStreakMonths: number
}
export interface PublicOverview {
  routes: Array<[string, string]>
  airports: Record<string, { lat: number; lon: number }>
  records?: PublicRecords
  fleet?: Pick<Fleet, 'topType' | 'byBodyType' | 'byManufacturer' | 'families' | 'types' | 'typed' | 'total'>
}
