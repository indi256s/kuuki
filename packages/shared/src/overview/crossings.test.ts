import { expect, it, vi } from 'vitest'
import { findAirport } from '../../../data/src/airport-lookup'
import * as geo from '../geo'
import { aggregateRows } from './aggregate'
import { coverage } from './figures'
import { crossings } from './crossings'
import { computeOverview } from './compute'
import type { OverviewPayload, OverviewRow } from './model'

const codes = ['JFK', 'HKG', 'DXB', 'LAX', 'NRT', 'SFO', 'SIN', 'SYD', 'TBS', 'LHR', 'AKL']
const refs: OverviewPayload['refs'] = { airports: Object.fromEntries(codes.map(code => {
  const airport = findAirport(code)
  if (!airport) throw new Error(`Missing fixture airport ${code}`)
  return [code, { lat: airport.latitude, lon: airport.longitude, country: airport.countryCode,
    city: airport.city, name: airport.name }]
})), aircraft: {}, regions: {} }
const row = (origin: string, destination: string, extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2026-01-01', state: 'logged', origin, destination,
  airline: null, aircraft: null, flightNumber: null, depMinute: null, arrMinute: null, distanceKm: 1000,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
  originTz: findAirport(origin)?.timezone ?? 'UTC', destTz: findAirport(destination)?.timezone ?? 'UTC',
  departureUtc: null, suppressed: 0, ...extra,
})
function ready(rows: OverviewRow[], references = refs) {
  const result = crossings(rows, references)
  if (result.status !== 'ready') throw new Error('Expected ready crossings')
  return result.value
}

it('aggregation retains both-zone coverage across different or missing zone labels', () => {
  const rows = [row('TBS', 'LHR'), row('TBS', 'LHR', { id: 2, originTz: 'Asia/Baku' }),
    row('TBS', 'LHR', { id: 3 }), row('TBS', 'LHR', { id: 4, destTz: null })]
  const grouped = aggregateRows(rows)
  expect(coverage(grouped).withBothTz).toBe(3)
  expect(crossings(grouped, refs)).toEqual(crossings(rows, refs))
  expect(coverage(aggregateRows(grouped))).toEqual(coverage(rows))
  expect(crossings(aggregateRows(grouped), refs)).toEqual(crossings(rows, refs))
})

it.each([
  ['JFK', 'HKG', { dateLine: 1, arcticCircle: 2 }],
  ['DXB', 'LAX', { dateLine: 0, arcticCircle: 2 }],
  ['NRT', 'SFO', { dateLine: 1 }],
  ['SIN', 'SYD', { equator: 1 }],
] as const)('%s–%s matches the package-coordinate golden crossings', (origin, destination, expected) => {
  expect(ready([row(origin, destination), row('TBS', 'TBS', { id: 2, zonesOverflown: 0 }),
    row('TBS', 'TBS', { id: 3, zonesOverflown: 0 })])).toMatchObject(expected)
})

it('below three with tz is gated using weights', () => {
  expect(crossings([], refs)).toEqual({ status: 'below', have: 0, need: 3 })
  expect(crossings([row('NRT', 'SFO'), row('NRT', 'SFO', { id: 2 }),
    row('NRT', 'SFO', { id: 3, originTz: null })], refs)).toEqual({ status: 'below', have: 2, need: 3 })
})

it('weights multiply path counts while zones and stored clock shifts are already sums', () => {
  const rows = Array.from({ length: 7 }, (_, i) => row('NRT', 'SFO', { id: i + 1 }))
  const result = ready(aggregateRows(rows))
  expect(result).toMatchObject({ dateLine: 7, zonesOverflown: 14, clockShiftHours: 119, eastboundShare: 1 })
})

it('aggregate clock shifts preserve individual DST changes', () => {
  const rows = ['2026-03-28', '2026-03-30', '2026-03-28']
    .map((date, i) => row('JFK', 'LHR', { date, id: i + 1 }))
  expect(ready(rows).clockShiftHours).toBe(13)
  expect(ready(aggregateRows(rows)).clockShiftHours).toBe(13)
})

