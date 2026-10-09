// The Journal's whole-list payload: every owner flight once, with the reference names and firsts the client needs to
// filter, search and render without another read. Served by the Journal page and GET /api/flights/journal.
import type { toOwnFlight } from '../_lib/flights'

export type JournalFlight = ReturnType<typeof toOwnFlight> & {
  /** ISO country of each endpoint from `airports_reference`; null when the airport is unknown. */
  origin_country: string | null
  destination_country: string | null
}

/** Firsts over the whole journal, independent of filters (spec D2). Present only for flights with at least one. */
export type FlightFirsts = {
  /** Countries this flight brought into the journal for the first time. */
  countries: string[]
  /** First flight on this aircraft type (`aircraft_icao`). */
  aircraft: boolean
  /** First flight with this airline (`airline_iata`). */
  airline: boolean
  /** The flight is awaiting confirmation, so its firsts are labelled "(pending confirmation)". */
  pending: boolean
}

export type JournalRefs = {
  airports: Record<string, { city: string | null; name: string; country: string | null }>
  airlines: Record<string, { name: string }>
  aircraft: Record<string, { name: string | null; family: string | null; manufacturer: string | null; type: string | null }>
}

export type JournalPayload = {
  /** Every flight in every lifecycle state, ordered date DESC, id DESC. */
  flights: JournalFlight[]
  /** Keyed by flight id. */
  firsts: Record<number, FlightFirsts>
  refs: JournalRefs
  updatedAt: number
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
}
