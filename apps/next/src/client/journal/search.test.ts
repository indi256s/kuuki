import { describe, expect, it } from 'vitest'
import { matchesJournalSearch, parseJournalSearch, type SearchContext } from './search'
import type { JournalFlight, JournalRefs } from './model'

const refs: JournalRefs = {
  airports: {
    TBS: { city: 'Tbilisi', name: 'Tbilisi International Airport', country: 'GE' },
    IST: { city: 'Istanbul', name: 'Istanbul Airport', country: 'TR' },
    SAW: { city: 'Istanbul', name: 'Sabiha Gokcen International Airport', country: 'TR' },
    JFK: { city: 'New York', name: 'John F. Kennedy International Airport', country: 'US' },
    SVO: { city: 'Moscow', name: 'Sheremetyevo International Airport', country: 'RU' },
  },
  airlines: {
    TK: { name: 'Turkish Airlines' },
    DL: { name: 'Delta Air Lines' },
    TR: { name: 'Scoot' },
  },
  aircraft: {
    A359: { name: 'Airbus A350-900', family: 'A350', manufacturer: 'Airbus', type: null },
    B738: { name: 'Boeing 737-800', family: '737', manufacturer: 'Boeing', type: null },
    B789: { name: 'Boeing 787-9 Dreamliner', family: '787', manufacturer: 'Boeing', type: null },
  },
}

const countryOf = (code: string) => refs.airports[code]?.country ?? null

let nextId = 1
function flight(
  date: string,
  origin: string,
  destination: string,
  extra: Partial<JournalFlight> = {},
): JournalFlight {
  return {
    id: nextId++,
    date,
    origin,
    destination,
    airline_iata: null,
    aircraft_icao: null,
    flight_number: null,
    origin_country: countryOf(origin),
    destination_country: countryOf(destination),
    ...extra,
  } as JournalFlight
}

const ctx = (locale: 'en' | 'ru' = 'en'): SearchContext => ({ refs, locale })

function run(query: string, flights: JournalFlight[], locale: 'en' | 'ru' = 'en'): number[] {
  const search = parseJournalSearch(query, ctx(locale))
  return flights
    .filter((row) => matchesJournalSearch(row, search, ctx(locale)))
    .map((row) => row.id)
}

// The same four rows as the server tests in functions/test/flights.test.ts.
const server = {
  a: flight('2025-04-03', 'TBS', 'IST', { flight_number: 'Q%_99', airline_iata: 'TK' }),
  b: flight('2025-04-04', 'IST', 'TBS', { flight_number: 'Q100', airline_iata: 'TK' }),
  c: flight('2024-04-04', 'TBS', 'JFK', { flight_number: 'Q200', airline_iata: 'DL' }),
  d: flight('2025-04-05', 'JFK', 'IST', { flight_number: 'Q300', airline_iata: 'TK' }),
}
const serverRows = Object.values(server)
const ids = (...rows: JournalFlight[]) => rows.map((row) => row.id)

describe('server search cases', () => {
  it.each([
    ['Tbilisi', [server.a, server.b, server.c]],
    ['tbs', [server.a, server.b, server.c]],
    ['2025-04', [server.a, server.b, server.d]],
    ['TBS IST', [server.a, server.b]],
    ['TBS→IST', [server.a, server.b]],
    ['%_', [server.a]],
    ['%', [server.a]],
    ['unknown-airport-alias', []],
    ['not-a-route', []],
    ["' OR 1=1 --", []],
    ['Тбилиси', [server.a, server.b, server.c]],
    ['тбилиси', [server.a, server.b, server.c]],
    ['ТБИЛИСИ', [server.a, server.b, server.c]],
    ['тБиЛиСи', [server.a, server.b, server.c]],
    ['Стамбул', [server.a, server.b, server.d]],
    ['Стамбул тбилиси', [server.a, server.b]],
    ['İSTANBUL', [server.a, server.b, server.d]],
    ['თბილისი', [server.a, server.b, server.c]],
    ['Москва', []],
    ['Шереметьево', []],
    ['Тбилиси Москва', []],
    ['Неизвестный', []],
  ] as const)('%s', (query, expected) => {
    expect(run(query, serverRows)).toEqual(ids(...expected))
  })

  it('treats an empty search as no filter', () => {
    expect(parseJournalSearch('   ', ctx()).terms).toEqual([])
    expect(run('', serverRows)).toEqual(ids(...serverRows))
  })

  it('matches nothing for a nonsense word', () => {
    expect(run('qzxvw', serverRows)).toEqual([])
  })
})