it('eastbound share wraps longitude and weights directional routes', () => {
  const rows = [row('NRT', 'SFO'), row('NRT', 'SFO', { id: 2 }), row('SFO', 'NRT', { id: 3 })]
  expect(ready(rows).eastboundShare).toBeCloseTo(2 / 3)
  expect(ready(aggregateRows(rows)).eastboundShare).toBeCloseTo(2 / 3)
})

it('memoises geometry once per directional route within a computation', () => {
  const sample = vi.spyOn(geo, 'greatCirclePoints')
  try {
    ready([row('NRT', 'SFO'), row('NRT', 'SFO', { id: 2 }), row('SFO', 'NRT', { id: 3 })])
    expect(sample).toHaveBeenCalledTimes(2)
    expect(sample.mock.calls.every(call => call[2] === 50)).toBe(true)
  } finally { sample.mockRestore() }
})

it('counts southern polar crossings and keeps missing geometry finite', () => {
  const custom: OverviewPayload['refs'] = { ...refs, airports: { ...refs.airports,
    AAA: { lat: -60, lon: 0, country: null, city: null, name: 'AAA' },
    BBB: { lat: -60, lon: 180, country: null, city: null, name: 'BBB' } } }
  expect(ready([row('AAA', 'BBB'), row('TBS', 'TBS', { id: 2 }), row('TBS', 'TBS', { id: 3 })], custom).antarcticCircle).toBe(2)
  const missing = ready(Array.from({ length: 3 }, (_, i) => row('ZZZ', 'ZZZ', { id: i + 1, zonesOverflown: null })))
  expect(missing).toMatchObject({ zonesOverflown: 0, clockShiftHours: 0, equator: 0, dateLine: 0,
    arcticCircle: 0, antarcticCircle: 0, eastboundShare: 0 })
  expect(missing.offsets).toHaveLength(24)
})

it('splits real signed shifts, ignoring legacy absolute sums and rounding once per direction', () => {
  const rows = [row('TBS', 'TBS', { originTz: 'UTC', destTz: 'Europe/Moscow', clockShiftMinutes: 999 }),
    row('TBS', 'TBS', { id: 2, originTz: 'Europe/Helsinki', destTz: 'UTC' }),
    row('TBS', 'TBS', { id: 3, originTz: 'UTC', destTz: 'UTC' })]
  expect(ready(rows)).toMatchObject({ forwardHours: 3, backHours: 2, clockShiftHours: 5 })
  const fractional = Array.from({ length: 3 }, (_, i) => row('TBS', 'TBS', {
    id: i + 1, originTz: 'Asia/Kolkata', destTz: 'Asia/Kathmandu' }))
  expect(ready(fractional)).toMatchObject({ forwardHours: 1, backHours: 0, clockShiftHours: 1,
    shiftByYear: [{ key: '2026', year: 2026, forward: 0.75, back: 0, flights: 3 }] })
  expect(ready(aggregateRows(fractional))).toEqual(ready(fractional))
})

it('wraps actual dated endpoint offsets into 24 ascending slots, even with a missing peer', () => {
  const rows = [row('AKL', 'TBS', { date: '2023-03-01', destTz: 'Asia/Kathmandu' }),
    row('TBS', 'TBS', { id: 2, originTz: 'America/St_Johns', destTz: null }),
    row('TBS', 'TBS', { id: 3, originTz: 'Invalid/Zone', destTz: 'UTC' }),
    row('TBS', 'TBS', { id: 4, date: 'invalid', originTz: 'Pacific/Honolulu', destTz: 'Pacific/Honolulu' }),
    row('TBS', 'TBS', { id: 5, departureUtc: 'invalid', originTz: 'Pacific/Honolulu', destTz: 'Pacific/Honolulu' }),
    row('TBS', 'TBS', { id: 6, date: '2026-02-30', originTz: 'Pacific/Honolulu', destTz: 'Pacific/Honolulu' })]
  const value = ready(rows)
  expect(value.offsets.map(slot => [slot.key, slot.offset])).toEqual(
    Array.from({ length: 24 }, (_, i) => [String(i - 11), i - 11]))
  expect(value.offsets.filter(slot => slot.hit).map(slot => slot.offset)).toEqual([-11, -4, 0, 5])
  expect(Number.isFinite(value.clockShiftHours)).toBe(true)
})

