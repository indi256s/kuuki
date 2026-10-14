import { describe, expect, it } from 'vitest'
import { selectJournal, type LedgerItem } from './filter'
import {
  defaultSort,
  emptyFilters,
  type JournalFilters,
  type JournalFlight,
  type JournalPayload,
  type JournalSort,
} from './model'

let nextId = 1
function flight(overrides: Partial<JournalFlight> = {}): JournalFlight {
  const id = overrides.id ?? nextId++
  return {
    id,
    date: '2024-05-01',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'A321',
    flight_number: `TK${id}`,
    departure_time: '08:00',
    arrival_time: '10:00',
    departure_utc: null,
    arrival_utc: null,
    origin_tz: null,
    dest_tz: null,
    distance_km: 1000,
    duration_minutes: 120,
    duration_source: 'times',
    zones_overflown: null,
    source: 'manual',
    is_upcoming: false,
    enrichment_status: 'done',
    created_at: '2024-05-01T00:00:00.000Z',
    lifecycle_state: 'logged',
    confirmation_source: 'user',
    confirmed_at: null,
    lifecycle_timezone: null,
    awaiting_after: null,
    auto_confirm_after: null,
    arrival_transit: null,
    arrival_transit_leg_id: null,
    origin_country: 'GE',
    destination_country: 'TR',
    ...overrides,
  }
}

function payloadOf(flights: JournalFlight[], extra: Partial<JournalPayload> = {}): JournalPayload {
  return {
    flights,
    firsts: {},
    refs: {
      airports: {},
      airlines: {},
      aircraft: {
        A321: {
          name: 'Airbus A321',
          family: 'A320 family',
          manufacturer: 'Airbus',
          type: 'narrowbody',
        },
        A320: {
          name: 'Airbus A320',
          family: 'A320 family',
          manufacturer: 'Airbus',
          type: 'narrowbody',
        },
        B738: {
          name: 'Boeing 737-800',
          family: '737 NG',
          manufacturer: 'Boeing',
          type: 'narrowbody',
        },
      },
    },
    updatedAt: 0,
    revision: 1,
    publishedRevision: 1,
    derivedState: 'ready',
    ...extra,
  }
}

const select = (
  payload: JournalPayload,
  filters: Partial<JournalFilters> = {},
  sort: JournalSort = defaultSort,
  search?: (f: JournalFlight) => boolean,
) => selectJournal(payload, { ...emptyFilters(), ...filters }, sort, search)
const ids = (payload: JournalPayload, filters: Partial<JournalFilters> = {}, sort?: JournalSort) =>
  select(payload, filters, sort).matching.map((f) => f.id)
const shape = (items: LedgerItem[]) =>
  items.map((item) =>
    item.kind === 'flight'
      ? item.flight.id
      : `${item.airport}:${item.minutes ?? '?'}${item.estimated ? '~' : ''}`,
  )

describe('contents and status', () => {
  const logged = flight({ id: 1, date: '2024-01-03' })
  const awaiting = flight({ id: 2, date: '2024-01-02', lifecycle_state: 'awaiting' })
  const upcoming = flight({
    id: 3,
    date: '2024-01-01',
    lifecycle_state: 'upcoming',
    airline_iata: 'LH',
  })
  const payload = payloadOf([logged, awaiting, upcoming])

  it('shows logged and awaiting flights by default', () => {
    expect(ids(payload)).toEqual([1, 2])
  })

  it('shows exactly the chosen states when the status facet is set', () => {
    expect(ids(payload, { status: ['upcoming'] })).toEqual([3])
    expect(ids(payload, { status: ['logged', 'upcoming'] })).toEqual([1, 3])
  })

  it('counts statuses under the other facets while ignoring the status facet', () => {
    expect(select(payload, { status: ['upcoming'] }).statusCounts).toEqual({
      logged: 1,
      awaiting: 1,
      upcoming: 1,
    })
    expect(select(payload, { status: ['upcoming'], airlines: ['TK'] }).statusCounts).toEqual({
      logged: 1,
      awaiting: 1,
      upcoming: 0,
    })
    expect(select(payload, {}, defaultSort, (f) => f.id !== 2).statusCounts).toEqual({
      logged: 1,
      awaiting: 0,
      upcoming: 1,
    })
  })
})

