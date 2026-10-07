import { expect, it } from 'vitest'
import { absoluteClockShiftMinutes, clockJump, records } from './records'
import { aggregateRows } from './aggregate'
import type { OverviewPayload, OverviewRow } from './model'

const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2025-01-01', state: 'logged', origin: 'JFK', destination: 'LHR',
  airline: null, aircraft: null, flightNumber: null, depMinute: null, distanceKm: 1000,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 5, originTz: 'America/New_York',
  destTz: 'Europe/London', departureUtc: null, suppressed: 0, ...extra,
})
const refs: OverviewPayload['refs'] = {
  airports: {
    JFK: { lat: 40.64, lon: -73.78, country: 'US', city: null, name: 'JFK' },
    LHR: { lat: 51.47, lon: -0.45, country: 'GB', city: null, name: 'LHR' },
    NRT: { lat: 35.77, lon: 140.39, country: 'JP', city: null, name: 'NRT' },
    SYD: { lat: -33.95, lon: 151.18, country: 'AU', city: null, name: 'SYD' },
  }, aircraft: {}, regions: {},
}
const five = (extra: Partial<OverviewRow> = {}) => Array.from({ length: 5 }, (_, i) => row({ id: i + 1, ...extra }))
function ready(rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights') {
  const result = records(rows, refs, mode)
  if (result.status !== 'ready') throw new Error('Expected ready records')
  return result.value
}

it('below five is gated using flight weights', () => {
  expect(records([], refs, 'flights')).toEqual({ status: 'below', have: 0, need: 5 })
  expect(records(five().slice(1), refs, 'flights')).toEqual({ status: 'below', have: 4, need: 5 })
  expect(records([row({ weight: 5 })], refs, 'aggregate').status).toBe('ready')
})

it('extremes and ties select the lowest flight id, independent of input order', () => {
  const rows = [row({ id: 10, distanceKm: 2000, durationMinutes: 180 }),
    row({ id: 4, distanceKm: 2000, durationMinutes: 180 }), row({ id: 3, durationMinutes: 60 }),
    row({ id: 2, durationMinutes: 60 }), row({ id: 8, distanceKm: null, durationMinutes: null })]
  const result = ready(rows)
  expect(result.longest).toEqual({ flightId: 4, origin: 'JFK', destination: 'LHR', value: 2000 })
  expect(result.shortest?.flightId).toBe(2)
  expect(result.longestDuration?.flightId).toBe(4)
  expect(result.shortestDuration?.flightId).toBe(2)
  expect(ready([...rows].reverse())).toEqual(result)
  const jumps = ready([row({ id: 2, originTz: 'America/Los_Angeles', destTz: 'Pacific/Auckland' }),
    row({ id: 1, originTz: 'Pacific/Auckland', destTz: 'America/Los_Angeles' }), ...five().slice(2)])
  expect(jumps.biggestClockJump).toMatchObject({ flightId: 1, value: -1260 })
})

it('estimate durations are excluded from duration records', () => {
  const result = ready([row({ id: 1, durationMinutes: 1000, durationSource: 'estimate' }),
    row({ id: 2, durationMinutes: 1, durationSource: 'estimate' }), ...five({ durationSource: 'schedule' }).slice(2)])
  expect(result.longestDuration).toMatchObject({ flightId: 3, value: 120 })
  expect(result.shortestDuration).toMatchObject({ flightId: 3, value: 120 })
  expect(ready(five({ durationSource: 'estimate' }))).toMatchObject({ longestDuration: null, shortestDuration: null })
})

it('endpoint latitude records retain suppressed transit airports', () => {
  const result = ready([row({ origin: 'NRT', destination: 'SYD', suppressed: 3 }), ...five().slice(1)])
  expect(result.northernmost).toEqual({ iata: 'LHR', lat: 51.47 })
  expect(result.southernmost).toEqual({ iata: 'SYD', lat: -33.95 })
})

it('streak crosses a year boundary and ignores repeated months', () => {
  const dates = ['2024-11-01', '2024-12-01', '2025-01-01', '2025-02-01', '2025-02-02']
  expect(ready(dates.map((date, i) => row({ id: i + 1, date }))).longestStreakMonths).toBe(4)
})

