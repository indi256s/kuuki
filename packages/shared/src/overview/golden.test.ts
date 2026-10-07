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

function generate(name: typeof names[number], aggregate = true): OverviewPayload {
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
      regions: new Set([...evidence].map(country => refs.regions[country])).size }, rows: mode === 'aggregate' && aggregate ? aggregateRows(rows) : rows,
    refs: { airports: Object.fromEntries([...usedAirports].sort().map(code => [code, refs.airports[code]])),
      aircraft: Object.fromEntries([...usedAircraft].filter((code): code is string => !!code).sort().map(code => [code, refs.aircraft[code]])),
      regions: Object.fromEntries([...countries].sort().map(code => [code, refs.regions[code]])) } }
}

// Independent fixture oracle: derive the requested outputs from counted source rows,
// without invoking ranking, calendar or classification production helpers.
function expectedRankingOutputs(fixture: OverviewPayload) {
  const rows = fixture.rows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const dated = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) === row.date)
  const years = [...new Set(dated.map(row => Number(row.date.slice(0, 4))))].sort((a, b) => a - b).slice(-6)
  const leaders: Record<string, unknown> = {}, rankByYear: Record<string, unknown> = {}
  for (const category of ['airlines', 'airports', 'routes'] as const) {
    const keys = (row: OverviewRow) => category === 'airlines' ? (row.airline ? [row.airline] : [])
      : category === 'airports' ? [row.origin, row.destination] : [[row.origin, row.destination].sort().join('-')]
    const totals: Record<string, number> = {}, selected: Record<string, number> = {}
    const byYear: Record<number, Record<string, number>> = Object.fromEntries(years.map(year => [year, {}]))
    for (const row of rows) for (const key of keys(row)) totals[key] = (totals[key] ?? 0) + row.weight
    for (const row of dated) {
      const year = Number(row.date.slice(0, 4))
      if (!years.includes(year)) continue
      for (const key of keys(row)) {
        selected[key] = (selected[key] ?? 0) + row.weight
        byYear[year][key] = (byYear[year][key] ?? 0) + row.weight
      }
    }
    const order = (counts: Record<string, number>) => Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    const top = order(totals).slice(0, 5).map(key => ({ key, count: totals[key] }))
    const total = Object.values(totals).reduce((a, b) => a + b, 0)
    leaders[category] = { top, total, topShare: total ? top[0].count / total : 0,
      top5Share: total ? top.reduce((sum, row) => sum + row.count, 0) / total : 0 }
    const entities = order(selected).slice(0, 5)
    rankByYear[category] = years.flatMap(year => entities.filter(entity => byYear[year][entity] > 0)
      .sort((a, b) => byYear[year][b] - byYear[year][a] || a.localeCompare(b)).map(entity => ({
        key: `${entity}:${year}`, entity, year, count: byYear[year][entity],
        rank: 1 + entities.filter(other => (byYear[year][other] ?? 0) > byYear[year][entity]).length,
      })))
  }
  const total = rows.reduce((sum, row) => sum + row.weight, 0)
  const versus = ['makers', 'haul', 'daytime'].map(id => {
    let left = 0, right = 0
    for (const row of rows) {
      if (id === 'makers') {
        const maker = row.aircraft === null ? null : fixture.refs.aircraft[row.aircraft]?.manufacturer
        if (maker === 'Airbus') left += row.weight
        if (maker === 'Boeing') right += row.weight
      } else if (id === 'haul' && row.distanceKm !== null) {
        if (row.distanceKm / row.weight < 4000) left += row.weight
        else right += row.weight
      } else if (id === 'daytime' && row.depMinute !== null) {
        if (row.depMinute >= 360 && row.depMinute < 1320) left += row.weight
        else right += row.weight
      }
    }
    return { id, left: { key: id === 'makers' ? 'airbus' : id === 'haul' ? 'short' : 'day', count: left },
      right: { key: id === 'makers' ? 'boeing' : id === 'haul' ? 'long' : 'night', count: right }, excluded: total - left - right }
  })
  return { leaders, rankByYear, versus }
}

