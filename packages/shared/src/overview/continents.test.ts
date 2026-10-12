import { expect, it } from 'vitest'
import { continents, type Continents } from './continents'
import type { OverviewPayload, OverviewRow } from './model'
import fixture from './__fixtures__/n10.json'

const base = (fixture as OverviewPayload).rows[0]
const airport = (country: string | null, lat: number | null, lon: number | null) => ({
  lat,
  lon,
  country,
  city: null,
  name: 'x',
})
const refs: OverviewPayload['refs'] = {
  aircraft: {},
  regions: {
    RU: 'europe',
    KZ: 'asia',
    TR: 'asia',
    EG: 'africa',
    DE: 'europe',
    JP: 'asia',
    QA: 'asia',
    US: 'americas',
    BR: 'americas',
    PA: 'americas',
  },
  airports: {
    LED: airport('RU', 59.8, 30.3),
    SVX: airport('RU', 56.7, 60.8),
    UIK: airport('RU', 56.9, 105.7),
    ALA: airport('KZ', 43.4, 77),
    URA: airport('KZ', 51.1, 51.3),
    IST: airport('TR', 41.3, 28.7),
    ESB: airport('TR', 40.1, 33),
    CAI: airport('EG', 30.1, 31.4),
    SSH: airport('EG', 27.9, 34.4),
    FRA: airport('DE', 50, 8.6),
    NRT: airport('JP', 35.8, 140.4),
    DOH: airport('QA', 25.3, 51.6),
    JFK: airport('US', 40.6, -73.8),
    GRU: airport('BR', -23.4, -46.5),
    PTY: airport('PA', 9.1, -79.4),
    NOLL: airport('RU', 55, null),
    NOCC: airport(null, 1, 1),
    NOREG: airport('ZZ', 1, 1),
  },
}
let id = 0
const flight = (
  origin: string,
  destination: string,
  extra: Partial<OverviewRow> = {},
): OverviewRow => ({
  ...base,
  id: ++id,
  weight: 1,
  date: '2022-05-01',
  suppressed: 0,
  origin,
  destination,
  ...extra,
})
const run = (rows: OverviewRow[]) => {
  const gate = continents(rows, refs)
  if (gate.status !== 'ready') throw new Error('Expected ready continents')
  return gate.value
}
const flights = (value: Continents) =>
  Object.fromEntries(value.rows.filter((r) => r.flights).map((r) => [r.id, r.flights]))
const placeOne = (code: string) =>
  flights(run([flight(code, code), flight(code, code), flight(code, code)]))

it('lists all seven continents in order', () => {
  expect(
    run([flight('FRA', 'FRA'), flight('FRA', 'FRA'), flight('FRA', 'FRA')]).rows.map((r) => r.id),
  ).toEqual(['europe', 'asia', 'africa', 'north-america', 'south-america', 'oceania', 'antarctica'])
})

it('splits Russia, Kazakhstan, Turkey and Egypt by coordinates', () => {
  expect(placeOne('LED')).toEqual({ europe: 3 })
  expect(placeOne('SVX')).toEqual({ asia: 3 })
  expect(placeOne('UIK')).toEqual({ asia: 3 })
  expect(placeOne('URA')).toEqual({ europe: 3 })
  expect(placeOne('ALA')).toEqual({ asia: 3 })
  expect(placeOne('IST')).toEqual({ europe: 3 })
  expect(placeOne('ESB')).toEqual({ asia: 3 })
  expect(placeOne('CAI')).toEqual({ africa: 3 })
  expect(placeOne('SSH')).toEqual({ asia: 3 })
})

it('splits the Americas into north and south', () => {
  expect(placeOne('JFK')).toEqual({ 'north-america': 3 })
  expect(placeOne('PTY')).toEqual({ 'north-america': 3 })
  expect(placeOne('GRU')).toEqual({ 'south-america': 3 })
})

it('counts a transcontinental flight once for each continent and once for a shared one', () => {
  const value = run([flight('FRA', 'JFK'), flight('DOH', 'NRT'), flight('DOH', 'NRT')])
  expect(flights(value)).toEqual({ europe: 1, 'north-america': 1, asia: 2 })
  expect(value).toMatchObject({ flown: 3, placed: 3, unplaced: 0 })
})

it('ignores suppressed endpoints', () => {
  const value = run([
    flight('FRA', 'JFK', { suppressed: 2 }),
    flight('FRA', 'JFK', { suppressed: 1 }),
    flight('FRA', 'JFK', { suppressed: 3 }),
    flight('FRA', 'FRA'),
    flight('FRA', 'FRA'),
  ])
  expect(flights(value)).toEqual({ europe: 3, 'north-america': 1 })
  expect(value).toMatchObject({ placed: 4, unplaced: 1 })
})

it('counts unplaceable endpoints as unplaced without throwing', () => {
  const value = run([
    flight('NOLL', 'ZZZ'),
    flight('NOCC', 'NOREG'),
    flight('NOLL', 'FRA'),
    flight('FRA', 'FRA'),
    flight('FRA', 'FRA'),
    flight('FRA', 'FRA', { weight: 3 }),
  ])
  expect(flights(value)).toEqual({ europe: 6 })
  expect(value).toMatchObject({ placed: 6, unplaced: 2 })
})

it('sums aggregate weights and keeps the earliest year', () => {
  const value = run([
    flight('FRA', 'JFK', { weight: 40, date: '2019-03-02' }),
    flight('JFK', 'FRA', { weight: 2, date: '2018-12-31' }),
    flight('NRT', 'NRT', { weight: 1, date: 'bad-date' }),
  ])
  expect(value.rows.find((r) => r.id === 'europe')).toEqual({
    id: 'europe',
    flights: 42,
    firstYear: 2018,
  })
  expect(value.rows.find((r) => r.id === 'asia')).toEqual({
    id: 'asia',
    flights: 1,
    firstYear: null,
  })
  expect(value.rows.find((r) => r.id === 'oceania')).toEqual({
    id: 'oceania',
    flights: 0,
    firstYear: null,
  })
})

it('gates on three placed flights', () => {
  expect(
    continents([flight('FRA', 'FRA'), flight('FRA', 'FRA'), flight('NOCC', 'NOCC')], refs),
  ).toEqual({
    status: 'below',
    have: 2,
    need: 3,
  })
  expect(continents([flight('FRA', 'FRA', { weight: 3 })], refs).status).toBe('ready')
})
