import type { toOwnFlight } from '../_lib/flights'

export type JournalFlight = ReturnType<typeof toOwnFlight> & {
  origin_country: string | null
  destination_country: string | null
}

export type FlightFirsts = {
  countries: string[]
  aircraft: boolean
  airline: boolean
  pending: boolean
}

export type JournalRefs = {
  airports: Record<string, { city: string | null; name: string; country: string | null }>
  airlines: Record<string, { name: string }>
  aircraft: Record<
    string,
    { name: string | null; family: string | null; manufacturer: string | null; type: string | null }
  >
}

export type JournalPayload = {
  flights: JournalFlight[]
  firsts: Record<number, FlightFirsts>
  refs: JournalRefs
  updatedAt: number
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
}