// Independent new-output oracle over fixture records, separate from engine helpers.
function expectClockAndRhythm(fixture: OverviewPayload, result: ReturnType<typeof computeOverview>) {
  const rows = fixture.rows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const validMinute = (minute: number | null): minute is number => minute !== null && Number.isFinite(minute) && minute >= 0 && minute < 1440
  if (result.clock.status === 'ready') {
    const hours = (arrival: boolean) => Array.from({ length: 24 }, (_, hour) => ({ key: String(hour).padStart(2, '0'), hour,
      flights: rows.reduce((sum, row) => {
        const minute = arrival ? row.arrMinute : row.depMinute
        return sum + (validMinute(minute) && Math.floor(minute / 60) === hour ? row.weight : 0)
      }, 0) }))
    const departures = hours(false), arrivals = hours(true)
    const peak = (buckets: typeof departures) => {
      const best = [...buckets].sort((a, b) => b.flights - a.flights || a.hour - b.hour)[0]
      return best.flights > 0 ? { hour: best.hour, flights: best.flights } : null
    }
    const timed = rows.filter(row => validMinute(row.depMinute))
    expect(result.clock.value).toMatchObject({ arrByHour: arrivals,
      withArrivalTime: arrivals.reduce((sum, row) => sum + row.flights, 0),
      beforeNoonShare: timed.filter(row => row.depMinute! < 720).reduce((sum, row) => sum + row.weight, 0) /
        timed.reduce((sum, row) => sum + row.weight, 0), peakHour: peak(departures), arrPeakHour: peak(arrivals) })
  }
  if (result.rhythm.status !== 'ready') return
  const value = result.rhythm.value
  const monthCounts = Array.from({ length: 12 }, (_, i) => ({ month: i + 1,
    flights: rows.filter(row => Number(row.date.slice(5, 7)) === i + 1).reduce((sum, row) => sum + row.weight, 0) }))
  const best = monthCounts.sort((a, b) => b.flights - a.flights || a.month - b.month)[0]
  expect(value.busiestMonthOfYear).toEqual(best.flights > 0 ? best : null)
  const occupied = [...new Set(rows.map(row => Number(row.date.slice(0, 4)) * 12 + Number(row.date.slice(5, 7)) - 1))].sort((a, b) => a - b)
  const label = (month: number) => `${String(Math.floor(month / 12)).padStart(4, '0')}-${String(month % 12 + 1).padStart(2, '0')}`
  const gaps = occupied.slice(1).map((month, i) => ({ months: month - occupied[i] - 1, from: label(occupied[i] + 1), to: label(month - 1) }))
    .filter(gap => gap.months > 0).sort((a, b) => b.months - a.months || a.from.localeCompare(b.from))
  expect(value.longestGap).toEqual(gaps[0] ?? null)
  const metric = (number: number | null) => number !== null && Number.isFinite(number) && number >= 0 ? number : 0
  const months = [...new Set(rows.map(row => row.date.slice(0, 7)))].sort()
  const sums = months.map(month => {
    const members = rows.filter(row => row.date.slice(0, 7) === month)
    return { flights: members.reduce((sum, row) => sum + row.weight, 0),
      distanceKm: members.reduce((sum, row) => sum + metric(row.distanceKm), 0),
      durationMinutes: members.reduce((sum, row) => sum + metric(row.durationMinutes), 0) }
  })
  expect(value.max).toEqual({ flights: Math.max(0, ...sums.map(sum => sum.flights)),
    distanceKm: Math.max(0, ...sums.map(sum => sum.distanceKm)), durationMinutes: Math.max(0, ...sums.map(sum => sum.durationMinutes)) })
  let km = 0
  const expected = fixture.mode === 'aggregate' ? months.map((month, i) => {
    km += sums[i].distanceKm
    return { date: month, km, flightId: null }
  }) : [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(row => {
    km += metric(row.distanceKm)
    return { date: row.date, km, flightId: row.id }
  })
  expect(value.odometer.map(({ date, km, flightId }) => ({ date, km, flightId }))).toEqual(expected)
  expect(new Set(value.odometer.map(point => point.key)).size).toBe(expected.length)
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
  expectClockAndRhythm(fixture, result)
  expect(result.rankings).toMatchObject(expectedRankingOutputs(fixture))
  expect(result).toMatchSnapshot()
})

it('board fixture reproduces board totals', () => {
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  const result = computeOverview(fixture, {})
  expect(fixture.schemaVersion).toBe(3)
  expect(result.figures).toMatchObject({ flights: 69, awaiting: 3, distanceKm: 141204 })
  if (result.rhythm.status !== 'ready') throw new Error('Expected ready board rhythm')
  expect(result.rhythm.value.odometer.at(-1)?.km).toBe(141204)
  expect(result.rhythm.value.odometer).toHaveLength(69)
  expectClockAndRhythm(fixture, result)
  expect(result.rankings).toMatchObject(expectedRankingOutputs(fixture))
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

it('n5001 precise duration evidence is derived exhaustively from actual source members', () => {
  const source = generate('n5001', false).rows
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/n5001.json', import.meta.url), 'utf8')) as OverviewPayload
  expect(fixture.rows).toHaveLength(641)
  let members = 0, precise = 0
  for (const group of fixture.rows) {
    const rows = source.filter(row => row.state === group.state && row.origin === group.origin && row.destination === group.destination &&
      row.airline === group.airline && row.aircraft === group.aircraft && row.date.slice(0, 7) === group.date.slice(0, 7) &&
      Math.floor(row.depMinute! / 60) === Math.floor(group.depMinute! / 60) && row.arrMinute === group.arrMinute &&
      row.durationSource === group.durationSource && row.suppressed === group.suppressed &&
      row.originTz === group.originTz && row.destTz === group.destTz && row.distanceKm === group.distanceKm! / group.weight)
    expect(rows).toHaveLength(group.weight)
    members += rows.length
    const minutes = rows.filter(row => row.durationSource === 'times').map(row => row.durationMinutes!).sort((a, b) => a - b)
    expect(group.preciseDurationSamples ?? []).toEqual(minutes)
    precise += minutes.length
  }
  expect(members).toBe(5001)
  expect(precise).toBe(4000)
  const raw = computeOverview({ ...fixture, mode: 'flights', rows: source }, {})
  const grouped = computeOverview(fixture, {})
  expect(grouped.fleet).toEqual(raw.fleet)
  if (raw.makers.status !== 'ready') throw new Error('Expected ready makers')
  expect(grouped.makers).toEqual({ status: 'ready', value: { ...raw.makers.value, flights: [] } })
})