const tbsIst = flight('2025-04-03', 'TBS', 'IST', {
  flight_number: 'TK381',
  airline_iata: 'TK',
  aircraft_icao: 'A359',
})
const istTbs = flight('2025-04-09', 'IST', 'TBS', {
  flight_number: 'TK 381',
  airline_iata: 'TK',
  aircraft_icao: 'A359',
})
const longer = flight('2025-05-01', 'SAW', 'JFK', {
  flight_number: 'TK3810',
  airline_iata: 'TK',
  aircraft_icao: 'B789',
})
const tbsJfk = flight('2024-03-09', 'TBS', 'JFK', {
  flight_number: 'DL100',
  airline_iata: 'DL',
  aircraft_icao: 'B738',
})
const may2023 = flight('2023-05-12', 'IST', 'JFK', { airline_iata: 'TK', aircraft_icao: 'B789' })
const old2019 = flight('2019-11-02', 'SVO', 'TBS')
const library = [tbsIst, istTbs, longer, tbsJfk, may2023, old2019]

describe('route pairs', () => {
  it.each([
    'TBS IST',
    'tbs ist',
    'TBS-IST',
    'TBS → IST',
    'TBS->IST',
    'TBS — IST',
    'TBS–IST',
    'IST TBS',
    'Tbilisi Istanbul',
    'tbilisi-istanbul',
    'Тбилиси Стамбул',
    'Стамбул Тбилиси',
  ])('%s matches both directions', (query) => {
    expect(run(query, library)).toEqual(ids(tbsIst, istTbs))
    expect(parseJournalSearch(query, ctx()).terms.map((term) => term.kind)).toEqual(['route'])
  })

  it('does not pair words whose airports overlap', () => {
    expect(parseJournalSearch('Istanbul IST', ctx()).terms.map((term) => term.kind)).toEqual([
      'any',
      'any',
    ])
    expect(run('Istanbul IST', library)).toEqual(ids(tbsIst, istTbs, longer, may2023))
  })

  it('keeps a pair next to other terms', () => {
    expect(run('TBS IST 2025', library)).toEqual(ids(tbsIst, istTbs))
    expect(run('TBS JFK delta', library)).toEqual(ids(tbsJfk))
  })
})

describe('flight numbers', () => {
  it.each(['TK 381', 'TK381', 'tk381', 'tk 381', 'TK-381'])(
    '%s is one flight-number prefix, spaces and case ignored',
    (query) => {
      expect(run(query, library)).toEqual(ids(tbsIst, istTbs, longer))
    },
  )

  it('narrows while a flight number is typed', () => {
    expect(run('TK38', library)).toEqual(ids(tbsIst, istTbs, longer))
    expect(run('TK3810', library)).toEqual(ids(longer))
  })

  it('reads an airline code and digits as one term', () => {
    expect(parseJournalSearch('TK 381', ctx()).terms).toHaveLength(1)
  })

  it('combines the airline code with a digits-only flight number', () => {
    const bare = flight('2025-06-01', 'TBS', 'IST', { flight_number: '381', airline_iata: 'TK' })
    expect(run('TK381', [bare, tbsIst])).toEqual(ids(bare, tbsIst))
  })
})

describe('dates', () => {
  it.each([
    ['2019', [old2019]],
    ['2023', [may2023]],
    ['2024-03', [tbsJfk]],
    ['2024/03', [tbsJfk]],
    ['03/2024', [tbsJfk]],
    ['2024-03-09', [tbsJfk]],
    ['march 2024', [tbsJfk]],
    ['Mar 2024', [tbsJfk]],
    ['2024 march', [tbsJfk]],
    ['март 2024', [tbsJfk]],
    ['марта 2024', [tbsJfk]],
    ['май 2023', [may2023]],
    ['мая 2023', [may2023]],
    ['МАЙ 2023', [may2023]],
    ['may 2023', [may2023]],
    ['ноябрь 2019', [old2019]],
    ['ноября 2019', [old2019]],
    ['may 2024', []],
  ] as const)('%s', (query, expected) => {
    expect(run(query, library)).toEqual(ids(...expected))
  })

  it('treats a month word alone as that month in every year', () => {
    expect(run('март', library)).toContain(tbsJfk.id)
    expect(run('марта', library)).toContain(tbsJfk.id)
    expect(run('november', library)).toContain(old2019.id)
    expect(run('январь', library)).toEqual([])
  })

  it('does not read a number outside 1900-2100 as a year', () => {
    expect(parseJournalSearch('3810', ctx()).terms[0].kind).toBe('any')
    expect(run('3810', library)).toEqual(ids(longer))
  })
})