describe('facets', () => {
  it('filters the period by inclusive days, else by any chosen year', () => {
    const payload = payloadOf([
      flight({ id: 1, date: '2023-12-31' }),
      flight({ id: 2, date: '2024-01-01' }),
      flight({ id: 3, date: '2024-06-30' }),
      flight({ id: 4, date: '2024-07-01' }),
      flight({ id: 5, date: '2022-03-03' }),
    ])
    expect(ids(payload, { from: '2024-01-01', to: '2024-06-30' })).toEqual([3, 2])
    expect(ids(payload, { years: [2022, 2023] })).toEqual([1, 5])
    expect(ids(payload, { years: [2022], from: '2024-01-01', to: '2024-06-30' })).toEqual([3, 2])
  })

  it('matches places at either end and treats airports and countries as one facet', () => {
    const payload = payloadOf([
      flight({
        id: 1,
        origin: 'TBS',
        destination: 'IST',
        origin_country: 'GE',
        destination_country: 'TR',
      }),
      flight({
        id: 2,
        origin: 'IST',
        destination: 'TBS',
        origin_country: 'TR',
        destination_country: 'GE',
      }),
      flight({
        id: 3,
        origin: 'FRA',
        destination: 'JFK',
        origin_country: 'DE',
        destination_country: 'US',
      }),
      flight({
        id: 4,
        origin: 'MUC',
        destination: 'XXX',
        origin_country: 'DE',
        destination_country: null,
      }),
    ])
    expect(ids(payload, { airports: ['TBS'] })).toEqual([2, 1])
    expect(ids(payload, { countries: ['US'] })).toEqual([3])
    expect(ids(payload, { countries: ['DE'] })).toEqual([4, 3])
    expect(ids(payload, { airports: ['JFK'], countries: ['GE'] })).toEqual([3, 2, 1])
  })

  it('matches airlines', () => {
    const payload = payloadOf([
      flight({ id: 1, airline_iata: 'TK' }),
      flight({ id: 2, airline_iata: 'LH' }),
      flight({ id: 3, airline_iata: null }),
    ])
    expect(ids(payload, { airlines: ['LH', 'BA'] })).toEqual([2])
  })

  it('matches aircraft codes or families as one facet', () => {
    const payload = payloadOf([
      flight({ id: 1, aircraft_icao: 'A321' }),
      flight({ id: 2, aircraft_icao: 'A320' }),
      flight({ id: 3, aircraft_icao: 'B738' }),
      flight({ id: 4, aircraft_icao: 'E190' }),
      flight({ id: 5, aircraft_icao: null }),
    ])
    expect(ids(payload, { aircraft: ['B738'] })).toEqual([3])
    expect(ids(payload, { families: ['A320 family'] })).toEqual([2, 1])
    expect(ids(payload, { aircraft: ['E190'], families: ['A320 family'] })).toEqual([4, 2, 1])
  })

  it('matches the alliance the airline belonged to on the flight date', () => {
    // JJ (TAM) left Star for oneworld on 2014-03-31.
    const payload = payloadOf([
      flight({ id: 1, airline_iata: 'JJ', date: '2013-05-01' }),
      flight({ id: 2, airline_iata: 'JJ', date: '2015-05-01' }),
      flight({ id: 3, airline_iata: null }),
    ])
    expect(ids(payload, { alliances: ['star'] })).toEqual([1])
    expect(ids(payload, { alliances: ['oneworld'] })).toEqual([2])
    expect(ids(payload, { alliances: ['star', 'oneworld'] })).toEqual([2, 1])
  })

  it('ORs missing details', () => {
    const payload = payloadOf([
      flight({ id: 1 }),
      flight({ id: 2, aircraft_icao: null }),
      flight({ id: 3, airline_iata: null }),
      flight({ id: 4, departure_time: null }),
      flight({ id: 5, flight_number: null }),
    ])
    expect(ids(payload, { missing: ['aircraft'] })).toEqual([2])
    expect(ids(payload, { missing: ['airline', 'times'] })).toEqual([4, 3])
    expect(ids(payload, { missing: ['flight_number'] })).toEqual([5])
  })

  it('ANDs facets and the injected search, without reading q itself', () => {
    const payload = payloadOf([
      flight({ id: 1, airline_iata: 'TK', origin: 'TBS' }),
      flight({ id: 2, airline_iata: 'TK', origin: 'FRA', origin_country: 'DE' }),
      flight({ id: 3, airline_iata: 'LH', origin: 'TBS' }),
    ])
    expect(ids(payload, { airlines: ['TK'], airports: ['TBS'] })).toEqual([1])
    expect(ids(payload, { q: 'nothing matches this' })).toEqual([3, 2, 1])
    expect(
      select(payload, { airlines: ['TK'] }, defaultSort, (f) => f.origin === 'FRA').matching.map(
        (f) => f.id,
      ),
    ).toEqual([2])
  })

  it('lists picker values from the whole payload regardless of filters', () => {
    const payload = payloadOf([
      flight({ id: 1, date: '2023-02-02', airline_iata: 'TK', aircraft_icao: 'B738' }),
      flight({
        id: 2,
        date: '2024-02-02',
        airline_iata: null,
        aircraft_icao: 'A321',
        lifecycle_state: 'upcoming',
        origin: 'FRA',
        origin_country: 'DE',
      }),
    ])
    expect(select(payload, { airlines: ['XX'] }).facetValues).toEqual({
      airlines: ['TK'],
      aircraft: ['A321', 'B738'],
      families: ['737 NG', 'A320 family'],
      airports: ['FRA', 'IST', 'TBS'],
      countries: ['DE', 'GE', 'TR'],
      years: [2023, 2024],
    })
  })
})

