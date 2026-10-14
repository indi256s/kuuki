// Passport collection model: pure functions over the published country evidence (ADR 0001 §4).
// Pending countries (awaiting flights only) appear as unpressed slots and never in the pressed count;
// transit-suppressed hubs have no published row, so they never appear at all.
import catalog from '@kuuki/data/countries.json'
import { COUNTRY_NEIGHBORS } from '@kuuki/data/country-neighbors'
import { catalogRegionOf } from '../../../../../functions/api/_lib/regions'
import type { CountryDetail, PassportData } from '../../server/passport'
import type { StampKind } from '../signature/stamp'
import {
  formatDateOnly,
  formatMonthYear,
  formatCount,
  formatNumber,
  formatRelativeDate,
  type Locale,
} from '../../lib/format'
import { PASSPORT_SORTS, type PassportFilters, type PassportSource } from '../../lib/url-state'

export type { PassportFilters, PassportSource }
export type PassportSort = (typeof PASSPORT_SORTS)[number]
export type RegionId = NonNullable<PassportData['countries'][number]['region']>
type CatalogCountry = {
  name: string
  nativeName: string
  dominantColor?: string
  continent: string
}
const COUNTRIES = catalog as Record<string, CatalogCountry>

/** Every catalog country and territory: the "of 246" denominator and the empty-state headline. */
export const CATALOG_TOTAL = Object.keys(COUNTRIES).length

export const REGION_LABELS: Record<RegionId, Record<Locale, string>> = {
  africa: { en: 'Africa', ru: 'Африка' },
  americas: { en: 'Americas', ru: 'Америка' },
  antarctica: { en: 'Antarctica', ru: 'Антарктида' },
  asia: { en: 'Asia', ru: 'Азия' },
  europe: { en: 'Europe', ru: 'Европа' },
  oceania: { en: 'Oceania', ru: 'Океания' },
}

/**
 * A known point in a country's chronology. Flights and archived evidence carry a date; a land or sea visit carries
 * only its year (ADR 0001 §4 leaves the projection's dates NULL for ground-only countries), so `date` is null then.
 */
export type VisitPoint = { year: number; date: string | null }

/**
 * First and last known visit from dated evidence and land/sea years together, at their real precision. When a dated
 * visit and a year-only visit fall in the same year, their order is unknown, so that end shows just the year.
 * Undated evidence (claims, visits without a year) adds nothing.
 */
export function chronology(
  dates: readonly (string | null | undefined)[],
  years: readonly (number | null | undefined)[],
): { first: VisitPoint | null; last: VisitPoint | null } {
  const points: VisitPoint[] = [
    ...dates
      .filter((date): date is string => !!date)
      .map((date) => ({ year: Number(date.slice(0, 4)), date: date.slice(0, 10) })),
    ...years
      .filter((year): year is number => typeof year === 'number' && year > 0)
      .map((year) => ({ year, date: null })),
  ]
  const end = (
    pick: (a: number, b: number) => boolean,
    better: (a: string, b: string) => boolean,
  ): VisitPoint | null => {
    let best: VisitPoint | null = null
    for (const point of points) {
      if (!best || pick(point.year, best.year)) best = point
      else if (point.year === best.year) {
        if (best.date === null || point.date === null) best = { year: point.year, date: null }
        else if (better(point.date, best.date)) best = point
      }
    }
    return best
  }
  return {
    first: end(
      (a, b) => a < b,
      (a, b) => a < b,
    ),
    last: end(
      (a, b) => a > b,
      (a, b) => a > b,
    ),
  }
}

/** Sort key for a point: a year-only point sorts at the start of its year. */
const pointKey = (point: VisitPoint | null) => (point ? (point.date ?? String(point.year)) : '')

/** «2026» for a year-only point, otherwise the date (or month and year) it carries. */
export function formatVisitPoint(
  locale: Locale,
  point: VisitPoint,
  style: 'date' | 'month',
): string {
  if (!point.date) return String(point.year)
  return style === 'month'
    ? formatMonthYear(locale, point.date, 'long')
    : formatDateOnly(locale, point.date)
}

export type PassportEntry = {
  code: string
  status: 'pressed' | 'pending'
  /** Air when flights support it; otherwise land/sea from ground visits; otherwise a claim. */
  kind: StampKind
  /** Logged + awaiting + manual ground visits + ground journeys; drives the rings. */
  visits: number
  first: VisitPoint | null
  last: VisitPoint | null
  firstYear: number | null
  claimed: boolean
  /** Manual land/sea visits only; ground journeys are counted apart in `journeys`. */
  ground: number
  /** Completed rail/road journeys that confirmed this country. */
  journeys: number
  region: RegionId | null
  /** Evidence kinds behind the country, in the fixed filter order; a mixed country carries several. */
  sources: PassportSource[]
}

