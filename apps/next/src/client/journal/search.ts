// Journal search: one text field parsed into AND-ed terms, then matched against the in-memory flight list.
// Parse once, match many: everything that depends on `refs` is built once per refs object (`indexFor`),
// so a keystroke only costs a few lookups and each flight a handful of set checks. The server keeps the
// same semantics for its fallback (`buildFlightWhere`): every word must be found, folded and literal.
import {
  airportAliases,
  airportSearchText,
  foldSearchText,
} from '../../../../../packages/shared/src/airportSearch'
import type { JournalFlight, JournalRefs } from './model'

// Both languages are always accepted, so `locale` does not change what matches.
export type SearchContext = { refs: JournalRefs; locale: 'en' | 'ru' }

/** Airports (by IATA code) and countries (by ISO code) a place word stands for. A flight matches at either endpoint. */
export type Place = { codes: ReadonlySet<string>; countries: ReadonlySet<string> }

/** One way a single word can be read. */
export type SearchAlt =
  | { kind: 'flight'; number: string }
  | { kind: 'period'; prefix: string }
  | { kind: 'month'; month: string }
  | { kind: 'place'; place: Place }
  | { kind: 'airline'; codes: ReadonlySet<string> }
  | { kind: 'aircraft'; codes: ReadonlySet<string> }
  | { kind: 'text'; needle: string }

/** A flight must satisfy every term; a term is satisfied by any of its alternatives. */
export type SearchTerm =
  | { kind: 'route'; text: string; from: Place; to: Place }
  | (SearchAlt & { text: string })
  | { kind: 'any'; text: string; alts: SearchAlt[] }

export type JournalSearch = { terms: SearchTerm[] }

type Index = {
  /** Folded code, city, name and aliases per airport; the substring haystack for places and the fallback. */
  airportText: Map<string, string>
  /** Whole folded words of `airportText` to the airports that carry them. */
  airportWords: Map<string, Set<string>>
  airlineCodes: Set<string>
  airlineNames: Array<[code: string, name: string]>
  aircraft: Array<[icao: string, name: string, family: string]>
  countryCodes: Set<string>
  /** Folded words of the English and Russian country names, with their ISO code. */
  countryWords: Array<[word: string, code: string]>
}

const MAX_QUERY_LENGTH = 100
const WORDS = /[^\p{L}\p{N}]+/u

// DisplayNames now says "Türkiye" and the like; people still type the older names and abbreviations.
const countryNicknames: Record<string, string[]> = {
  TR: ['Turkey'],
  US: ['USA', 'America', 'США'],
  GB: ['UK', 'England', 'Britain'],
  CZ: ['Czech Republic'],
  AE: ['UAE'],
}

const russianGenitiveMonths = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const indexes = new WeakMap<JournalRefs, Index>()

function regionNames(language: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([language], { type: 'region' })
  } catch {
    return null
  }
}

function buildIndex(refs: JournalRefs): Index {
  const airportText = new Map<string, string>()
  const airportWords = new Map<string, Set<string>>()
  const codes = new Set(
    [...Object.keys(refs.airports), ...Object.keys(airportAliases)].map((code) =>
      code.toUpperCase(),
    ),
  )
  for (const code of codes) {
    const known = refs.airports[code]
    const text = airportSearchText({ iata: code, name: known?.name ?? '', city: known?.city ?? '' })
    airportText.set(code, text)
    for (const word of text.split(WORDS)) {
      if (!word) continue
      const set = airportWords.get(word) ?? new Set<string>()
      set.add(code)
      airportWords.set(word, set)
    }
  }

  const countryCodes = new Set<string>()
  for (const airport of Object.values(refs.airports))
    if (airport.country) countryCodes.add(airport.country.toUpperCase())
  const countryWords: Array<[string, string]> = []
  const names = [regionNames('en'), regionNames('ru')]
  for (const code of countryCodes) {
    const labels = [...(countryNicknames[code] ?? [])]
    for (const display of names) {
      try {
        const label = display?.of(code)
        if (label && label !== code) labels.push(label)
      } catch {
        /* malformed region code: only the ISO code itself can match */
      }
    }
    for (const label of labels)
      for (const word of foldSearchText(label).split(WORDS))
        if (word) countryWords.push([word, code])
  }

  return {
    airportText,
    airportWords,
    airlineCodes: new Set(Object.keys(refs.airlines).map((code) => code.toUpperCase())),
    airlineNames: Object.entries(refs.airlines).map(([code, airline]) => [
      code,
      foldSearchText(airline.name),
    ]),
    aircraft: Object.entries(refs.aircraft).map(([icao, plane]) => [
      icao,
      foldSearchText(plane.name ?? ''),
      foldSearchText(plane.family ?? ''),
    ]),
    countryCodes,
    countryWords,
  }
}

