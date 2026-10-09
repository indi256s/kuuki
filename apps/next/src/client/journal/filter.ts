// Pure Journal selection over the in-memory payload: facets, sort, connection connectors and the live summary.
// Connections and picker values depend on the payload alone, so they are computed once per payload object.
import { allianceAt, type Alliance } from '@kuuki/data/alliance-membership'
import {
  connectionChains,
  type ConnectionLabel,
} from '../../../../../functions/api/_services/connections'
import type {
  FlightFirsts,
  JournalAlliance,
  JournalFilters,
  JournalFlight,
  JournalMissing,
  JournalPayload,
  JournalSort,
  JournalStatus,
} from './model'

export type LedgerItem =
  | {
      kind: 'flight'
      flight: JournalFlight
      firsts: FlightFirsts | null
      chain: { id: string; index: number; length: number } | null
    }
  | { kind: 'connector'; key: string; airport: string; minutes: number | null; estimated: boolean }

export type JournalSummary = {
  flights: number
  /** Distance and time are confirmed-only: summed over `logged` flights. */
  distanceKm: number
  durationMinutes: number
  confirmedFlights: number
  /** Logged flights that lack the value, so the summary can say it is partial. */
  distanceMissing: number
  durationMissing: number
}

export type JournalFacetValues = {
  airlines: string[]
  aircraft: string[]
  families: string[]
  airports: string[]
  countries: string[]
  years: number[]
}

export type JournalSelection = {
  items: LedgerItem[]
  matching: JournalFlight[]
  summary: JournalSummary
  /** Flights per status under every other active facet (and search), ignoring the status facet itself. */
  statusCounts: Record<JournalStatus, number>
  /** Values present anywhere in the payload, independent of filters. */
  facetValues: JournalFacetValues
}

type ChainMeta = { id: string; index: number; length: number }
type PayloadIndex = {
  links: Map<number, { toId: number; label: ConnectionLabel }>
  chains: Map<number, ChainMeta>
  facetValues: JournalFacetValues
}

const DEFAULT_STATUS: ReadonlySet<JournalStatus> = new Set(['logged', 'awaiting'])
const DATE_LABEL = /^\d{4}-\d{2}-\d{2}$/
const indexes = new WeakMap<JournalPayload, PayloadIndex>()

// Compile-time guard: the data package's alliance keys are the Journal facet values.
const toJournalAlliance = (alliance: Alliance | null): JournalAlliance | null => alliance

const byText = (a: string, b: string) => a.localeCompare(b, 'en')
const present = (values: Set<string | null>) =>
  [...values].filter((value): value is string => !!value).sort(byText)

function indexPayload(payload: JournalPayload): PayloadIndex {
  const cached = indexes.get(payload)
  if (cached) return cached
  const links: PayloadIndex['links'] = new Map()
  const chains = new Map<number, ChainMeta>()
  for (const [id, decision] of connectionChains(payload.flights)) {
    if (decision.kind !== 'link') continue
    links.set(id, { toId: decision.toId, label: decision.label })
    if (chains.has(id)) continue // every leg of a chain shares its ids; walk each chain once
    const legs = decision.chainIds
    const meta = { id: `${legs[0]}-${legs.at(-1)}`, length: legs.length }
    legs.forEach((legId, index) => chains.set(legId, { ...meta, index }))
  }
  const airlines = new Set<string | null>(),
    aircraft = new Set<string | null>(),
    families = new Set<string | null>()
  const airports = new Set<string | null>(),
    countries = new Set<string | null>(),
    years = new Set<number>()
  for (const flight of payload.flights) {
    airlines.add(flight.airline_iata)
    aircraft.add(flight.aircraft_icao)
    if (flight.aircraft_icao)
      families.add(payload.refs.aircraft[flight.aircraft_icao]?.family ?? null)
    airports.add(flight.origin).add(flight.destination)
    countries.add(flight.origin_country).add(flight.destination_country)
    if (DATE_LABEL.test(flight.date)) years.add(Number(flight.date.slice(0, 4)))
  }
  const index: PayloadIndex = {
    links,
    chains,
    facetValues: {
      airlines: present(airlines),
      aircraft: present(aircraft),
      families: present(families),
      airports: present(airports),
      countries: present(countries),
      years: [...years].sort((a, b) => a - b),
    },
  }
  indexes.set(payload, index)
  return index
}

const missingChecks: Record<JournalMissing, (flight: JournalFlight) => boolean> = {
  aircraft: (flight) => !flight.aircraft_icao,
  airline: (flight) => !flight.airline_iata,
  times: (flight) => !flight.departure_time,
  flight_number: (flight) => !flight.flight_number,
}

const setOf = <T>(values: readonly T[]): ReadonlySet<T> | null =>
  values.length ? new Set(values) : null