export const catalogCountry = (code: string): CatalogCountry | undefined =>
  Object.hasOwn(COUNTRIES, code) ? COUNTRIES[code] : undefined
/** True for the 246 catalog countries and territories (upper-case ISO codes). */
export const isCatalogCountry = (code: string): boolean => Object.hasOwn(COUNTRIES, code)

export function countryNamer(locale: Locale): (code: string) => string {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return (code) => {
    try {
      return names.of(code) ?? catalogCountry(code)?.name ?? code
    } catch {
      return catalogCountry(code)?.name ?? code
    }
  }
}

export function passportEntries(
  data: Pick<PassportData, 'countries' | 'groundVisits'> &
    Partial<Pick<PassportData, 'journeyModes'>>,
): PassportEntry[] {
  const modes = new Map<string, Set<'rail' | 'road'>>()
  for (const { country_code, mode } of data.journeyModes ?? []) {
    modes.set(country_code, (modes.get(country_code) ?? new Set()).add(mode))
  }
  const ground = new Map<string, { years: number[]; sea: number; other: number }>()
  for (const visit of data.groundVisits) {
    const item = ground.get(visit.country_code) ?? { years: [], sea: 0, other: 0 }
    if (visit.visit_year) item.years.push(visit.visit_year)
    if (visit.entry_method === 'sea') item.sea++
    else item.other++
    ground.set(visit.country_code, item)
  }
  return data.countries.map((row) => {
    const visits = ground.get(row.country_code)
    const flights = row.logged_visit_count + row.awaiting_visit_count
    const kind: StampKind =
      flights > 0
        ? 'air'
        : row.ground_journey_count > 0
          ? 'land'
          : row.ground_visit_count > 0
            ? visits && visits.sea > 0 && visits.other === 0
              ? 'sea'
              : 'land'
            : row.claimed === 1
              ? 'claim'
              : 'air'
    const { first, last } = chronology([row.first_visit, row.last_visit], visits?.years ?? [])
    const journeyModes = modes.get(row.country_code)
    const sources: PassportSource[] = []
    if (flights > 0) sources.push('flights')
    if (journeyModes?.has('rail')) sources.push('trains')
    if (journeyModes?.has('road')) sources.push('road')
    if (row.claimed === 1 || row.ground_visit_count > 0) sources.push('manual')
    return {
      code: row.country_code,
      status: row.status,
      kind,
      visits: flights + row.ground_visit_count + row.ground_journey_count,
      first,
      last,
      firstYear: first?.year ?? null,
      claimed: row.claimed === 1,
      ground: row.ground_visit_count,
      journeys: row.ground_journey_count,
      region: row.region,
      sources,
    }
  })
}

/** Countries a visitor sees: published codes only, so no dates, counts or sources. */
export function visitorEntries(codes: string[]): PassportEntry[] {
  return codes.map((code) => ({
    code,
    status: 'pressed',
    kind: 'claim',
    visits: 0,
    first: null,
    last: null,
    firstYear: null,
    claimed: false,
    ground: 0,
    journeys: 0,
    region: catalogRegionOf(code),
    sources: [],
  }))
}

/** Recent: latest visit first, undated last. Records: most visits first. Ties fall back to the name. */
export function sortEntries(
  entries: PassportEntry[],
  sort: PassportSort,
  name: (code: string) => string,
  locale: Locale,
): PassportEntry[] {
  const byName = (a: PassportEntry, b: PassportEntry) =>
    name(a.code).localeCompare(name(b.code), locale)
  const compare: Record<PassportSort, (a: PassportEntry, b: PassportEntry) => number> = {
    recent: (a, b) =>
      Number(!a.last) - Number(!b.last) ||
      pointKey(b.last).localeCompare(pointKey(a.last)) ||
      byName(a, b),
    records: (a, b) => b.visits - a.visits || byName(a, b),
    name: byName,
  }
  return [...entries].sort(compare[sort])
}