function indexFor(refs: JournalRefs): Index {
  let index = indexes.get(refs)
  if (!index) {
    index = buildIndex(refs)
    indexes.set(refs, index)
  }
  return index
}

let monthTable: Map<string, string> | undefined

/** Folded month words in English and Russian, every prefix of 3+ letters included ("mar", "сент"), to "01".."12". */
function months(): Map<string, string> {
  if (monthTable) return monthTable
  const forms: string[][] = Array.from({ length: 12 }, (_, month) => [russianGenitiveMonths[month]])
  const date = (month: number) => new Date(Date.UTC(2024, month, 15))
  for (const language of ['en', 'ru']) {
    for (const style of ['long', 'short'] as const) {
      const standalone = new Intl.DateTimeFormat(language, { month: style, timeZone: 'UTC' })
      const inDate = new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: style,
        timeZone: 'UTC',
      })
      for (let month = 0; month < 12; month++) {
        forms[month].push(standalone.format(date(month)))
        const part = inDate.formatToParts(date(month)).find((p) => p.type === 'month')
        if (part) forms[month].push(part.value)
      }
    }
  }
  const table = new Map<string, string>()
  const clashes = new Set<string>()
  forms.forEach((labels, month) => {
    const value = String(month + 1).padStart(2, '0')
    for (const label of labels) {
      const folded = foldSearchText(label).replace(/\.+$/, '')
      for (let length = 3; length <= folded.length; length++) {
        const prefix = folded.slice(0, length)
        if (table.get(prefix) !== undefined && table.get(prefix) !== value) clashes.add(prefix)
        table.set(prefix, value)
      }
    }
  })
  for (const prefix of clashes) table.delete(prefix)
  monthTable = table
  return table
}

const monthOf = (word: string) => months().get(foldSearchText(word).replace(/\.+$/, ''))
const isYear = (word: string) => /^(?:19\d\d|20\d\d|2100)$/.test(word)
const normalizeFlightNumber = (value: string) => value.replace(/\s+/g, '').toUpperCase()
const HYPHENATED_WORDS = /^(\p{L}+)-(\p{L}+)$/u
const FLIGHT_NUMBER = /^(?:[A-Za-z][A-Za-z0-9]|\d[A-Za-z]|[A-Za-z]{3})\d{1,4}$/

/** Numeric date forms: "2024-03", "2024/03/15", "03/2024". Returns a YYYY-MM[-DD] prefix of the flight date. */
function numericDatePrefix(word: string): string | null {
  const iso = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/.exec(word)
  if (
    iso &&
    isYear(iso[1]) &&
    +iso[2] >= 1 &&
    +iso[2] <= 12 &&
    (iso[3] === undefined || (+iso[3] >= 1 && +iso[3] <= 31))
  ) {
    return [iso[1], iso[2].padStart(2, '0'), iso[3]?.padStart(2, '0')].filter(Boolean).join('-')
  }
  const monthYear = /^(\d{1,2})[-/.](\d{4})$/.exec(word)
  if (monthYear && isYear(monthYear[2]) && +monthYear[1] >= 1 && +monthYear[1] <= 12)
    return `${monthYear[2]}-${monthYear[1].padStart(2, '0')}`
  return null
}

type Resolved = { place: Place; strong: boolean }

