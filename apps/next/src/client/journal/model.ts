import type {
  FlightFirsts,
  JournalFlight,
  JournalPayload,
  JournalRefs,
} from '../../../../../functions/api/_services/journalPayload'

export type { FlightFirsts, JournalFlight, JournalPayload, JournalRefs }

export type JournalStatus = 'logged' | 'awaiting' | 'upcoming'
export type JournalMissing = 'aircraft' | 'airline' | 'times' | 'flight_number'
export type JournalAlliance = 'star' | 'oneworld' | 'skyteam'
export type JournalSortKey = 'date' | 'duration' | 'distance'

export type JournalFilters = {
  q: string
  years: number[]
  from: string
  to: string
  airports: string[]
  countries: string[]
  airlines: string[]
  aircraft: string[]
  families: string[]
  status: JournalStatus[]
  missing: JournalMissing[]
  alliances: JournalAlliance[]
}

export type JournalSort = { key: JournalSortKey; order: 'asc' | 'desc' }

export type JournalViewState = {
  filters: JournalFilters
  sort: JournalSort
  flight: number | null
  review: boolean
}

export const emptyFilters = (): JournalFilters => ({
  q: '',
  years: [],
  from: '',
  to: '',
  airports: [],
  countries: [],
  airlines: [],
  aircraft: [],
  families: [],
  status: [],
  missing: [],
  alliances: [],
})
export const defaultSort: JournalSort = { key: 'date', order: 'desc' }

export function flightCode(
  flight: Pick<JournalFlight, 'airline_iata' | 'flight_number'>,
): string | null {
  const number = flight.flight_number?.trim()
  if (!number) return null
  return flight.airline_iata && /^\d/.test(number) ? `${flight.airline_iata} ${number}` : number
}