/** Pending slots are shown in their own block, apart from the pressed collection. */
export function splitPending(entries: PassportEntry[]): {
  collection: PassportEntry[]
  pending: PassportEntry[]
} {
  return {
    collection: entries.filter((entry) => entry.status === 'pressed'),
    pending: entries.filter((entry) => entry.status === 'pending'),
  }
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()

/** Code, English, native and localized names, case- and accent-insensitive; the needle is already folded. */
const matchesNeedle = (code: string, needle: string, name: (code: string) => string) => {
  const item = catalogCountry(code)
  return [code, item?.name, item?.nativeName, name(code)].some(
    (value) => value && fold(value).includes(needle),
  )
}

/**
 * AND across search, region and sources; OR within sources, so a mixed country matches each of its sources.
 * Visitors have no source evidence, so their sources group is ignored. Entries pass through unchanged.
 */
export function filterEntries(
  entries: PassportEntry[],
  filters: PassportFilters,
  name: (code: string) => string,
  { visitor = false }: { visitor?: boolean } = {},
): PassportEntry[] {
  const needle = fold(filters.q.trim())
  const sources = visitor ? [] : filters.sources
  return entries.filter(
    (entry) =>
      (!needle || matchesNeedle(entry.code, needle, name)) &&
      (!filters.region || entry.region === filters.region) &&
      (!sources.length || sources.some((source) => entry.sources.includes(source))),
  )
}

/** Filters behind the Filter button; the always-visible search is not counted. */
export const activeFilterCount = (
  filters: PassportFilters,
  { visitor = false }: { visitor?: boolean } = {},
) => (filters.region ? 1 : 0) + (visitor ? 0 : filters.sources.length)

/**
 * The one catalog country to offer as "Add {country}" when the query finds nothing in the collection: the query
 * must match exactly one catalog country, and that country must not be in `entries` already.
 */
export function searchSuggestion(
  query: string,
  entries: PassportEntry[],
  name: (code: string) => string,
): string | null {
  const needle = fold(query.trim())
  if (!needle || entries.some((entry) => matchesNeedle(entry.code, needle, name))) return null
  const matches = Object.keys(COUNTRIES).filter((code) => matchesNeedle(code, needle, name))
  return matches.length === 1 ? matches[0] : null
}

const VISITED_FORMS = {
  en: { one: 'Visited {count} country', other: 'Visited {count} countries' },
  ru: {
    one: 'Посещена {count} страна',
    few: 'Посещено {count} страны',
    many: 'Посещено {count} стран',
    other: 'Посещено {count} страны',
  },
}
const HIDDEN_FORMS = {
  en: { one: '{count} hidden', other: '{count} hidden' },
  ru: {
    one: '{count} скрыта',
    few: '{count} скрыты',
    many: '{count} скрыто',
    other: '{count} скрыто',
  },
}

/** «Visited 12 countries · 3 hidden»; the hidden part appears only when something is hidden. */
export function totalsText(
  locale: Locale,
  { visited, hidden }: { visited: number; hidden: number },
): string {
  const text = formatCount(locale, visited, VISITED_FORMS)
  return hidden > 0 ? `${text} · ${formatCount(locale, hidden, HIDDEN_FORMS)}` : text
}

/** «Found 3 of 12» while a filter or search is active. */
export const foundText = (locale: Locale, found: number, of: number) =>
  locale === 'ru'
    ? `Найдено ${formatNumber(locale, found)} из ${formatNumber(locale, of)}`
    : `Found ${formatNumber(locale, found)} of ${formatNumber(locale, of)}`

export type RegionGroup = { region: RegionId | null; entries: PassportEntry[] }
/** Groups keep the sorted order: a group is placed where its first member sorts. */
export function groupByRegion(sorted: PassportEntry[]): RegionGroup[] {
  const groups = new Map<RegionId | null, PassportEntry[]>()
  for (const entry of sorted) {
    const list = groups.get(entry.region) ?? []
    list.push(entry)
    groups.set(entry.region, list)
  }
  return [...groups].map(([region, entries]) => ({ region, entries }))
}

export type HeaderFigures = {
  /** Pressed + pending (C3: the total includes pending with the explicit waiting caption). */
  total: number
  pressed: number
  pending: number
  newThisYear: number
  latest: PassportEntry | null
}
export function headerFigures(
  data: Pick<PassportData, 'pressedCountryCount' | 'pendingCountryCount'>,
  entries: PassportEntry[],
  now = new Date(),
): HeaderFigures {
  const year = String(now.getUTCFullYear())
  const pressed = entries.filter((entry) => entry.status === 'pressed')
  const dated = pressed.filter((entry) => entry.first)
  const latest = dated.reduce<PassportEntry | null>(
    (best, entry) => (!best || pointKey(entry.first) > pointKey(best.first) ? entry : best),
    null,
  )
  return {
    total: data.pressedCountryCount + data.pendingCountryCount,
    pressed: data.pressedCountryCount,
    pending: data.pendingCountryCount,
    newThisYear: dated.filter((entry) => String(entry.first!.year) === year).length,
    latest,
  }
}

/** «×12 · 2 мес. назад»: readable text under the stamp. Claim-only stamps carry their own label instead. */
export function stampCaption(
  locale: Locale,
  entry: PassportEntry,
  now = new Date(),
): string | undefined {
  if (entry.visits === 0) return undefined
  const count = `×${formatNumber(locale, entry.visits)}`
  if (!entry.last) return count
  return `${count} · ${entry.last.date ? formatRelativeDate(locale, entry.last.date, now) : entry.last.year}`
}

export type Suggestions = { recent: string[]; neighbors: string[] }
/**
 * Add-country suggestions from verified sources only: recently visited countries (published evidence) and
 * catalog neighbors of collected countries that are not collected yet, ranked by how many collected
 * countries they border. Search over the whole catalog always remains.
 */
export function suggestCountries(
  entries: PassportEntry[],
  limits = { recent: 4, neighbors: 6 },
): Suggestions {
  const collected = new Set(entries.map((entry) => entry.code))
  const recent = entries
    .filter((entry) => entry.status === 'pressed' && entry.last)
    .sort(
      (a, b) => pointKey(b.last).localeCompare(pointKey(a.last)) || a.code.localeCompare(b.code),
    )
    .slice(0, limits.recent)
    .map((entry) => entry.code)
  const score = new Map<string, number>()
  for (const entry of entries) {
    if (entry.status !== 'pressed') continue
    for (const neighbor of COUNTRY_NEIGHBORS[entry.code] ?? []) {
      if (!collected.has(neighbor) && catalogCountry(neighbor))
        score.set(neighbor, (score.get(neighbor) ?? 0) + 1)
    }
  }
  const neighbors = [...score]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limits.neighbors)
    .map(([code]) => code)
  return { recent, neighbors }
}

