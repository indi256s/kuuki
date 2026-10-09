// Shared client contract for the Journal store, filter engine, search, URL codec and views.
import type { FlightFirsts, JournalFlight, JournalPayload, JournalRefs } from '../../../../../functions/api/_services/journalPayload'

export type { FlightFirsts, JournalFlight, JournalPayload, JournalRefs }

/** Status facet values (spec D1: no "Did not fly"). Empty means the default contents: logged and awaiting. */
export type JournalStatus = 'logged' | 'awaiting' | 'upcoming'
export type JournalMissing = 'aircraft' | 'airline' | 'times' | 'flight_number'
export type JournalAlliance = 'star' | 'oneworld' | 'skyteam'
export type JournalSortKey = 'date' | 'duration' | 'distance'

/** The whole filter state. Values inside one facet are ORed; facets are ANDed. Every list is sorted and de-duplicated. */
export type JournalFilters = {
  /** Raw search text as typed; parsed by `search.ts`. */
  q: string
  /** Whole years (from the period presets), ORed. Ignored when `from`/`to` is set. */
  years: number[]
  /** Inclusive calendar days, YYYY-MM-DD; both set or both empty. */
  from: string
  to: string
  /** IATA codes matched at either end. */
  airports: string[]
  /** ISO country codes matched at either end. */
  countries: string[]
  airlines: string[]
  /** `aircraft_icao` codes. */
  aircraft: string[]
  /** Aircraft family names from `refs.aircraft[icao].family`. */
  families: string[]
  status: JournalStatus[]
  missing: JournalMissing[]
  alliances: JournalAlliance[]
}

export type JournalSort = { key: JournalSortKey; order: 'asc' | 'desc' }

/** Everything the URL mirrors. `review` is review mode in the sheet; `flight` the open sheet. */
export type JournalViewState = { filters: JournalFilters; sort: JournalSort; flight: number | null; review: boolean }

export const emptyFilters = (): JournalFilters => ({ q: '', years: [], from: '', to: '', airports: [], countries: [], airlines: [], aircraft: [], families: [], status: [], missing: [], alliances: [] })
export const defaultSort: JournalSort = { key: 'date', order: 'desc' }