function resolvePlace(word: string, index: Index): Resolved {
  const folded = foldSearchText(word)
  const upper = word.toUpperCase()
  const codes = new Set<string>()
  const strongCodes = index.airportWords.get(folded)
  if (strongCodes) for (const code of strongCodes) codes.add(code)
  if (folded.length >= 2)
    for (const [code, text] of index.airportText) if (text.includes(folded)) codes.add(code)

  const countries = new Set<string>()
  if (/^[A-Z]{2}$/.test(upper) && index.countryCodes.has(upper) && !index.airlineCodes.has(upper))
    countries.add(upper)
  if (folded.length >= 3)
    for (const [name, code] of index.countryWords) if (name.startsWith(folded)) countries.add(code)

  return { place: { codes, countries }, strong: strongCodes !== undefined }
}

function codesWhere<T>(
  rows: readonly T[],
  test: (row: T) => boolean,
  code: (row: T) => string,
): Set<string> {
  const out = new Set<string>()
  for (const row of rows) if (test(row)) out.add(code(row))
  return out
}

function wordAlts(word: string, index: Index, place: Place): SearchAlt[] {
  const folded = foldSearchText(word)
  const upper = word.toUpperCase()
  const alts: SearchAlt[] = []

  const isFlightNumber = FLIGHT_NUMBER.test(word)
  if (isFlightNumber) alts.push({ kind: 'flight', number: upper })
  const month = monthOf(word)
  if (month) alts.push({ kind: 'month', month })
  if (place.codes.size || place.countries.size) alts.push({ kind: 'place', place })

  const airlines = new Set<string>()
  if (/^[A-Za-z0-9]{2,3}$/.test(word) && index.airlineCodes.has(upper)) airlines.add(upper)
  if (folded.length >= 3)
    for (const code of codesWhere(
      index.airlineNames,
      ([, name]) => name.includes(folded),
      ([code]) => code,
    ))
      airlines.add(code)
  if (airlines.size) alts.push({ kind: 'airline', codes: airlines })

  const aircraft = new Set<string>()
  for (const [icao] of index.aircraft) if (icao.toUpperCase() === upper) aircraft.add(icao)
  if (folded.length >= 3)
    for (const code of codesWhere(
      index.aircraft,
      ([, name, family]) => name.includes(folded) || family.includes(folded),
      ([icao]) => icao,
    ))
      aircraft.add(code)
  if (aircraft.size) alts.push({ kind: 'aircraft', codes: aircraft })

  // A number under a known airline code is a flight number only: "TK381" must read like "TK 381".
  if (
    !isFlightNumber ||
    !(index.airlineCodes.has(upper.slice(0, 2)) || index.airlineCodes.has(upper.slice(0, 3)))
  )
    alts.push({ kind: 'text', needle: folded })
  return alts
}

