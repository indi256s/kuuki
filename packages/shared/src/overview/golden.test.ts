import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { findAirport } from '../../../data/src/airport-lookup'
import { familyOf, findAircraft } from '../../../data/src/aircraft-lookup'
import { greatCircleKm } from '../geo'
import { aggregateRows } from './aggregate'
import { computeOverview } from './compute'
import { rowCountries } from './filter'
import { AGGREGATE_THRESHOLD, type OverviewPayload, type OverviewRow } from './model'

const names = ['polar', 'dateLine', 'redEyeDst', 'transit', 'microstate', 'n0', 'n1', 'n10', 'n500', 'n5001'] as const
const airportCodes = ['TBS', 'IST', 'JFK', 'LHR', 'HKG', 'DXB', 'LAX', 'NRT', 'SFO', 'SIN', 'SYD', 'BAH', 'MLA', 'LUX']
const refs: OverviewPayload['refs'] = {
  airports: Object.fromEntries(airportCodes.map(code => {
    const ref = findAirport(code)
    if (!ref) throw new Error(`Missing fixture airport ${code}`)
    return [code, { lat: ref.latitude, lon: ref.longitude, country: ref.countryCode, city: ref.city, name: ref.name }]
  })),
  aircraft: Object.fromEntries(['A320', 'B738', 'B77W'].map(code => {
    const ref = findAircraft(code)
    if (!ref) throw new Error(`Missing fixture aircraft ${code}`)
    return [code, { manufacturer: ref.manufacturer, type: ref.type, family: familyOf(code), name: ref.name }]
  })),
  regions: { GE: 'asia', TR: 'asia', US: 'americas', GB: 'europe', HK: 'asia', AE: 'asia',
    JP: 'asia', SG: 'asia', AU: 'oceania', BH: 'asia', MT: 'europe', LU: 'europe' },
}

function flight(id: number, origin: string, destination: string, extra: Partial<OverviewRow> = {}): OverviewRow {
  const a = findAirport(origin), b = findAirport(destination)
  if (!a || !b) throw new Error('Missing fixture route')
  return { id, weight: 1, date: '2025-01-01', state: 'logged', origin, destination, airline: 'TK', aircraft: 'A320',
    flightNumber: String(id), depMinute: 600, arrMinute: null, distanceKm: Math.round(greatCircleKm({ lat: a.latitude, lon: a.longitude },
      { lat: b.latitude, lon: b.longitude })), durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
    originTz: a.timezone, destTz: b.timezone, departureUtc: null, suppressed: 0, ...extra }
}

function generate(name: typeof names[number]): OverviewPayload {
  let rows: OverviewRow[]
  if (name === 'polar') rows = Array.from({ length: 6 }, (_, i) => i % 2 ? flight(i + 1, 'DXB', 'LAX') : flight(i + 1, 'JFK', 'HKG'))
  else if (name === 'dateLine') rows = Array.from({ length: 6 }, (_, i) => i % 2 ? flight(i + 1, 'SFO', 'NRT') : flight(i + 1, 'NRT', 'SFO'))
  else if (name === 'redEyeDst') rows = Array.from({ length: 10 }, (_, i) => flight(i + 1, 'JFK', 'LHR', {
    date: '2026-03-28', depMinute: 1350, departureUtc: '2026-03-29T02:30:00Z', durationMinutes: 420,
  }))
  else if (name === 'transit') rows = [flight(1, 'TBS', 'IST', { suppressed: 2 }), flight(2, 'IST', 'NRT', { suppressed: 1 })]
  else if (name === 'microstate') rows = ['SIN', 'BAH', 'MLA', 'LUX'].map((code, i, codes) => flight(i + 1, code, codes[(i + 1) % codes.length]))
  else rows = Array.from({ length: Number(name.slice(1)) }, (_, i) => {
    const routes = [['TBS', 'IST'], ['JFK', 'LHR'], ['NRT', 'SFO']]
    const [origin, destination] = routes[i % routes.length]
    return flight(i + 1, origin, destination, { date: `${2020 + Math.floor(i / 12) % 6}-${String(i % 12 + 1).padStart(2, '0')}-${String(i % 27 + 1).padStart(2, '0')}`,
      state: i > 0 && i % 11 === 0 ? 'upcoming' : i % 7 === 0 ? 'awaiting' : 'logged',
      airline: ['TK', 'BA', 'JL'][i % 3], aircraft: ['A320', 'B738', 'B77W'][i % 3],
      depMinute: (i % 24) * 60 + 30, durationSource: i % 5 === 0 ? 'estimate' : 'times',
      durationMinutes: 120 + i % 7 * 30, suppressed: i % 13 === 0 ? 2 : 0 })
  })
  const usedAirports = new Set(rows.flatMap(row => [row.origin, row.destination]))
  const usedAircraft = new Set(rows.map(row => row.aircraft))
  const countries = new Set([...usedAirports].map(code => refs.airports[code].country).filter((code): code is string => !!code))
  const evidence = new Set(rows.filter(row => row.state !== 'upcoming').flatMap(row => rowCountries(row, refs)))
  const mode = rows.length > AGGREGATE_THRESHOLD ? 'aggregate' : 'flights'
  return { schemaVersion: 3, etag: 'W/"ov3-fixture-1-1"', generatedAt: '2026-10-07T00:00:00.000Z', mode, derivedReady: true,
    homeOverride: null, passport: { countries: evidence.size, countryCodes: [...evidence].sort(),
      regions: new Set([...evidence].map(country => refs.regions[country])).size }, rows: mode === 'aggregate' ? aggregateRows(rows) : rows,
    refs: { airports: Object.fromEntries([...usedAirports].sort().map(code => [code, refs.airports[code]])),
      aircraft: Object.fromEntries([...usedAircraft].filter((code): code is string => !!code).sort().map(code => [code, refs.aircraft[code]])),
      regions: Object.fromEntries([...countries].sort().map(code => [code, refs.regions[code]])) } }
}

