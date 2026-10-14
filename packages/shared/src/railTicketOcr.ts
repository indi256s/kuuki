/** Month and day printed without a year. The year is never inferred. */
export interface RailPartialDate {
  month: number
  day: number
}
/** `YYYY-MM-DD` only when the year is printed; a partial date or null otherwise. */
export type RailTicketDate = string | RailPartialDate | null

export const RAIL_CANDIDATE_FIELDS = [
  'fromStation',
  'toStation',
  'fromCity',
  'toCity',
  'departureDate',
  'arrivalDate',
  'departureTime',
  'arrivalTime',
  'trainNumber',
  'operator',
] as const
export type RailCandidateField = (typeof RAIL_CANDIDATE_FIELDS)[number]

export interface RailTicketCandidate {
  fromStation: string | null
  toStation: string | null
  fromCity: string | null
  toCity: string | null
  departureDate: RailTicketDate
  arrivalDate: RailTicketDate
  /** HH:MM local time as printed. */
  departureTime: string | null
  arrivalTime: string | null
  trainNumber: string | null
  operator: string | null
  /** Names of the fields above that the source states unclearly. */
  uncertain: RailCandidateField[]
  cancelled: boolean | null
  otherPassenger: boolean | null
}

export type RailOcrWarning = { code: 'ROWS_DROPPED'; count: number }

export interface RailOcrResult {
  candidates: RailTicketCandidate[]
  warnings: RailOcrWarning[]
}

export type RailFileMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