/** Catalog search over code, English, native and localized names (case- and accent-insensitive). */
export function searchCountries(query: string, name: (code: string) => string): string[] {
  const needle = fold(query.trim())
  const codes = Object.keys(COUNTRIES)
  if (!needle) return codes.sort((a, b) => name(a).localeCompare(name(b)))
  return codes
    .filter((code) => {
      const item = COUNTRIES[code]
      return [code, item.name, item.nativeName, name(code)].some((value) =>
        fold(value).includes(needle),
      )
    })
    .sort(
      (a, b) =>
        Number(!fold(name(a)).startsWith(needle)) - Number(!fold(name(b)).startsWith(needle)) ||
        name(a).localeCompare(name(b)),
    )
}

/** The awaiting queue, where every pending slot leads. */
export const AWAITING_QUEUE_HREF = '/journal?queue=awaiting'

/**
 * The awaiting flight whose arrival card a pending country leads to, read from the country's published evidence
 * (`GET /api/passport/countries/:cc/stats`). Only contributing endpoints are listed there; transit-suppressed ones,
 * including the matched outgoing origin of a connection, sit in `suppressed`, so the queue's own flags are never
 * reinterpreted here. An arrival is preferred over a departure, then the latest date.
 */
export function arrivalFlightId(detail: Pick<CountryDetail, 'entries'>): number | null {
  const awaiting = detail.entries.flatMap((entry) =>
    entry.kind === 'flight' && entry.state === 'awaiting' ? [entry] : [],
  )
  awaiting.sort(
    (a, b) =>
      Number(b.endpoint === 'destination') - Number(a.endpoint === 'destination') ||
      b.date.localeCompare(a.date) ||
      b.flightId - a.flightId,
  )
  return awaiting[0]?.flightId ?? null
}

export const arrivalHref = (flightId: number | null) =>
  flightId ? `${AWAITING_QUEUE_HREF}#arrival-${flightId}` : AWAITING_QUEUE_HREF

export type RemovalOutcome = {
  /** Only claims and land/sea visits are removed from the passport directly; flight stamps go through the Journal. */
  removable: boolean
  claimed: boolean
  groundVisits: number
  /** Live ground journeys that confirmed the country; the claim removal never touches them. */
  journeys: number
  /** The country after DELETE /api/passport/claims/:cc, which deletes the claim and every land/sea visit, never flights. */
  after: 'pressed' | 'pending' | 'gone'
}
/** Reads the country detail entries the way the evidence policy does (ADR 0001 §4, C3). */
export function removalOutcome(
  detail: Pick<CountryDetail, 'entries'> & Partial<Pick<CountryDetail, 'journeys'>>,
): RemovalOutcome {
  const claimed = detail.entries.some((entry) => entry.kind === 'claim')
  const groundVisits = detail.entries.filter((entry) => entry.kind === 'ground').length
  const journeys = detail.journeys?.length ?? 0
  const logged = detail.entries.some(
    (entry) => entry.kind === 'legacy' || (entry.kind === 'flight' && entry.state === 'logged'),
  )
  const awaiting = detail.entries.some(
    (entry) => entry.kind === 'flight' && entry.state === 'awaiting',
  )
  return {
    removable: claimed || groundVisits > 0,
    claimed,
    groundVisits,
    journeys,
    after: logged || journeys > 0 ? 'pressed' : awaiting ? 'pending' : 'gone',
  }
}
