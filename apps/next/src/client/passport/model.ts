// Passport collection model: pure functions over the published country evidence (ADR 0001 §4).
// Pending countries (awaiting flights only) appear as unpressed slots and never in the pressed count;
// transit-suppressed hubs have no published row, so they never appear at all.
import catalog from '@kuuki/data/countries.json'
import { COUNTRY_NEIGHBORS } from '@kuuki/data/country-neighbors'
import { findAirport } from '@kuuki/data/airport-lookup'
import type { CountryDetail, PassportData } from '../../server/passport'
import type { StampKind } from '../signature/stamp'
import { formatNumber, formatRelativeDate, type Locale } from '../../lib/format'
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

export type PassportEntry = {
  code: string
  status: 'pressed' | 'pending'
  /** Air when flights support it; otherwise land/sea from ground visits; otherwise a claim. */
  kind: StampKind
  /** Logged + awaiting + ground visits; drives the rings. */
  visits: number
  firstVisit: string | null
  lastVisit: string | null
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
    const firstYear = row.first_visit ? Number(row.first_visit.slice(0, 4)) : visits?.years.length ? Math.min(...visits.years) : null
    return {
      code: row.country_code,
      status: row.status,
      kind,
      visits: flights + row.ground_visit_count,
      firstVisit: row.first_visit,
      lastVisit: row.last_visit,
      firstYear,
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
    recent: (a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byName(a, b),
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
  const dated = pressed.filter(entry => entry.firstVisit)
  const latest = dated.reduce<PassportEntry | null>((best, entry) => !best || entry.firstVisit! > best.firstVisit! ? entry : best, null)
  return {
    total: data.pressedCountryCount + data.pendingCountryCount,
    pressed: data.pressedCountryCount,
    pending: data.pendingCountryCount,
    newThisYear: dated.filter(entry => entry.firstVisit!.startsWith(year)).length,
    latest,
  }
}

/** «×12 · 2 мес. назад»: readable text under the stamp. Claim-only stamps carry their own label instead. */
export function stampCaption(locale: Locale, entry: PassportEntry, now = new Date()): string | undefined {
  if (entry.visits === 0) return undefined
  const count = `×${formatNumber(locale, entry.visits)}`
  return entry.lastVisit ? `${count} · ${formatRelativeDate(locale, entry.lastVisit, now)}` : count
}

export type Suggestions = { recent: string[]; neighbors: string[] }
/**
 * Add-country suggestions from verified sources only: recently visited countries (published evidence) and
 * catalog neighbors of collected countries that are not collected yet, ranked by how many collected
 * countries they border. Search over the whole catalog always remains.
 */
export function suggestCountries(entries: PassportEntry[], limits = { recent: 4, neighbors: 6 }): Suggestions {
  const collected = new Set(entries.map(entry => entry.code))
  const recent = entries.filter(entry => entry.status === 'pressed' && entry.lastVisit)
    .sort((a, b) => b.lastVisit!.localeCompare(a.lastVisit!) || a.code.localeCompare(b.code))
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

type AwaitingEntry = { flight: { id: number; origin: string; destination: string }; effectiveDefault: { transit: boolean } }
/**
 * Where a pending slot leads: the arrival card of an awaiting flight with an endpoint in that country
 * (a destination only when it is not a default transit), else the queue itself.
 */
export function arrivalHref(code: string, awaiting: readonly AwaitingEntry[] | undefined): string {
  const countryOf = (iata: string) => findAirport(iata)?.countryCode
  const match = awaiting?.find(entry => (countryOf(entry.flight.destination) === code && !entry.effectiveDefault.transit) || countryOf(entry.flight.origin) === code)
  return match ? `/journal?queue=awaiting#arrival-${match.flight.id}` : '/journal?queue=awaiting'
}

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