it('ground stop counts days between flight dates and busiest-day ties pick the first date', () => {
  const dates = ['2024-03-01', '2024-02-29', '2024-02-10', '2024-02-01', '2024-02-01', '2024-02-29']
  const result = ready(dates.map((date, i) => row({ id: i + 1, date })))
  expect(result.longestGroundStopDays).toBe(19)
  expect(result.busiestDay).toEqual({ date: '2024-02-01', flights: 2 })
})

it('aggregate mode nulls day-level records', () => {
  const result = ready([row({ weight: 5, distanceKm: 5000, durationMinutes: 600 })], 'aggregate')
  expect(result).toMatchObject({ busiestDay: null, longestGroundStopDays: null })
})

it('aggregate duration records preserve individual extrema and their flight ids', () => {
  const rows = [60, 180, 120, 120, 120].map((durationMinutes, i) => row({ id: i + 1, durationMinutes }))
  const aggregate = aggregateRows(rows)
  expect(aggregate).toHaveLength(1)
  expect(aggregate[0]).toMatchObject({ id: 1, weight: 5, durationMinutes: 600 })
  const original = ready(rows)
  expect(original.shortestDuration).toMatchObject({ flightId: 1, value: 60 })
  expect(original.longestDuration).toMatchObject({ flightId: 2, value: 180 })
  const grouped = ready(aggregate, 'aggregate')
  expect({ longest: grouped.longestDuration, shortest: grouped.shortestDuration })
    .toEqual({ longest: original.longestDuration, shortest: original.shortestDuration })
})

it('clock jump is DST-aware and prefers the actual departure instant', () => {
  expect(clockJump(row({ date: '2026-03-28' }))).toBe(240)
  expect(clockJump(row({ date: '2026-03-30' }))).toBe(300)
  expect(clockJump(row({ date: '2026-03-28', departureUtc: '2026-03-30T12:00:00Z' }))).toBe(300)
  expect(clockJump(row({ originTz: 'Unknown/Zone' }))).toBeNull()
})

it('aggregate clock jump records preserve the DST-aware individual winner', () => {
  const rows = ['2026-03-28', '2026-03-30', '2026-03-28', '2026-03-28', '2026-03-28']
    .map((date, i) => row({ id: i + 1, date }))
  expect(ready(rows).biggestClockJump).toMatchObject({ flightId: 2, value: 300 })
  const shift = (input: OverviewRow[]) => input.reduce((sum, item) => sum + (absoluteClockShiftMinutes(item) ?? 0), 0)
  expect(shift(rows)).toBe(1260)
  const grouped = aggregateRows(rows)
  expect({ winner: ready(grouped, 'aggregate').biggestClockJump, clockShiftMinutes: shift(grouped) })
    .toEqual({ winner: ready(rows).biggestClockJump, clockShiftMinutes: shift(rows) })
})

it('aggregate extrema merge across groups, preserve ties and do not invent absent metadata', () => {
  const rows = [row({ id: 9, durationMinutes: 180, airline: 'BA' }), row({ id: 2, durationMinutes: 180 }),
    row({ id: 3, durationMinutes: 1, durationSource: 'estimate' }), row({ id: 4, durationMinutes: 60 }), row({ id: 5 })]
  const grouped = aggregateRows(rows)
  expect(ready(grouped, 'aggregate')).toMatchObject({ longestDuration: { flightId: 2, value: 180 },
    shortestDuration: { flightId: 4, value: 60 } })
  expect(ready(aggregateRows([...rows].reverse()), 'aggregate')).toEqual(ready(grouped, 'aggregate'))
  expect(ready(aggregateRows(grouped), 'aggregate')).toEqual(ready(grouped, 'aggregate'))
  expect(ready([row({ weight: 5 })], 'aggregate')).toMatchObject({ longest: null, shortest: null,
    longestDuration: null, shortestDuration: null, biggestClockJump: null })
})

it('missing metrics and malformed legacy dates produce no invalid numbers', () => {
  const result = ready(five({ date: 'bad-date', distanceKm: null, durationMinutes: null,
    originTz: null, destTz: null, origin: 'ZZZ', destination: 'ZZZ' }))
  expect(result).toEqual({ longest: null, shortest: null, longestDuration: null, shortestDuration: null,
    biggestClockJump: null, busiestDay: null, northernmost: null, southernmost: null,
    longestStreakMonths: 0, longestGroundStopDays: null })
})
