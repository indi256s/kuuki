import type { Fleet } from './fleet'
import type { RecordExtrema, RecordRef } from './model'
import type { Records } from './records'

export type PublicRecords = Omit<Records, keyof RecordExtrema | 'busiestDay' | 'longestGroundStopDays'> & {
  [K in keyof RecordExtrema]: Omit<RecordRef, 'flightId'> | null
}
export interface PublicOverview {
  routes: Array<[string, string]>
  airports: Record<string, { lat: number; lon: number }>
  records?: PublicRecords
  fleet?: Fleet
}