/** Parse the field text. An empty search has no terms and matches everything. */
export function parseJournalSearch(text: string, ctx: SearchContext): JournalSearch {
  const index = indexFor(ctx.refs)
  const tokens = text
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .replace(/→|->|—|–/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !/^-+$/.test(token))
  const resolved = new Map<string, Resolved>()
  const place = (word: string) => {
    let found = resolved.get(word)
    if (!found) {
      found = resolvePlace(word, index)
      resolved.set(word, found)
    }
    return found
  }

  // Two words that each name an airport (a code, or a whole word of a city or airport name), with no airport
  // in common, are origin and destination in either order. Overlap ("Istanbul IST", "New York") is not a pair.
  const route = (first: string, second: string, text: string): SearchTerm | null => {
    const a = place(first)
    const b = place(second)
    if (!a.strong || !b.strong) return null
    for (const code of a.place.codes) if (b.place.codes.has(code)) return null
    return {
      kind: 'route',
      text,
      from: { codes: a.place.codes, countries: new Set() },
      to: { codes: b.place.codes, countries: new Set() },
    }
  }

  const terms: SearchTerm[] = []
  for (let i = 0; i < tokens.length;) {
    const word = tokens[i]
    const next = tokens[i + 1]
    const hyphenated = HYPHENATED_WORDS.exec(word)
    const split = hyphenated && route(hyphenated[1], hyphenated[2], word)
    if (split) {
      terms.push(split)
      i += 1
      continue
    }
    if (next !== undefined) {
      const pair = route(word, next, `${word} ${next}`)
      if (pair) {
        terms.push(pair)
        i += 2
        continue
      }
      if (
        /^\d{1,4}[A-Za-z]?$/.test(next) &&
        /^[A-Za-z0-9]{2,3}$/.test(word) &&
        index.airlineCodes.has(word.toUpperCase())
      ) {
        terms.push({
          kind: 'flight',
          text: `${word} ${next}`,
          number: normalizeFlightNumber(word + next),
        })
        i += 2
        continue
      }
      const month = isYear(next) ? monthOf(word) : isYear(word) ? monthOf(next) : undefined
      if (month) {
        terms.push({
          kind: 'period',
          text: `${word} ${next}`,
          prefix: `${isYear(next) ? next : word}-${month}`,
        })
        i += 2
        continue
      }
    }
    i += 1
    const hyphenFlight = /^([A-Za-z0-9]{2,3})-(\d{1,4})$/.exec(word)
    const prefix = isYear(word) ? word : numericDatePrefix(word)
    if (prefix) terms.push({ kind: 'period', text: word, prefix })
    else
      terms.push({
        kind: 'any',
        text: word,
        alts: wordAlts(
          hyphenFlight ? hyphenFlight[1] + hyphenFlight[2] : word,
          index,
          place(word).place,
        ),
      })
  }
  return { terms }
}

function matchesPlace(flight: JournalFlight, place: Place): boolean {
  return (
    place.codes.has(flight.origin) ||
    place.codes.has(flight.destination) ||
    (flight.origin_country !== null && place.countries.has(flight.origin_country)) ||
    (flight.destination_country !== null && place.countries.has(flight.destination_country))
  )
}

type Memo = { haystack?: string }

function matchesAlt(flight: JournalFlight, alt: SearchAlt, index: Index, memo: Memo): boolean {
  switch (alt.kind) {
    case 'flight': {
      if (!flight.flight_number) return false
      const number = normalizeFlightNumber(flight.flight_number)
      // Prefix match, so the list narrows while the number is typed: "TK38" keeps TK381 and TK3810 until "TK381" is complete.
      return (
        number.startsWith(alt.number) ||
        (flight.airline_iata !== null &&
          (flight.airline_iata.toUpperCase() + number).startsWith(alt.number))
      )
    }
    case 'period':
      return flight.date.startsWith(alt.prefix)
    case 'month':
      return flight.date.slice(5, 7) === alt.month
    case 'place':
      return matchesPlace(flight, alt.place)
    case 'airline':
      return flight.airline_iata !== null && alt.codes.has(flight.airline_iata)
    case 'aircraft':
      return flight.aircraft_icao !== null && alt.codes.has(flight.aircraft_icao)
    case 'text': {
      // The server's haystack: the row's own fields, then each airport's city, name and aliases.
      memo.haystack ??= `${foldSearchText(`${flight.origin} ${flight.destination} ${flight.flight_number ?? ''} ${flight.airline_iata ?? ''} ${flight.date}`)} ${index.airportText.get(flight.origin) ?? ''} ${index.airportText.get(flight.destination) ?? ''}`
      return memo.haystack.includes(alt.needle)
    }
  }
}

/** True when the flight satisfies every term. Call with the same `refs` the search was parsed with. */
export function matchesJournalSearch(
  flight: JournalFlight,
  search: JournalSearch,
  ctx: SearchContext,
): boolean {
  if (!search.terms.length) return true
  const index = indexFor(ctx.refs)
  const memo: Memo = {}
  return search.terms.every((term) => {
    if (term.kind === 'route')
      return (
        (term.from.codes.has(flight.origin) && term.to.codes.has(flight.destination)) ||
        (term.from.codes.has(flight.destination) && term.to.codes.has(flight.origin))
      )
    if (term.kind === 'any') return term.alts.some((alt) => matchesAlt(flight, alt, index, memo))
    return matchesAlt(flight, term, index, memo)
  })
}
