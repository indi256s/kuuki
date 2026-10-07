import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { familyOf, findAircraft } from '../../../data/src/aircraft-lookup'
import { fleet } from './fleet'
import { computeOverview } from './compute'
import { clock } from './clock'
import { aggregateRows } from './aggregate'
import { matches } from './filter'
import type { Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'

const refs: OverviewPayload['refs'] = { airports: {}, regions: {},
  aircraft: Object.fromEntries(['A319', 'A320', 'B738', 'E75L', 'E75S'].map(code => {
    const ref = findAircraft(code)
    if (!ref) throw new Error(`Missing fixture aircraft ${code}`)
    return [code, { manufacturer: ref.manufacturer, type: ref.type, family: familyOf(code), name: ref.name }]
  })) }
const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2026-01-01', state: 'logged', origin: 'TBS', destination: 'IST',
  airline: null, aircraft: 'A320', flightNumber: null, depMinute: 600, arrMinute: null, distanceKm: 1000,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
  originTz: 'Asia/Tbilisi', destTz: 'Europe/Istanbul', departureUtc: null, suppressed: 0, ...extra,
})
const ten = (extra: Partial<OverviewRow> = {}) => Array.from({ length: 10 }, (_, i) => row({ id: i + 1, ...extra }))
function ready<T>(gate: Gate<T>): T {
  if (gate.status !== 'ready') throw new Error('Expected ready section')
  return gate.value
}

it('top type share uses typed flights and chart rows are sorted by flights then key', () => {
  const result = ready(fleet([row({ aircraft: 'A320', weight: 4 }), row({ aircraft: 'A319', weight: 2 }),
    row({ aircraft: 'B738', weight: 2 }), row({ aircraft: null, weight: 2 })], refs))
  expect(result).toMatchObject({ topType: { icao: 'A320', share: 0.5 }, typed: 8, total: 10, types: 3, families: 2,
    byManufacturer: [{ key: 'Airbus', flights: 6 }, { key: 'Boeing', flights: 2 }],
    byBodyType: [{ key: 'narrowbody', flights: 8 }] })
  expect(ready(fleet([row({ aircraft: 'A320', weight: 2 }), row({ aircraft: 'A319', weight: 2 }), row({ aircraft: 'B738' })], refs)).topType)
    .toEqual({ icao: 'A319', share: 0.4 })
})

it('families use the curated familyOf payload metadata', () => {
  expect(ready(fleet([row({ aircraft: 'E75L', weight: 3 }), row({ aircraft: 'E75S', weight: 2 })], refs)))
    .toMatchObject({ families: 1, types: 2, typed: 5, total: 5 })
})

it('fleet gates by typed weight and tolerates missing reference metadata', () => {
  expect(fleet([row({ weight: 4 }), row({ aircraft: null, weight: 100 })], refs))
    .toEqual({ status: 'below', have: 4, need: 5 })
  expect(ready(fleet([row({ aircraft: 'ZZZZ', weight: 5 })], refs))).toMatchObject({
    topType: { icao: 'ZZZZ', share: 1 }, typed: 5, total: 5, types: 1, families: 0, byBodyType: [], byManufacturer: [],
  })
})

it('red-eye is the night band including the exact local band boundaries', () => {
  const rows = [0, 359, 360, 719, 720, 1079, 1080, 1319, 1320, 1439].map((depMinute, i) => row({ depMinute, id: i + 1 }))
  expect(ready(clock(rows))).toMatchObject({ redEyes: 4, withDepartureTime: 10, total: 10 })
})

