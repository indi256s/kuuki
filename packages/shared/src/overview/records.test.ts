import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { absoluteClockShiftMinutes, clockJump, recordExtrema, records } from './records'
import { computeOverview } from './compute'
import { rowCountries } from './filter'
import { aggregateRows } from './aggregate'
import type { OverviewPayload, OverviewRow } from './model'

const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2025-01-01', state: 'logged', origin: 'JFK', destination: 'LHR',
  airline: null, aircraft: null, flightNumber: null, depMinute: null, arrMinute: null, distanceKm: 1000,
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
  expect(result.longest).toMatchObject({ flightId: 4, origin: 'JFK', destination: 'LHR', value: 2000 })
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
  expect(result.northernmost).toEqual({ iata: 'LHR', lat: 51.47,
    flight: { flightId: 2, origin: 'JFK', destination: 'LHR', value: 1000, date: '2025-01-01' } })
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

it('aggregate duration records preserve individual extrema privately and null cabinet ids', () => {
  const rows = [60, 180, 120, 120, 120].map((durationMinutes, i) => row({ id: i + 1, durationMinutes }))
  const aggregate = aggregateRows(rows)
  expect(aggregate).toHaveLength(1)
  expect(aggregate[0]).toMatchObject({ id: 1, weight: 5, durationMinutes: 600 })
  const original = ready(rows)
  expect(original.shortestDuration).toMatchObject({ flightId: 1, value: 60 })
  expect(original.longestDuration).toMatchObject({ flightId: 2, value: 180 })
  const grouped = ready(aggregate, 'aggregate')
  expect({ longest: grouped.longestDuration, shortest: grouped.shortestDuration })
    .toEqual({ longest: { ...original.longestDuration, flightId: null }, shortest: { ...original.shortestDuration, flightId: null } })
  expect(aggregate[0].recordExtrema).toMatchObject({ longestDuration: original.longestDuration, shortestDuration: original.shortestDuration })
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
    .toEqual({ winner: { ...ready(rows).biggestClockJump, flightId: null }, clockShiftMinutes: shift(rows) })
  expect(grouped[0].recordExtrema?.biggestClockJump).toEqual(ready(rows).biggestClockJump)
})

it('aggregate extrema merge across groups, preserve ties and do not invent absent metadata', () => {
  const rows = [row({ id: 9, durationMinutes: 180, airline: 'BA' }), row({ id: 2, durationMinutes: 180 }),
    row({ id: 3, durationMinutes: 1, durationSource: 'estimate' }), row({ id: 4, durationMinutes: 60 }), row({ id: 5 })]
  const grouped = aggregateRows(rows)
  expect(recordExtrema(grouped)).toMatchObject({ longestDuration: { flightId: 2, value: 180 },
    shortestDuration: { flightId: 4, value: 60 } })
  expect(ready(grouped, 'aggregate')).toMatchObject({ longestDuration: { flightId: null, value: 180 },
    shortestDuration: { flightId: null, value: 60 } })
  expect(ready(aggregateRows([...rows].reverse()), 'aggregate')).toEqual(ready(grouped, 'aggregate'))
  expect(ready(aggregateRows(grouped), 'aggregate')).toEqual(ready(grouped, 'aggregate'))
  expect(ready([row({ weight: 5 })], 'aggregate')).toMatchObject({ longest: null, shortest: null,
    longestDuration: null, shortestDuration: null, biggestClockJump: null })
})

it('missing metrics and malformed legacy dates produce no invalid numbers', () => {
  const result = ready(five({ date: 'bad-date', distanceKm: null, durationMinutes: null,
    originTz: null, destTz: null, origin: 'ZZZ', destination: 'ZZZ' }))
  expect(result).toEqual({ longest: null, shortest: null, longestDuration: null, shortestDuration: null,
    biggestClockJump: null, busiestDay: null, busiestYear: null, earliestDeparture: null, northernmost: null, southernmost: null,
    longestStreakMonths: 0, longestGroundStopDays: null })
})