it.each(names)('%s matches its generated fixture and known snapshot values', name => {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}.json`, import.meta.url))
  const generated = generate(name)
  if (process.env.UPDATE_OVERVIEW_FIXTURES === '1') {
    mkdirSync(fileURLToPath(new URL('./__fixtures__/', import.meta.url)), { recursive: true })
    writeFileSync(path, `${JSON.stringify(generated, null, 2)}\n`)
  }
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as OverviewPayload
  expect(fixture).toEqual(generated)
  const result = computeOverview(fixture, name === 'microstate' || name === 'transit' ? { airlines: ['TK'] } : {})
  if (name === 'n0') {
    for (const section of [result.records, result.crossings, result.fleet, result.clock, result.rhythm]) expect(section.status).toBe('below')
    expect(result.home).toBeNull()
  }
  if (name === 'n1') expect(result.figures.flights).toBe(1)
  if (name === 'n5001') {
    expect(fixture.mode).toBe('aggregate')
    let ids = 0
    const inspect = (value: unknown) => {
      if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        if (key === 'flightId') { expect(child).toBeNull(); ids++ }
        if (typeof child === 'number') expect(Number.isFinite(child)).toBe(true)
        inspect(child)
      }
    }
    inspect(result.records)
    expect(ids).toBe(7)
    expect(result.records).toMatchObject({ status: 'ready', value: { busiestDay: null, longestGroundStopDays: null } })
  }
  if (name === 'microstate') expect(result.figures.countries).toEqual({ value: 4, source: 'by_air' })
  if (name === 'transit') {
    expect(result.figures.countries).toEqual({ value: 2, source: 'by_air' })
    expect(result.globe.countries.map(country => country.code)).toEqual(['GE', 'JP'])
  }
  if (name === 'polar') expect(result.crossings).toMatchObject({ status: 'ready', value: { arcticCircle: 12, dateLine: 3 } })
  if (name === 'dateLine') expect(result.crossings).toMatchObject({ status: 'ready', value: { dateLine: 6, eastboundShare: 0.5 } })
  if (name === 'redEyeDst') {
    expect(result.clock).toMatchObject({ status: 'ready', value: { redEyes: 10 } })
    expect(result.crossings).toMatchObject({ status: 'ready', value: { clockShiftHours: 50 } })
  }
  expect(result).toMatchSnapshot()
})

it('board fixture reproduces board totals', () => {
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  const result = computeOverview(fixture, {})
  expect(fixture.schemaVersion).toBe(3)
  expect(result.figures).toMatchObject({ flights: 69, awaiting: 3, distanceKm: 141204 })
  expect(result.rankings.airlines[0]).toEqual({ key: 'TK', count: 24 })
  expect(result.records).toMatchObject({ status: 'ready', value: { northernmost: { iata: 'KTT', lat: expect.closeTo(67.6986111111, 8) } } })
  expect(result.crossings).toMatchObject({ status: 'ready', value: { arcticCircle: 2, clockShiftHours: 85 } })
  expect(fixture.refs.airports.KTT).toMatchObject({ lat: expect.closeTo(67.6986111111, 8), lon: expect.closeTo(24.8480555556, 8), country: 'FI' })
  expect(fixture.rows.filter(row => row.origin === 'KTT' || row.destination === 'KTT'))
    .toHaveLength(2)
  expect(fixture.rows.filter(row => row.origin === 'KTT' || row.destination === 'KTT')
    .every(row => row.originTz === 'Europe/Helsinki' && row.destTz === 'Europe/Helsinki')).toBe(true)
  expect(result.globe.airports.filter(({ iata }) => fixture.refs.airports[iata].lat !== null && fixture.refs.airports[iata].lon !== null))
    .toHaveLength(18)
  expect(computeOverview(fixture, { routes: ['HEL-KTT'], domestic: ['domestic'] }).figures.flights).toBe(2)
  expect(fixture.rows.filter(row => row.state === 'upcoming').map(row => [row.origin, row.destination, row.date]))
    .toEqual([['DXB', 'MLE', '2026-10-10'], ['IST', 'NRT', '2026-11-16']])
  const counted = fixture.rows.filter(row => row.state !== 'upcoming')
  expect(counted.filter(row => row.durationSource === 'estimate').map(row => row.id)).toEqual([1, 2, 3, 4, 5, 6])
  expect(counted.filter(row => row.state === 'awaiting').map(row => row.id)).toEqual([67, 68, 69])
  const prototype = JSON.parse(readFileSync(new URL('../../../../.scratch/overview-redesign/prototype/charts/flights.json', import.meta.url), 'utf8'))
  expect(counted.map(row => [row.date, row.distanceKm, row.durationMinutes]))
    .toEqual(prototype.map((row: { date: string; distanceKm: number; blockMinutes: number }) => [row.date, row.distanceKm, row.blockMinutes]))
})

it('board AT76 uses the canonical ATR 72-600 reference', () => {
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  expect(findAircraft('AT76')).toMatchObject({ manufacturer: 'ATR', model: '72-600', type: 'turboprop', capacity: null })
  expect(familyOf('AT76')).toBe('ATR 42/72')
  expect(fixture.refs.aircraft.AT76).toEqual({ manufacturer: 'ATR', type: 'turboprop', family: 'ATR 42/72', name: 'ATR 72-600' })
})