it('retains mixed directions and DST endpoint evidence before representative dates lose it', () => {
  const rows = ['2026-03-01', '2026-03-29', '2026-03-30'].map((date, i) => row('TBS', 'TBS', {
    id: i + 1, date, originTz: 'Europe/London', destTz: 'Africa/Abidjan',
    departureUtc: i === 0 ? '2026-03-29T02:30:00Z' : null }))
  const grouped = aggregateRows(rows)
  expect(grouped).toHaveLength(1)
  expect(ready(rows)).toMatchObject({ backHours: 3, forwardHours: 0 })
  expect(ready(grouped)).toEqual(ready(rows))
  expect(aggregateRows([...rows].reverse())).toEqual(grouped)
  expect(aggregateRows(grouped)).toEqual(grouped)
  const mixed = ['2024-03-01', '2024-03-31', '2024-03-31'].map((date, i) => row('TBS', 'TBS', {
    id: i + 1, date, originTz: 'Europe/London', destTz: 'Africa/Casablanca' }))
  const mixedGroup = aggregateRows(mixed)
  expect(mixedGroup).toHaveLength(1)
  expect(mixedGroup[0]).toMatchObject({ clockShiftMinutes: 180,
    crossingTime: { forwardMinutes: 60, backMinutes: 120, offsets: [0, 1] } })
  expect(ready(mixedGroup)).toEqual(ready(mixed))
  expect(ready(mixed)).toMatchObject({ forwardHours: 1, backHours: 2, clockShiftHours: 3 })
  expect(aggregateRows([...mixed].reverse())).toEqual(mixedGroup)
  expect(aggregateRows(mixedGroup)).toEqual(mixedGroup)
})

it('does not invent time evidence or latest flights for weighted legacy aggregates', () => {
  const legacy = row('SIN', 'SYD', { weight: 3, clockShiftMinutes: 600, distanceKm: null })
  expect(ready([legacy])).toMatchObject({ forwardHours: 0, backHours: 0, clockShiftHours: 0, lastEquator: null })
  expect(ready([legacy]).offsets.every(slot => !slot.hit)).toBe(true)
  expect(ready(aggregateRows([legacy]))).toEqual(ready([legacy]))
})

it('uses latest actual crossing witnesses with date/id ties and per-flight counts without distance', () => {
  const rows = [row('SIN', 'SYD', { id: 9, date: '2026-01-01' }),
    row('SIN', 'SYD', { id: 7, date: '2026-01-25', distanceKm: null }),
    row('SIN', 'SYD', { id: 2, date: '2026-01-25', distanceKm: null })]
  expect(ready(rows).lastEquator).toEqual({ flightId: 2, origin: 'SIN', destination: 'SYD', value: 1, date: '2026-01-25' })
  const payload: OverviewPayload = { schemaVersion: 3, etag: '', generatedAt: '', derivedReady: true,
    mode: 'aggregate', passport: { countries: 0, regions: 0, countryCodes: [] }, homeOverride: null,
    refs, rows: aggregateRows(rows) }
  expect(computeOverview(payload, {}).crossings).toMatchObject({ status: 'ready', value: {
    lastEquator: { flightId: null, origin: 'SIN', destination: 'SYD', value: 1, date: '2026-01-25' } } })
})

it('zero-fills the unfiltered counted account span and counts scoped flights with missing zones', () => {
  const rows = [row('TBS', 'TBS', { date: '0014-01-01' }),
    ...Array.from({ length: 3 }, (_, i) => row('TBS', 'TBS', { id: i + 2, date: '0016-01-01' })),
    row('TBS', 'TBS', { id: 5, date: '0016-02-01', originTz: null }),
    row('TBS', 'TBS', { id: 6, date: '0099-01-01', state: 'upcoming' })]
  const payload: OverviewPayload = { schemaVersion: 3, etag: '', generatedAt: '', derivedReady: true,
    mode: 'flights', passport: { countries: 0, regions: 0, countryCodes: [] }, homeOverride: null, refs, rows }
  expect(computeOverview(payload, { period: { years: [16] } }).crossings).toMatchObject({ status: 'ready', value: {
    shiftByYear: [{ key: '0014', year: 14, forward: 0, back: 0, flights: 0 },
      { key: '0015', year: 15, forward: 0, back: 0, flights: 0 },
      { key: '0016', year: 16, forward: 0, back: 0, flights: 4 }] } })
})