it('board cabinet uses actual winning flights and scoped calendar evidence', () => {
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  const rows = fixture.rows.filter(row => row.state !== 'upcoming')
  const result = records(rows, fixture.refs, 'flights')
  if (result.status !== 'ready') throw new Error('Expected board cabinet')
  const winner = rows.find(row => row.id === 33)!
  const previous = Math.max(...rows.filter(row => row.date < winner.date && row.distanceKm !== null)
    .map(row => row.distanceKm!))
  expect(previous).toBe(8207)
  expect(winner.flightNumber).toBe('QR 132')
  expect(result.value.longest).toMatchObject({ flightId: 33, origin: 'DOH', destination: 'AKL', value: 14535,
    date: '2023-03-16', airline: 'QR', flightNumber: winner.flightNumber, durationMinutes: 965,
    durationApproximate: false, speedKmh: 14535 * 60 / 965, previousBestKm: previous, equatorShare: 14535 / 40075 })
  expect(result.value.shortest).toMatchObject({ shareOfLongest: result.value.shortest!.value / 14535 })
  const year = result.value.busiestYear!
  const yearRows = rows.filter(row => row.date.startsWith('2019-'))
  const counts = Array.from({ length: 12 }, (_, i) => yearRows.filter(row => Number(row.date.slice(5, 7)) === i + 1).length)
  expect(year).toEqual({ year: 2019, flights: 14, countries: new Set(yearRows.flatMap(row => rowCountries(row, fixture.refs))).size,
    activeMonths: counts.filter(Boolean).length, peakMonth: counts.indexOf(Math.max(...counts)) + 1,
    months: counts.map((flights, i) => ({ key: `2019-${String(i + 1).padStart(2, '0')}`, month: i + 1, flights })) })
  expect(result.value.northernmost).toMatchObject({ iata: 'KTT', flight: { flightId: 13, date: '2019-09-08' } })
})

it.each([
  ['estimate', 120, true, null], [null, 120, false, null], ['times', 120, false, 500],
  ['route_median', 120, false, 500], ['schedule', 120, false, 500], ['times', 0, false, null],
  ['times', null, false, null], ['times', Infinity, false, null],
] as const)('longest speed respects paired duration %s/%s', (durationSource, durationMinutes, approximate, speed) => {
  expect(ready(five({ durationSource, durationMinutes })).longest)
    .toMatchObject({ speedKmh: speed, durationApproximate: approximate })
})

it('actual aggregate witnesses survive sums, representative ids, dates and hour floors', () => {
  const rows = [row({ id: 9, date: '2026-03-28', depMinute: 430, durationMinutes: 60 }),
    row({ id: 2, date: '2026-03-30', depMinute: 425, durationMinutes: 180, airline: null,
      flightNumber: 'WINNER', departureUtc: '2026-03-30T12:00:00Z' }),
    row({ id: 7, date: '2026-03-31', depMinute: 425, durationMinutes: 240 }),
    row({ id: 8, date: '2026-03-31', depMinute: 425, distanceKm: null }),
    row({ id: 10, date: '2026-03-01', distanceKm: 700, depMinute: 480 })]
  const original = ready(rows)
  expect(original.longest).toMatchObject({ flightId: 2, date: '2026-03-30', flightNumber: 'WINNER',
    durationMinutes: 180, clockShiftMinutes: 300, previousBestKm: 1000 })
  expect(original.earliestDeparture).toMatchObject({ flightId: 7, date: '2026-03-31', value: 425, depMinute: 425 })
  expect(original.northernmost?.flight).toMatchObject({ flightId: 7, date: '2026-03-31', value: 1000 })
  const grouped = aggregateRows(rows)
  expect(grouped.find(row => row.weight === 3)).toMatchObject({ id: 2, date: '2026-03-28', depMinute: 420,
    durationMinutes: 480, flightNumber: null, departureUtc: null })
  const nullIds = (value: unknown): unknown => Array.isArray(value) ? value.map(nullIds) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === 'flightId' ? null : nullIds(child)])) : value
  // Only day-level R2 fields intentionally differ in aggregate mode.
  const expected = { ...nullIds(original) as object, busiestDay: null, longestGroundStopDays: null }
  expect(ready(grouped, 'aggregate')).toEqual(expected)
  expect(ready(aggregateRows([...rows].reverse()), 'aggregate')).toEqual(expected)
  expect(ready(aggregateRows(grouped), 'aggregate')).toEqual(expected)
  expect(grouped.flatMap(row => Object.values(row.recordExtrema ?? {})).filter(Boolean)
    .every(ref => typeof ref!.flightId === 'number')).toBe(true)
  const laterMissing = [...rows, row({ id: 11, date: '2026-04-01', distanceKm: null })]
  expect(ready(aggregateRows(laterMissing), 'aggregate').northernmost?.flight).toMatchObject({ date: '2026-04-01', value: null })
})

