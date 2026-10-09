// Pure codec between the Journal URL and `JournalViewState` (spec D4: the URL mirrors the in-memory store).
// Parsing accepts every legacy alias `normalizeJournalQuery` knows; `journalSearch` writes the one canonical form.
import { isValidYear, normalizeJournalQuery } from '../../lib/url-state'
import {
  defaultSort,
  emptyFilters,
  type JournalAlliance,
  type JournalFilters,
  type JournalMissing,
  type JournalSortKey,
  type JournalStatus,
  type JournalViewState,
} from './model'

const STATUSES: readonly JournalStatus[] = ['logged', 'awaiting', 'upcoming']
const MISSING: readonly JournalMissing[] = ['aircraft', 'airline', 'times', 'flight_number']
const ALLIANCES: readonly JournalAlliance[] = ['star', 'oneworld', 'skyteam']
/** Legacy server sort keys that still mean something; every other key falls back to date. */
const SORT_KEYS: Record<string, JournalSortKey> = {
  date: 'date',
  duration: 'duration',
  distance: 'distance',
  duration_minutes: 'duration',
  distance_km: 'distance',
}
const FLIGHT_ID = /^[1-9]\d*$/
const ARRIVAL_HASH = /^#arrival-([1-9]\d*)$/

const sortedUnique = (values: Iterable<string>) => [...new Set(values)].sort()
const csv = (params: URLSearchParams, key: string) =>
  params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
const codes = (values: Iterable<string | undefined>, pattern: RegExp) =>
  sortedUnique(
    [...values]
      .flatMap((value) => (value ? [value.toUpperCase()] : []))
      .filter((value) => pattern.test(value)),
  )
const oneOf = <T extends string>(values: string[], allowed: readonly T[]) =>
  sortedUnique(
    values.filter((value): value is T => (allowed as readonly string[]).includes(value)),
  ) as T[]
const flightId = (value: string | null | undefined) =>
  value && FLIGHT_ID.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null

/** Reads any Journal query (legacy or current) and an optional location hash. Unknown keys and invalid values are dropped. */
export function parseJournalUrl(search: string, hash = '', now = new Date()): JournalViewState {
  const raw = new URLSearchParams(search)
  // Single-valued legacy keys and aliases (`search`, `airlineIata`, `isUpcoming`, `period`, `sortField`...) resolve here.
  const legacy = normalizeJournalQuery(raw, now).state
  const filters: JournalFilters = emptyFilters()
  filters.q = legacy.q ?? ''
  filters.years = [
    ...new Set(
      [...csv(raw, 'years'), legacy.year].filter((year) => isValidYear(year, now)).map(Number),
    ),
  ].sort((a, b) => a - b)
  if (legacy.from && legacy.to) {
    filters.from = legacy.from
    filters.to = legacy.to
  }
  filters.airports = codes(
    [...csv(raw, 'airport'), legacy.airport, legacy.origin, legacy.destination],
    /^[A-Z]{3}$/,
  )
  filters.countries = codes(csv(raw, 'country'), /^[A-Z]{2}$/)
  filters.airlines = codes([...csv(raw, 'airline'), legacy.airline], /^[A-Z0-9]{2,3}$/)
  filters.aircraft = codes([...csv(raw, 'aircraft'), legacy.aircraft], /^[A-Z0-9]{2,4}$/)
  // Family names are free text from the aircraft catalogue (none contains a comma).
  filters.families = sortedUnique(csv(raw, 'family').filter((name) => name.length <= 60))
  // Legacy `completed` (and `isUpcoming=false`) meant flown flights, which is now the default contents.
  filters.status = oneOf([...csv(raw, 'status'), legacy.status ?? ''], STATUSES)
  filters.missing = oneOf(csv(raw, 'missing'), MISSING)
  filters.alliances = oneOf(csv(raw, 'alliance'), ALLIANCES)

  const sortKey = SORT_KEYS[raw.get('sort') ?? raw.get('sortField') ?? ''] ?? defaultSort.key
  const order = raw.get('order') === 'asc' || legacy.order === 'asc' ? 'asc' : 'desc'
  const arrival = ARRIVAL_HASH.exec(hash)
  const flight = flightId(raw.get('flight')) ?? flightId(arrival?.[1])
  const review = raw.get('review') === '1' || legacy.queue === 'awaiting' || !!arrival
  return { filters, sort: { key: sortKey, order }, flight, review }
}

/** Canonical query string without `?`: defaults omitted (the default state is empty), fixed key order, lists sorted and de-duplicated. */
export function journalSearch(state: JournalViewState): string {
  const { filters, sort } = state
  const params = new URLSearchParams()
  const list = (key: string, values: readonly (string | number)[]) => {
    if (!values.length) return
    const strings = [...new Set(values.map(String))]
    params.set(
      key,
      (typeof values[0] === 'number'
        ? strings.sort((a, b) => Number(a) - Number(b))
        : strings.sort()
      ).join(','),
    )
  }
  const q = filters.q.trim().slice(0, 100)
  if (q) params.set('q', q)
  list('years', filters.years)
  if (filters.from && filters.to) {
    params.set('from', filters.from)
    params.set('to', filters.to)
  }
  list('airport', filters.airports)
  list('country', filters.countries)
  list('airline', filters.airlines)
  list('aircraft', filters.aircraft)
  list('family', filters.families)
  list('status', filters.status)
  list('missing', filters.missing)
  list('alliance', filters.alliances)
  if (sort.key !== defaultSort.key) params.set('sort', sort.key)
  if (sort.order !== defaultSort.order) params.set('order', sort.order)
  if (state.flight !== null) params.set('flight', String(state.flight))
  if (state.review) params.set('review', '1')
  // List separators stay readable (`airport=IST,TBS`); a comma inside `q` decodes back to itself.
  return params.toString().replace(/%2C/gi, ',')
}
