// Passport collection model: pure functions over the published country evidence (ADR 0001 §4).
// Pending countries (awaiting flights only) appear as unpressed slots and never in the pressed count;
// transit-suppressed hubs have no published row, so they never appear at all.
import catalog from '@kuuki/data/countries.json'
import { COUNTRY_NEIGHBORS } from '@kuuki/data/country-neighbors'
import type { CountryDetail, PassportData } from '../../server/passport'
import type { StampKind } from '../signature/stamp'
import { formatDateOnly, formatMonthYear, formatNumber, formatRelativeDate, type Locale } from '../../lib/format'
import { PASSPORT_SORTS } from '../../lib/url-state'

export type PassportSort = (typeof PASSPORT_SORTS)[number]
export type RegionId = NonNullable<PassportData['countries'][number]['region']>
type CatalogCountry = { name: string; nativeName: string; dominantColor?: string; continent: string }
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
export function chronology(dates: readonly (string | null | undefined)[], years: readonly (number | null | undefined)[]): { first: VisitPoint | null; last: VisitPoint | null } {
  const points: VisitPoint[] = [
    ...dates.filter((date): date is string => !!date).map(date => ({ year: Number(date.slice(0, 4)), date: date.slice(0, 10) })),
    ...years.filter((year): year is number => typeof year === 'number' && year > 0).map(year => ({ year, date: null })),
  ]
  const end = (pick: (a: number, b: number) => boolean, better: (a: string, b: string) => boolean): VisitPoint | null => {
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
  return { first: end((a, b) => a < b, (a, b) => a < b), last: end((a, b) => a > b, (a, b) => a > b) }
}

/** Sort key for a point: a year-only point sorts at the start of its year. */
const pointKey = (point: VisitPoint | null) => point ? point.date ?? String(point.year) : ''

/** «2026» for a year-only point, otherwise the date (or month and year) it carries. */
export function formatVisitPoint(locale: Locale, point: VisitPoint, style: 'date' | 'month'): string {
  if (!point.date) return String(point.year)
  return style === 'month' ? formatMonthYear(locale, point.date, 'long') : formatDateOnly(locale, point.date)
}

export type PassportEntry = {
  code: string
  status: 'pressed' | 'pending'
  /** Air when flights support it; otherwise land/sea from ground visits; otherwise a claim. */
  kind: StampKind
  /** Logged + awaiting + ground visits; drives the rings. */
  visits: number
  first: VisitPoint | null
  last: VisitPoint | null
  firstYear: number | null
  claimed: boolean
  ground: number
  region: RegionId | null
}

export const catalogCountry = (code: string): CatalogCountry | undefined => Object.hasOwn(COUNTRIES, code) ? COUNTRIES[code] : undefined
/** True for the 246 catalog countries and territories (upper-case ISO codes). */
export const isCatalogCountry = (code: string): boolean => Object.hasOwn(COUNTRIES, code)

export function countryNamer(locale: Locale): (code: string) => string {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return code => {
    try { return names.of(code) ?? catalogCountry(code)?.name ?? code } catch { return catalogCountry(code)?.name ?? code }
  }
}

export function passportEntries(data: Pick<PassportData, 'countries' | 'groundVisits'>): PassportEntry[] {
  const ground = new Map<string, { years: number[]; sea: number; other: number }>()
  for (const visit of data.groundVisits) {
    const item = ground.get(visit.country_code) ?? { years: [], sea: 0, other: 0 }
    if (visit.visit_year) item.years.push(visit.visit_year)
    if (visit.entry_method === 'sea') item.sea++
    else item.other++
    ground.set(visit.country_code, item)
  }
  return data.countries.map(row => {
    const visits = ground.get(row.country_code)
    const flights = row.logged_visit_count + row.awaiting_visit_count
    const kind: StampKind = flights > 0 ? 'air'
      : row.ground_visit_count > 0 ? (visits && visits.sea > 0 && visits.other === 0 ? 'sea' : 'land')
        : row.claimed === 1 ? 'claim' : 'air'
    const { first, last } = chronology([row.first_visit, row.last_visit], visits?.years ?? [])
    return {
      code: row.country_code,
      status: row.status,
      kind,
      visits: flights + row.ground_visit_count,
      first,
      last,
      firstYear: first?.year ?? null,
      claimed: row.claimed === 1,
      ground: row.ground_visit_count,
      region: row.region,
    }
  })
}

/** Recent puts pending slots first, then the latest visit; visits and name fall back to the name. */
export function sortEntries(entries: PassportEntry[], sort: PassportSort, name: (code: string) => string, locale: Locale): PassportEntry[] {
  const byName = (a: PassportEntry, b: PassportEntry) => name(a.code).localeCompare(name(b.code), locale)
  const compare: Record<PassportSort, (a: PassportEntry, b: PassportEntry) => number> = {
    recent: (a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || pointKey(b.last).localeCompare(pointKey(a.last)) || byName(a, b),
    visits: (a, b) => b.visits - a.visits || byName(a, b),
    name: byName,
  }
  return [...entries].sort(compare[sort])
}

export type RegionGroup = { region: RegionId | null; entries: PassportEntry[] }
/** Groups keep the sorted order: a group is placed where its first member sorts, so a pending slot leads the page. */
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
export function headerFigures(data: Pick<PassportData, 'pressedCountryCount' | 'pendingCountryCount'>, entries: PassportEntry[], now = new Date()): HeaderFigures {
  const year = String(now.getUTCFullYear())
  const pressed = entries.filter(entry => entry.status === 'pressed')
  const dated = pressed.filter(entry => entry.first)
  const latest = dated.reduce<PassportEntry | null>((best, entry) => !best || pointKey(entry.first) > pointKey(best.first) ? entry : best, null)
  return {
    total: data.pressedCountryCount + data.pendingCountryCount,
    pressed: data.pressedCountryCount,
    pending: data.pendingCountryCount,
    newThisYear: dated.filter(entry => String(entry.first!.year) === year).length,
    latest,
  }
}

/** «×12 · 2 мес. назад»: readable text under the stamp. Claim-only stamps carry their own label instead. */
export function stampCaption(locale: Locale, entry: PassportEntry, now = new Date()): string | undefined {
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
export function suggestCountries(entries: PassportEntry[], limits = { recent: 4, neighbors: 6 }): Suggestions {
  const collected = new Set(entries.map(entry => entry.code))
  const recent = entries.filter(entry => entry.status === 'pressed' && entry.last)
    .sort((a, b) => pointKey(b.last).localeCompare(pointKey(a.last)) || a.code.localeCompare(b.code))
    .slice(0, limits.recent).map(entry => entry.code)
  const score = new Map<string, number>()
  for (const entry of entries) {
    if (entry.status !== 'pressed') continue
    for (const neighbor of COUNTRY_NEIGHBORS[entry.code] ?? []) {
      if (!collected.has(neighbor) && catalogCountry(neighbor)) score.set(neighbor, (score.get(neighbor) ?? 0) + 1)
    }
  }
  const neighbors = [...score].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limits.neighbors).map(([code]) => code)
  return { recent, neighbors }
}

/** Catalog search over code, English, native and localized names (case- and accent-insensitive). */
export function searchCountries(query: string, name: (code: string) => string): string[] {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
  const needle = fold(query.trim())
  const codes = Object.keys(COUNTRIES)
  if (!needle) return codes.sort((a, b) => name(a).localeCompare(name(b)))
  return codes.filter(code => {
    const item = COUNTRIES[code]
    return [code, item.name, item.nativeName, name(code)].some(value => fold(value).includes(needle))
  }).sort((a, b) => Number(!fold(name(a)).startsWith(needle)) - Number(!fold(name(b)).startsWith(needle)) || name(a).localeCompare(name(b)))
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
  const awaiting = detail.entries.flatMap(entry => entry.kind === 'flight' && entry.state === 'awaiting' ? [entry] : [])
  awaiting.sort((a, b) => Number(b.endpoint === 'destination') - Number(a.endpoint === 'destination') || b.date.localeCompare(a.date) || b.flightId - a.flightId)
  return awaiting[0]?.flightId ?? null
}

export const arrivalHref = (flightId: number | null) => flightId ? `${AWAITING_QUEUE_HREF}#arrival-${flightId}` : AWAITING_QUEUE_HREF

export type RemovalOutcome = {
  /** Only claims and land/sea visits are removed from the passport directly; flight stamps go through the Journal. */
  removable: boolean
  claimed: boolean
  groundVisits: number
  /** The country after DELETE /api/passport/claims/:cc, which deletes the claim and every land/sea visit, never flights. */
  after: 'pressed' | 'pending' | 'gone'
}
/** Reads the country detail entries the way the evidence policy does (ADR 0001 §4, C3). */
export function removalOutcome(detail: Pick<CountryDetail, 'entries'>): RemovalOutcome {
  const claimed = detail.entries.some(entry => entry.kind === 'claim')
  const groundVisits = detail.entries.filter(entry => entry.kind === 'ground').length
  const logged = detail.entries.some(entry => entry.kind === 'legacy' || (entry.kind === 'flight' && entry.state === 'logged'))
  const awaiting = detail.entries.some(entry => entry.kind === 'flight' && entry.state === 'awaiting')
  return { removable: claimed || groundVisits > 0, claimed, groundVisits, after: logged ? 'pressed' : awaiting ? 'pending' : 'gone' }
}