it('strict earlier previous-best skips same-day, future and malformed metrics', () => {
  const rows = [row({ id: 1, date: '2025-01-20', distanceKm: 2000 }),
    row({ id: 2, date: '2025-01-20', distanceKm: 1900 }),
    row({ id: 3, date: '2025-01-21', distanceKm: 1800 }),
    row({ id: 4, date: '2025-01-01', distanceKm: 100 }),
    row({ id: 5, date: '2025-01-02', distanceKm: -100 }),
    row({ id: 6, date: '2025-01-03', distanceKm: Infinity }),
    row({ id: 7, date: 'bad', distanceKm: 1700 })]
  expect(ready(rows).longest?.previousBestKm).toBe(100)
  expect(ready(aggregateRows(rows), 'aggregate').longest?.previousBestKm).toBe(100)
  expect(ready(five()).longest?.previousBestKm).toBeNull()
})

it('legacy carried extrema retain route/value without fabricated context or minute', () => {
  const legacy = aggregateRows(five())[0]
  delete legacy.recordFlights
  legacy.recordExtrema!.longest = { flightId: 2, origin: 'JFK', destination: 'LHR', value: 1000 }
  legacy.recordExtrema!.shortest = { flightId: 3, origin: 'JFK', destination: 'LHR', value: 1000 }
  expect(ready([legacy], 'aggregate')).toMatchObject({ longest: { flightId: null, date: null, airline: null,
    flightNumber: null, durationMinutes: null, clockShiftMinutes: null, previousBestKm: null, speedKmh: null },
    shortest: { flightId: null, date: null }, northernmost: { iata: 'LHR', flight: null }, earliestDeparture: null })
  expect(ready([row({ weight: 5, depMinute: 425 })], 'aggregate')).toMatchObject({ longest: null,
    earliestDeparture: null, northernmost: { flight: null } })
})

it('weighted year, month and latitude ties are deterministic and suppress transit countries', () => {
  const rows = [row({ id: 1, date: '2024-01-01', weight: 3, distanceKm: 3000, suppressed: 1 }),
    row({ id: 2, date: '2024-02-01', weight: 3, distanceKm: 3000, suppressed: 3 }),
    row({ id: 3, date: '2025-01-01', weight: 6, distanceKm: 6000 }),
    row({ id: 4, date: '2024-01-32', weight: 9, distanceKm: 9000, suppressed: 1 }), row({ id: 5, date: 'bad', weight: 10 })]
  const result = ready(rows)
  expect(result.busiestYear).toMatchObject({ year: 2024, flights: 6, countries: 1, activeMonths: 2, peakMonth: 1 })
  expect(result.busiestYear!.months.map(month => month.flights)).toEqual([3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  expect(ready(aggregateRows(rows), 'aggregate').busiestYear).toEqual(result.busiestYear)
  expect(ready(five({ date: 'bad' })).busiestYear).toBeNull()
  const tiedRefs = { ...refs, airports: { ...refs.airports, JFK: { ...refs.airports.JFK, lat: 51.47 } } }
  expect(records(five(), tiedRefs, 'flights')).toMatchObject({ status: 'ready', value: { northernmost: { iata: 'JFK' } } })
})

it('earliest departure requires exact valid date/minute, with later-date then lowest-id ties', () => {
  const rows = [row({ id: 1, depMinute: 430 }), row({ id: 5, depMinute: 425 }),
    row({ id: 4, depMinute: 425, date: '2025-01-02' }), row({ id: 3, depMinute: 425, date: '2025-01-02' }),
    row({ id: 2, depMinute: 0, date: '2025-02-30' }), row({ id: 6, depMinute: -1 }),
    row({ id: 7, depMinute: Infinity }), row({ id: 8, depMinute: 1439.5 })]
  expect(ready(rows).earliestDeparture).toEqual({ flightId: 3, origin: 'JFK', destination: 'LHR',
    date: '2025-01-02', depMinute: 425, value: 425 })
  expect(ready(five()).earliestDeparture).toBeNull()
})

it('cabinet calendar evidence follows counted state and active filter scope', () => {
  const payload = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
  const filter = { period: { years: [2019] }, airlines: ['TK', 'AY'] }
  const source = payload.rows.filter(row => row.state !== 'upcoming' && row.date.startsWith('2019-') && ['TK', 'AY'].includes(row.airline ?? ''))
  const result = computeOverview(payload, filter).records
  const expected = records(source, payload.refs, 'flights')
  expect(result).toEqual(expected)
  expect(computeOverview({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) }, filter).records)
    .toMatchObject({ status: 'ready', value: { busiestYear: expected.status === 'ready' ? expected.value.busiestYear : null } })
})