describe('sort', () => {
  const payload = payloadOf([
    flight({
      id: 1,
      date: '2024-01-01',
      departure_utc: '2024-01-01T08:00:00.000Z',
      duration_minutes: 60,
      distance_km: 500,
    }),
    flight({
      id: 2,
      date: '2024-01-01',
      departure_utc: '2024-01-01T12:00:00.000Z',
      duration_minutes: null,
      distance_km: 500,
    }),
    flight({
      id: 3,
      date: '2024-01-01',
      departure_utc: null,
      duration_minutes: 90,
      distance_km: null,
    }),
    flight({ id: 4, date: '2024-02-01', duration_minutes: 60, distance_km: 2000 }),
    flight({ id: 5, date: '2023-12-01', duration_minutes: 30, distance_km: 100 }),
  ])

  it('sorts by date newest first with departure instant and id tiebreaks, nulls last', () => {
    expect(ids(payload)).toEqual([4, 2, 1, 3, 5])
    expect(ids(payload, {}, { key: 'date', order: 'asc' })).toEqual([5, 1, 2, 3, 4])
  })

  it('sorts by duration and distance with nulls last in both orders and ties by id', () => {
    expect(ids(payload, {}, { key: 'duration', order: 'desc' })).toEqual([3, 4, 1, 5, 2])
    expect(ids(payload, {}, { key: 'duration', order: 'asc' })).toEqual([5, 1, 4, 3, 2])
    expect(ids(payload, {}, { key: 'distance', order: 'desc' })).toEqual([4, 2, 1, 5, 3])
    expect(ids(payload, {}, { key: 'distance', order: 'asc' })).toEqual([5, 1, 2, 4, 3])
  })
})

describe('connections', () => {
  const leg1 = flight({
    id: 11,
    date: '2024-03-01',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    distance_km: 1100,
    departure_utc: '2024-03-01T04:00:00.000Z',
    arrival_utc: '2024-03-01T06:15:00.000Z',
  })
  const leg2 = flight({
    id: 12,
    date: '2024-03-01',
    origin: 'IST',
    destination: 'FRA',
    airline_iata: 'LH',
    distance_km: 1900,
    origin_country: 'TR',
    destination_country: 'DE',
    departure_utc: '2024-03-01T09:00:00.000Z',
    arrival_utc: '2024-03-01T12:00:00.000Z',
  })
  const leg3 = flight({
    id: 13,
    date: '2024-03-01',
    origin: 'FRA',
    destination: 'JFK',
    airline_iata: 'TK',
    distance_km: 6200,
    origin_country: 'DE',
    destination_country: 'US',
    departure_utc: '2024-03-01T14:00:00.000Z',
    arrival_utc: '2024-03-01T22:00:00.000Z',
  })
  const other = flight({ id: 20, date: '2024-02-01', origin: 'LHR', destination: 'CDG' })
  const payload = payloadOf([leg3, leg2, leg1, other])

  it('joins adjacent legs with a transfer connector under date sort, in either order', () => {
    expect(shape(select(payload).items)).toEqual([13, 'FRA:120', 12, 'IST:165', 11, 20])
    expect(shape(select(payload, {}, { key: 'date', order: 'asc' }).items)).toEqual([
      20,
      11,
      'IST:165',
      12,
      'FRA:120',
      13,
    ])
    const legs = select(payload)
      .items.filter((item) => item.kind === 'flight')
      .map((item) => item.chain)
    expect(legs).toEqual([
      { id: '11-13', index: 2, length: 3 },
      { id: '11-13', index: 1, length: 3 },
      { id: '11-13', index: 0, length: 3 },
      null,
    ])
  })

  it('unlinks legs under non-date sorts', () => {
    const items = select(payload, {}, { key: 'distance', order: 'desc' }).items
    expect(shape(items)).toEqual([13, 12, 11, 20])
    expect(items.every((item) => item.kind === 'flight' && item.chain === null)).toBe(true)
  })

  it('adds no connector across a filtered-out middle leg', () => {
    expect(shape(select(payload, { airlines: ['TK'] }).items)).toEqual([13, 11, 20])
  })

  it('marks date-only connections as estimated with unknown minutes', () => {
    const a = flight({ id: 31, date: '2024-04-01', origin: 'TBS', destination: 'IST' })
    const b = flight({
      id: 32,
      date: '2024-04-02',
      origin: 'IST',
      destination: 'AMS',
      destination_country: 'NL',
    })
    expect(select(payloadOf([b, a])).items).toContainEqual({
      kind: 'connector',
      key: 'connector-31-32',
      airport: 'IST',
      minutes: null,
      estimated: true,
    })
  })
})

it('uses the same flown flights for every total and retains estimated or missing values', () => {
  const payload = payloadOf([
    flight({ id: 1, distance_km: 1000, duration_minutes: 100, duration_source: 'estimate' }),
    flight({ id: 2, distance_km: null, duration_minutes: 50 }),
    flight({ id: 3, distance_km: 300, duration_minutes: null }),
    flight({ id: 4, lifecycle_state: 'awaiting', distance_km: 9999, duration_minutes: 999 }),
  ])
  expect(select(payload).summary).toEqual({
    flights: 3,
    distanceKm: 1300,
    durationMinutes: 150,
    durationEstimated: true,
    distanceMissing: 1,
    durationMissing: 1,
  })
})
