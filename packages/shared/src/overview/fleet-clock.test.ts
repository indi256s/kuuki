import { expect, it } from 'vitest'
import { familyOf, findAircraft } from '../../../data/src/aircraft-lookup'
import { fleet } from './fleet'
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
  airline: null, aircraft: 'A320', flightNumber: null, depMinute: 600, distanceKm: 1000,
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
  expect(result).toEqual({ topType: { icao: 'A320', share: 0.5 }, typed: 8, total: 10, types: 3, families: 2,
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
  expect(ready(fleet([row({ aircraft: 'ZZZZ', weight: 5 })], refs))).toEqual({
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
