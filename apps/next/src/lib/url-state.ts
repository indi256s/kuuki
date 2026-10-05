/**
 * Pure URL-state parsing for the route contract (C1). Each `normalize*` function validates the keys
 * its route owns, drops invalid values, omits defaults and keeps unrelated keys untouched. Output is a
 * fixed point: normalizing a normalized query returns the same query.
 */
export type RawQuery = Record<string, string | string[] | undefined> | URLSearchParams

export type Normalized<T> = {
  state: T
  /** Canonical query string without a leading `?`; empty when there is nothing to carry. */
  query: string
  /** True when the incoming query already equals the canonical one (order-insensitive). */
  canonical: boolean
}

type Entries = [string, string][]

function toEntries(raw: RawQuery): Entries {
  if (raw instanceof URLSearchParams) return [...raw.entries()]
  const entries: Entries = []
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') entries.push([key, value])
    else if (Array.isArray(value)) for (const item of value) entries.push([key, item])
  }
  return entries
}

const first = (entries: Entries, key: string) => entries.find(([name]) => name === key)?.[1]
const sameSet = (a: Entries, b: Entries) => {
  const flat = (list: Entries) => list.map(([k, v]) => `${k}\u0000${v}`).sort().join('\u0001')
  return a.length === b.length && flat(a) === flat(b)
}

function finish<T>(raw: Entries, owned: readonly string[], known: Entries, state: T): Normalized<T> {
  const extras = raw.filter(([key]) => !owned.includes(key))
  const out = [...known, ...extras]
  const params = new URLSearchParams()
  for (const [key, value] of out) params.append(key, value)
  return { state, query: params.toString(), canonical: sameSet(raw, out) }
}

export function isValidYear(value: string | undefined, now = new Date()): value is string {
  if (!value || !/^\d{4}$/.test(value)) return false
  const year = Number(value)
  return year >= 1900 && year <= now.getUTCFullYear() + 1
}

/** `year` is canonical; the legacy `period` key from earlier builds is accepted once and rewritten. */
function readYear(entries: Entries, now: Date): string | undefined {
  const year = first(entries, 'year')
  if (isValidYear(year, now)) return year
  const legacy = first(entries, 'period')
  return isValidYear(legacy, now) ? legacy : undefined
}

export type OverviewState = { year: string | null }
export function normalizeOverviewQuery(raw: RawQuery, now = new Date()): Normalized<OverviewState> {
  const entries = toEntries(raw)
  const year = readYear(entries, now)
  return finish(entries, ['year', 'period'], year ? [['year', year]] : [], { year: year ?? null })
}

export const PASSPORT_VIEWS = ['stamps', 'map'] as const
export const PASSPORT_SORTS = ['recent', 'visits', 'name'] as const
export const PASSPORT_LAYERS = ['countries', 'routes', 'frequency'] as const
export type PassportState = {
  view: (typeof PASSPORT_VIEWS)[number]
  sort: (typeof PASSPORT_SORTS)[number]
  layer: (typeof PASSPORT_LAYERS)[number]
  country: string | null
  /** Period applied to the route map; carried from the Overview year. */
  year: string | null
}
const pick = <T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T =>
  (allowed as readonly string[]).includes(value ?? '') ? value as T : fallback