/** Every facet except status, plus the injected search. Cheap checks run first; search runs last. */
function otherFacets(
  payload: JournalPayload,
  filters: JournalFilters,
  matchSearch?: (flight: JournalFlight) => boolean,
) {
  const range = filters.from && filters.to ? { from: filters.from, to: filters.to } : null
  const years = range ? null : setOf(filters.years)
  const airports = setOf(filters.airports),
    countries = setOf(filters.countries)
  const airlines = setOf(filters.airlines)
  const aircraft = setOf(filters.aircraft),
    families = setOf(filters.families)
  const alliances = setOf(filters.alliances)
  const missing = filters.missing.map((key) => missingChecks[key])
  const refs = payload.refs.aircraft
  return (flight: JournalFlight) => {
    if (range && (flight.date < range.from || flight.date > range.to)) return false
    if (years && !years.has(Number(flight.date.slice(0, 4)))) return false
    if (
      (airports || countries) &&
      !airports?.has(flight.origin) &&
      !airports?.has(flight.destination) &&
      !(flight.origin_country && countries?.has(flight.origin_country)) &&
      !(flight.destination_country && countries?.has(flight.destination_country))
    )
      return false
    if (airlines && !(flight.airline_iata && airlines.has(flight.airline_iata))) return false
    if (aircraft || families) {
      const code = flight.aircraft_icao
      const family = code ? refs[code]?.family : null
      if (!(code && aircraft?.has(code)) && !(family && families?.has(family))) return false
    }
    if (missing.length && !missing.some((check) => check(flight))) return false
    if (alliances) {
      const alliance = toJournalAlliance(allianceAt(flight.airline_iata, flight.date))
      if (!alliance || !alliances.has(alliance)) return false
    }
    return !matchSearch || matchSearch(flight)
  }
}

const finite = (value: number | null) => (value !== null && Number.isFinite(value) ? value : null)
/** Nulls last in either direction. */
const nullsLast = <T extends number | string>(a: T | null, b: T | null, direction: number) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a < b ? -direction : a > b ? direction : 0

function comparator(sort: JournalSort) {
  const direction = sort.order === 'asc' ? 1 : -1
  const tie = (a: JournalFlight, b: JournalFlight) => (a.id - b.id) * direction
  if (sort.key === 'duration')
    return (a: JournalFlight, b: JournalFlight) =>
      nullsLast(finite(a.duration_minutes), finite(b.duration_minutes), direction) || tie(a, b)
  if (sort.key === 'distance')
    return (a: JournalFlight, b: JournalFlight) =>
      nullsLast(finite(a.distance_km), finite(b.distance_km), direction) || tie(a, b)
  return (a: JournalFlight, b: JournalFlight) =>
    nullsLast(a.date, b.date, direction) ||
    nullsLast(a.departure_utc, b.departure_utc, direction) ||
    tie(a, b)
}

const instant = (value: string | null) => {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(parsed) ? null : parsed
}

/** A connector when the two neighbours are consecutive legs of one chain, in either display order. */
function connectorBetween(
  x: JournalFlight,
  y: JournalFlight,
  links: PayloadIndex['links'],
): LedgerItem | null {
  const forward = links.get(x.id)?.toId === y.id
  if (!forward && links.get(y.id)?.toId !== x.id) return null
  const [inbound, outbound] = forward ? [x, y] : [y, x]
  const arrival = instant(inbound.arrival_utc),
    departure = instant(outbound.departure_utc)
  return {
    kind: 'connector',
    key: `connector-${inbound.id}-${outbound.id}`,
    airport: inbound.destination,
    minutes:
      arrival !== null && departure !== null ? Math.round((departure - arrival) / 60_000) : null,
    estimated: links.get(inbound.id)!.label === 'estimated',
  }
}

export function selectJournal(
  payload: JournalPayload,
  filters: JournalFilters,
  sort: JournalSort,
  matchSearch?: (flight: JournalFlight) => boolean,
): JournalSelection {
  const index = indexPayload(payload)
  const status = filters.status.length ? new Set(filters.status) : DEFAULT_STATUS
  const passes = otherFacets(payload, filters, matchSearch)
  const statusCounts: Record<JournalStatus, number> = { logged: 0, awaiting: 0, upcoming: 0 }
  const matching: JournalFlight[] = []
  for (const flight of payload.flights) {
    if (!passes(flight)) continue
    const state = flight.lifecycle_state
    if (state in statusCounts) statusCounts[state] += 1
    if (status.has(state)) matching.push(flight)
  }
  matching.sort(comparator(sort))

  const byDate = sort.key === 'date'
  const items: LedgerItem[] = []
  matching.forEach((flight, position) => {
    const connector =
      byDate && position > 0 ? connectorBetween(matching[position - 1], flight, index.links) : null
    if (connector) items.push(connector)
    items.push({
      kind: 'flight',
      flight,
      firsts: payload.firsts[flight.id] ?? null,
      chain: byDate ? (index.chains.get(flight.id) ?? null) : null,
    })
  })

  const summary: JournalSummary = {
    flights: matching.length,
    distanceKm: 0,
    durationMinutes: 0,
    confirmedFlights: 0,
    distanceMissing: 0,
    durationMissing: 0,
  }
  for (const flight of matching) {
    if (flight.lifecycle_state !== 'logged') continue
    summary.confirmedFlights += 1
    const distance = finite(flight.distance_km),
      duration = finite(flight.duration_minutes)
    if (distance === null) summary.distanceMissing += 1
    else summary.distanceKm += distance
    if (duration === null) summary.durationMissing += 1
    else summary.durationMinutes += duration
  }

  return { items, matching, summary, statusCounts, facetValues: index.facetValues }
}
