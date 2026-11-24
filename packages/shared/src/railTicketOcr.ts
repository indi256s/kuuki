export interface RailPartialDate {
  month: number
  day: number
}
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
  departureTime: string | null
  arrivalTime: string | null
  trainNumber: string | null
  operator: string | null
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