describe('places', () => {
  it('matches a city or airport name at either end, in English and Russian', () => {
    expect(run('Kennedy', library)).toEqual(ids(longer, tbsJfk, may2023))
    expect(run('new york', library)).toEqual(ids(longer, tbsJfk, may2023))
    expect(run('Москва', library)).toEqual(ids(old2019))
    expect(run('Шереметьево', library)).toEqual(ids(old2019))
    expect(run('sheremetyevo', library)).toEqual(ids(old2019))
  })

  it.each([
    ['Georgia', [tbsIst, istTbs, tbsJfk, old2019]],
    ['Грузия', [tbsIst, istTbs, tbsJfk, old2019]],
    ['Turkey', [tbsIst, istTbs, longer, may2023]],
    ['Türkiye', [tbsIst, istTbs, longer, may2023]],
    ['Турция', [tbsIst, istTbs, longer, may2023]],
    ['США', [longer, tbsJfk, may2023]],
    ['united states', [longer, tbsJfk, may2023]],
    ['GE', [tbsIst, istTbs, tbsJfk, old2019]],
  ] as const)('%s is a country at either end', (query, expected) => {
    expect(run(query, library)).toEqual(ids(...expected))
  })

  it('does not read a two-letter airline code as a country', () => {
    const alts = (
      parseJournalSearch('TR', ctx()).terms[0] as {
        alts: Array<{ kind: string; place?: { countries: ReadonlySet<string> } }>
      }
    ).alts
    expect(alts.some((alt) => alt.kind === 'airline')).toBe(true)
    expect(alts.some((alt) => alt.kind === 'place' && alt.place?.countries.has('TR'))).toBe(false)
    expect(run('TR', library)).toEqual([])
  })

  it('accepts both languages whatever the locale', () => {
    expect(run('Грузия', library, 'en')).toEqual(run('Грузия', library, 'ru'))
    expect(run('georgia', library, 'ru')).toEqual(run('georgia', library, 'en'))
  })
})

describe('airline and aircraft', () => {
  it('matches an airline by code or by a word of its name', () => {
    expect(run('TK', library)).toEqual(ids(tbsIst, istTbs, longer, may2023))
    expect(run('turkish', library)).toEqual(ids(tbsIst, istTbs, longer, may2023))
    expect(run('Delta', library)).toEqual(ids(tbsJfk))
    expect(run('DL', library)).toEqual(ids(tbsJfk))
  })

  it('matches aircraft by ICAO code, family and name', () => {
    expect(run('A359', library)).toEqual(ids(tbsIst, istTbs))
    expect(run('A350', library)).toEqual(ids(tbsIst, istTbs))
    expect(run('737', library)).toEqual(ids(tbsJfk))
    expect(run('dreamliner', library)).toEqual(ids(longer, may2023))
    expect(run('787', library)).toEqual(ids(longer, may2023))
  })

  it('ANDs words of different kinds', () => {
    expect(run('turkish dreamliner', library)).toEqual(ids(longer, may2023))
    expect(run('turkish dreamliner 2023', library)).toEqual(ids(may2023))
    expect(run('Грузия A350', library)).toEqual(ids(tbsIst, istTbs))
  })
})

describe('fallback', () => {
  it('matches unknown airports and fields by folded substring', () => {
    const unknown = flight('2025-07-01', 'ZZZ', 'IST', { flight_number: 'XY123' })
    expect(run('zzz', [unknown, tbsIst])).toEqual(ids(unknown))
    expect(run('XY 123', [unknown, tbsIst])).toEqual(ids(unknown))
  })

  it('finds a flight whose airline is missing by its flight number', () => {
    const bare = flight('2025-07-01', 'TBS', 'IST', { flight_number: 'TK777' })
    expect(run('tk777', [bare])).toEqual(ids(bare))
  })
})