it('chart rows are complete and zero-filled with stable keys', () => {
  const result = ready(clock(ten().map((item, i) => ({ ...item, depMinute: [0, 600, 1380][i % 3] }))))
  expect(result.byHour).toHaveLength(24)
  expect(result.byHour.map(item => item.key)).toEqual(Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')))
  expect(result.byHour.filter(item => item.flights > 0)).toEqual([
    { key: '00', hour: 0, flights: 4 }, { key: '10', hour: 10, flights: 3 }, { key: '23', hour: 23, flights: 3 },
  ])
  expect(result.haul).toEqual([{ key: 'short', flights: 10 }, { key: 'medium', flights: 0 }, { key: 'long', flights: 0 }])
})

it('speed needs precise durations while accepted departure times still count', () => {
  const result = ready(clock(ten({ durationSource: 'estimate' })))
  expect(result.averageSpeedKmh).toBeNull()
  expect(result.withDepartureTime).toBe(10)
  expect(result.byHour[10].flights).toBe(10)
})

it('speed excludes estimates, missing pairs, invalid values and zero duration', () => {
  const rows = ten()
  rows[0] = row({ durationSource: 'estimate', distanceKm: 9000, durationMinutes: 10 })
  rows[1] = row({ durationMinutes: 0 })
  rows[2] = row({ distanceKm: null })
  rows[3] = row({ durationMinutes: null })
  rows[4] = row({ distanceKm: NaN })
  expect(ready(clock(rows)).averageSpeedKmh).toBeCloseTo(500)
})

it('haul and hour counts use weights while aggregate speed uses stored sums', () => {
  const result = ready(clock([row({ weight: 10, distanceKm: 40000, durationMinutes: 2400 })]))
  expect(result.haul).toEqual([{ key: 'short', flights: 0 }, { key: 'medium', flights: 0 }, { key: 'long', flights: 10 }])
  expect(result.byHour[10].flights).toBe(10)
  expect(result.averageSpeedKmh).toBeCloseTo(1000)
})

it('aggregation preserves speed pairs and haul counts when distances are missing', () => {
  const rows = ten({ durationMinutes: 60 }).map((item, i) => ({ ...item, distanceKm: i ? null : 100 }))
  expect(ready(clock(rows)).averageSpeedKmh).toBe(100)
  expect(ready(clock(aggregateRows(rows)))).toEqual(ready(clock(rows)))
})

it('aggregation preserves haul filters for differing fallback distances on the same route', () => {
  const rows = ten().map((item, i) => ({ ...item, distanceKm: i % 2 ? 5000 : 1000 }))
  const grouped = aggregateRows(rows)
  expect(ready(clock(grouped))).toEqual(ready(clock(rows)))
  for (const haul of ['short', 'medium', 'long'] as const) {
    const count = (items: OverviewRow[]) => items.filter(item => matches(item, { haul: [haul] }, refs))
      .reduce((sum, item) => sum + item.weight, 0)
    expect(count(grouped)).toBe(count(rows))
  }
})

it('aggregation excludes missing and zero durations from paired speed totals', () => {
  const rows = ten()
  rows[0] = row({ durationMinutes: null })
  rows[1] = row({ durationMinutes: 0 })
  expect(ready(clock(aggregateRows(rows)))).toEqual(ready(clock(rows)))
})

it('clock gates by valid departure times and keeps missing metrics finite', () => {
  const rows = ten()
  rows[0] = row({ depMinute: 1440 })
  rows[1] = row({ depMinute: null })
  expect(clock(rows)).toEqual({ status: 'below', have: 8, need: 10 })
  const result = ready(clock(ten({ distanceKm: null, durationMinutes: null, durationSource: null })))
  expect(result.averageSpeedKmh).toBeNull()
  expect(result.haul.every(item => item.flights === 0)).toBe(true)
  expect(result.byHour.every(item => Number.isFinite(item.flights))).toBe(true)
  expect(ready(clock(ten({ durationMinutes: 0 }))).averageSpeedKmh).toBeNull()
})

it('body split and most-flown family reproduce the board source', () => {
  const board = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  const result = ready(fleet(board.rows.filter(row => row.state !== 'upcoming'), board.refs))
  expect(result.bodies.filter(row => row.body === 'narrow').reduce((sum, row) => sum + row.flights, 0)).toBe(48)
  expect(result.bodies.filter(row => row.body === 'wide').reduce((sum, row) => sum + row.flights, 0)).toBe(16)
  expect(result.topFamily).toEqual({ family: 'A320', flights: 27 })
  expect(result.familyCount).toBe(7)
  expect(result.untyped).toBe(5)
  expect(result.familyRows.map(row => row.family)).toEqual(['A320', '737', 'E-Jet', 'ATR 42/72', 'A350', '777', 'A330'])
})

it('family durations exclude estimates and invalids, preserve real samples and never divide weighted sums', () => {
  const rows = [120, 30, 90, 0].map((durationMinutes, i) => row({ id: i + 1, durationMinutes }))
  rows.push(row({ id: 5, durationMinutes: 600, durationSource: 'estimate' }),
    row({ id: 6, durationMinutes: null }), row({ id: 7, durationMinutes: -1 }),
    row({ id: 8, durationMinutes: NaN }), row({ id: 9, durationSource: null }),
    row({ id: 10, weight: 3, durationMinutes: 750 }))
  const expected = ready(fleet(rows, refs))
  expect(expected.familyRows).toEqual([{ key: 'narrow:airbus:A320', family: 'A320', maker: 'airbus', body: 'narrow', flights: 12, minutes: [0, 30, 90, 120] }])
  const grouped = aggregateRows(rows)
  expect(ready(fleet(grouped, refs))).toEqual(expected)
  expect(ready(fleet(aggregateRows([...rows].reverse()), refs))).toEqual(expected)
  expect(ready(fleet(aggregateRows(grouped), refs))).toEqual(expected)
  const legacy = grouped.map(row => { const copy = { ...row }; delete copy.preciseDurationSamples; return copy })
  expect(ready(fleet(legacy, refs)).familyRows[0].minutes).toEqual([])
  const payload = JSON.parse(readFileSync(new URL('./__fixtures__/n10.json', import.meta.url), 'utf8')) as OverviewPayload
  const legacySingletons = { ...payload, mode: 'aggregate' as const, refs, rows: ten() }
  expect(ready(computeOverview(legacySingletons, {}).fleet).familyRows[0].minutes).toEqual([])
})

it('new fleet rows omit missing metadata and use stable maker and body order', () => {
  const extraRefs = { ...refs, aircraft: { ...refs.aircraft,
    B77W: { manufacturer: 'Boeing', type: 'widebody', family: '777', name: null },
    MISSING: { manufacturer: null, type: null, family: null, name: null } } }
  const rows = [row({ aircraft: 'B77W', weight: 2 }), row({ aircraft: 'E75L', weight: 2 }), row({ weight: 2 }),
    row({ aircraft: 'MISSING', weight: 2 }), row({ aircraft: null })]
  const result = ready(fleet(rows, extraRefs))
  expect(result.bodies).toEqual([{ key: 'narrow:airbus', body: 'narrow', maker: 'airbus', flights: 2 },
    { key: 'narrow:embraer', body: 'narrow', maker: 'embraer', flights: 2 },
    { key: 'wide:boeing', body: 'wide', maker: 'boeing', flights: 2 }])
  expect(result.familyCount).toBe(3)
  expect(result.topFamily).toEqual({ family: '777', flights: 2 })
  expect(result.familyRows.every(row => row.minutes.length === 0)).toBe(true)
  expect(result.untyped).toBe(1)
})


it('fleet body classification follows filter semantics and excludes absent metadata and zero rows', () => {
  for (const [type, body] of [['narrowbody', 'narrow'], ['regional', 'narrow'], ['bizjet', 'narrow'],
    ['turboprop', 'narrow'], ['piston', 'narrow'], ['widebody', 'wide'], [null, null]] as const) {
    const metadata = { ...refs, aircraft: { A320: { ...refs.aircraft.A320, type } } }
    const result = ready(fleet([row({ weight: 5 }), row({ aircraft: 'B738', weight: 0 })], metadata))
    expect(result.bodies).toEqual(body ? [{ key: `${body}:airbus`, body, maker: 'airbus', flights: 5 }] : [])
    expect(result.familyCount).toBe(body ? 1 : 0)
    expect(result.topFamily).toEqual(body ? { family: 'A320', flights: 5 } : null)
  }
  const metadata = { ...refs, aircraft: { ...refs.aircraft, A319: { ...refs.aircraft.A319, type: 'widebody' } } }
  const rows = [row({ aircraft: 'A319', weight: 2 }), row({ weight: 3 })]
  const result = ready(fleet(rows, metadata))
  expect(result.familyRows.map(row => [row.body, row.family, row.flights])).toEqual([['narrow', 'A320', 3], ['wide', 'A320', 2]])
  expect(ready(fleet([...rows].reverse(), metadata))).toEqual(result)
})


it('clock arrivals use local arrMinute independently and before-noon uses valid departure weight', () => {
  const rows = [row({ id: 1, weight: 5, depMinute: 0, arrMinute: 400 }),
    row({ id: 2, weight: 5, depMinute: 720, arrMinute: 1300 }),
    row({ id: 3, weight: 2, depMinute: null, arrMinute: 0 }),
    ...[null, -1, 1440, NaN, Infinity].map((arrMinute, i) => row({ id: i + 4, depMinute: null, arrMinute }))]
  const result = ready(clock(rows))
  expect(result).toMatchObject({ withDepartureTime: 10, withArrivalTime: 12, beforeNoonShare: 0.5,
    peakHour: { hour: 0, flights: 5 }, arrPeakHour: { hour: 6, flights: 5 } })
  expect(result.arrByHour).toHaveLength(24)
  expect(result.arrByHour.filter(item => item.flights > 0)).toEqual([
    { key: '00', hour: 0, flights: 2 }, { key: '06', hour: 6, flights: 5 }, { key: '21', hour: 21, flights: 5 },
  ])
  expect(ready(clock([...rows].reverse()))).toEqual(result)
  expect(ready(clock(aggregateRows(rows)))).toEqual(result)
  const explicit = ready(clock([...ten(), row({ arrMinute: 400, depMinute: null }), row({ arrMinute: 1300, depMinute: null })]))
  expect(explicit.arrByHour[6].flights).toBe(1)
  expect(explicit.arrByHour[21].flights).toBe(1)
  expect(ready(clock(ten({ arrMinute: null, depMinute: 719 })))).toMatchObject({
    beforeNoonShare: 1, withArrivalTime: 0, arrPeakHour: null })
  expect(ready(clock(ten({ arrMinute: 1439, depMinute: 1439 })))).toMatchObject({
    beforeNoonShare: 0, arrPeakHour: { hour: 23, flights: 10 } })
  expect(clock(ten({ depMinute: null, arrMinute: 400 }))).toEqual({ status: 'below', have: 0, need: 10 })
})