export function normalizePassportQuery(raw: RawQuery, now = new Date()): Normalized<PassportState> {
  const entries = toEntries(raw)
  const rawCountry = first(entries, 'country')
  const country = rawCountry && /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null
  const state: PassportState = {
    view: pick(PASSPORT_VIEWS, first(entries, 'view'), 'stamps'),
    sort: pick(PASSPORT_SORTS, first(entries, 'sort'), 'recent'),
    layer: pick(PASSPORT_LAYERS, first(entries, 'layer'), 'countries'),
    country,
    year: readYear(entries, now) ?? null,
  }
  const known: Entries = []
  if (state.view !== 'stamps') known.push(['view', state.view])
  if (state.sort !== 'recent') known.push(['sort', state.sort])
  if (state.country) known.push(['country', state.country])
  if (state.layer !== 'countries') known.push(['layer', state.layer])
  if (state.year) known.push(['year', state.year])
  return finish(entries, ['view', 'sort', 'country', 'layer', 'year', 'period'], known, state)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type ImportState = { source: 'file' | 'text' | null; batch: string | null }
export function normalizeImportQuery(raw: RawQuery): Normalized<ImportState> {
  const entries = toEntries(raw)
  const source = first(entries, 'source')
  const batch = first(entries, 'batch')
  const state: ImportState = {
    source: source === 'file' || source === 'text' ? source : null,
    batch: batch && UUID.test(batch) ? batch.toLowerCase() : null,
  }
  const known: Entries = []
  if (state.source) known.push(['source', state.source])
  if (state.batch) known.push(['batch', state.batch])
  return finish(entries, ['source', 'batch'], known, state)
}

export const ONBOARDING_STEPS = ['name', 'capture', 'reveal'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
export type OnboardingProgress = { hasUsername: boolean; hasFlight: boolean }

/** The step a member may actually see: capture needs a username, reveal needs a saved first flight too. */
export function resolveOnboardingStep(requested: string | undefined, progress: OnboardingProgress): OnboardingStep {
  const wanted = (ONBOARDING_STEPS as readonly string[]).includes(requested ?? '')
    ? requested as OnboardingStep
    : progress.hasUsername ? (progress.hasFlight ? 'reveal' : 'capture') : 'name'
  if (!progress.hasUsername) return 'name'
  if (wanted === 'reveal' && !progress.hasFlight) return 'capture'
  return wanted
}

export function normalizeOnboardingQuery(raw: RawQuery, progress: OnboardingProgress): Normalized<{ step: OnboardingStep }> {
  const entries = toEntries(raw)
  const step = resolveOnboardingStep(first(entries, 'step'), progress)
  return finish(entries, ['step'], [['step', step]], { step })
}

export const withQuery = (path: string, query: string) => query ? `${path}?${query}` : path

export const JOURNAL_FILTER_KEYS = ['q', 'year', 'status', 'airline', 'aircraft', 'airport', 'origin', 'destination'] as const
export const JOURNAL_SORTS = ['date', 'origin', 'destination', 'airline_iata', 'aircraft_icao', 'distance_km', 'duration_minutes'] as const
export function normalizeJournalQuery(raw: RawQuery, now = new Date()): Normalized<Record<string, string>> {
  const entries = toEntries(raw)
  const params = new URLSearchParams(entries)
  for (const [old, key] of [['search', 'q'], ['airlineIata', 'airline'], ['aircraftIcao', 'aircraft'], ['sortField', 'sort'], ['sortOrder', 'order']]) {
    if (!params.has(key) && params.has(old)) params.set(key, params.get(old)!)
    params.delete(old)
  }
  if (!params.has('status')) {
    if (params.get('isUpcoming') === 'true') params.set('status', 'upcoming')
    if (params.get('isUpcoming') === 'false') params.set('status', 'completed')
  }
  const state: Record<string, string> = {}
  const q = params.get('q')?.trim().slice(0, 100)
  if (q) state.q = q
  const year = readYear([...params], now)
  if (year) state.year = year
  const status = params.get('status')
  if (status && ['upcoming', 'awaiting', 'logged', 'completed'].includes(status)) state.status = status
  for (const [key, pattern] of [['airline', /^[A-Z0-9]{2,3}$/], ['aircraft', /^[A-Z0-9]{2,4}$/], ['airport', /^[A-Z]{3}$/], ['origin', /^[A-Z]{3}$/], ['destination', /^[A-Z]{3}$/]] as const) {
    const value = params.get(key)?.toUpperCase()
    if (value && pattern.test(value)) state[key] = value
  }
  const sort = params.get('sort')
  if (sort && (JOURNAL_SORTS as readonly string[]).includes(sort) && sort !== 'date') state.sort = sort
  if (params.get('order') === 'asc') state.order = 'asc'
  const flight = params.get('flight')
  if (flight && /^[1-9]\d*$/.test(flight) && Number.isSafeInteger(Number(flight))) state.flight = flight
  if (params.get('queue') === 'awaiting') state.queue = 'awaiting'
  const batch = params.get('batch')
  if (batch && UUID.test(batch)) state.batch = batch.toLowerCase()
  const page = params.get('page')
  if (page && /^[1-9]\d{0,5}$/.test(page) && Number(page) > 1) state.page = page
  return finish(entries, [...JOURNAL_FILTER_KEYS, 'sort', 'order', 'flight', 'queue', 'batch', 'page', 'period', 'search', 'airlineIata', 'aircraftIcao', 'sortField', 'sortOrder', 'isUpcoming', 'originCodes', 'destinationCodes', 'airlineIataCodes'], Object.entries(state), state)
}

export function resetJournalFilters(query: string): string {
  const params = new URLSearchParams(query)
  for (const key of [...JOURNAL_FILTER_KEYS, 'page']) params.delete(key)
  return params.toString()
}

export type JournalLink = { airport?: string; airline?: string; aircraft?: string; origin?: string; destination?: string; year?: string | number; sort?: (typeof JOURNAL_SORTS)[number]; order?: 'asc'; status?: 'completed' }
/** Canonical `/journal` href for the Overview links: exact airport, airline, aircraft or route, optionally for one year and a sort. Invalid values are dropped. */
export function journalHref(link: JournalLink, now = new Date()): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(link)) if (value !== undefined && value !== '') params.set(key, String(value))
  return withQuery('/journal', normalizeJournalQuery(params, now).query)
}
