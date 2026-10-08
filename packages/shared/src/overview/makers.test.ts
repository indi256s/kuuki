import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { familyOf, findAircraft } from '../../../data/src/aircraft-lookup'
import { aggregateRows } from './aggregate'
import { computeOverview } from './compute'
import { makers } from './makers'
import type { Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'

const board = JSON.parse(readFileSync(new URL('./__fixtures__/board.json', import.meta.url), 'utf8')) as OverviewPayload
const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({ ...board.rows[0], id: 1, weight: 1,
  state: 'logged', aircraft: 'A320', durationMinutes: 120, durationSource: 'times', distanceKm: 1000, ...extra })
function ready<T>(gate: Gate<T>): T {
  if (gate.status !== 'ready') throw new Error('Expected ready section')
  return gate.value
}

it('board makers count all 69 source flights with actual context, stable ordering and the all-flight denominator', () => {
  const result = ready(computeOverview(board, {}).makers)
  expect(result.rows.map(({ key, flights }) => [key, flights])).toEqual([
    ['airbus', 38], ['boeing', 21], ['embraer', 3], ['atr', 2], ['other', 0], ['unknown', 5],
  ])
  expect(result.leader).toEqual({ key: 'airbus', share: 38 / 69, flights: 38 })
  expect(result.flights).toHaveLength(69)
  expect(new Set(result.flights.map(row => row.key)).size).toBe(69)
  expect(result.flights.map(row => row.maker)).toEqual([
    ...Array(38).fill('airbus'), ...Array(21).fill('boeing'), ...Array(3).fill('embraer'), ...Array(2).fill('atr'), ...Array(5).fill('unknown'),
  ])
  for (const maker of ['airbus', 'boeing', 'embraer', 'atr', 'other', 'unknown']) {
    const flights = result.flights.filter(row => row.maker === maker)
    expect(flights.map(row => row.flightId)).toEqual([...flights]
      .sort((a, b) => a.date.localeCompare(b.date) || a.flightId - b.flightId).map(row => row.flightId))
  }
  for (const flight of result.flights) {
    const source = board.rows.find(row => row.id === flight.flightId)!
    expect(flight).toMatchObject({ flightId: source.id, origin: source.origin, destination: source.destination,
      date: source.date, aircraft: source.aircraft, durationMinutes: source.durationMinutes })
  }
  expect(ready(computeOverview({ ...board, rows: [...board.rows].reverse() }, {}).makers)).toEqual(result)
  const unknown = ready(computeOverview(board, { makers: ['unknown', 'atr', 'embraer'] }).makers)
  expect(unknown.leader).toEqual({ key: 'unknown', share: 0.5, flights: 5 })
})

it('other lists canonical families by flights then family key', () => {
  const refs = { ...board.refs, aircraft: { ...board.refs.aircraft } }
  for (const code of ['SU95', 'CRJ9']) {
    const ref = findAircraft(code)!
    refs.aircraft[code] = { manufacturer: ref.manufacturer, type: ref.type, family: familyOf(code), name: ref.name }
  }
  const rows = [row({ aircraft: 'SU95' }), row({ id: 2, aircraft: 'CRJ9' }), row({ id: 3, aircraft: 'CRJ9' }), row({ id: 4, weight: 2 })]
  expect(ready(makers(rows, refs, 'flights')).other).toEqual([
    { key: 'CRJ', family: 'CRJ', flights: 2, minutes: 240, km: 2000 },
    { key: 'Superjet 100-95', family: 'Superjet 100-95', flights: 1, minutes: 120, km: 1000 },
  ])
})

it('gate, zero slots, unknown metadata and weighted metrics retain Figures semantics', () => {
  expect(makers([row({ weight: 4 }), row({ aircraft: null, weight: 50 })], board.refs, 'flights'))
    .toEqual({ status: 'below', have: 4, need: 5 })
  const rows = [row({ weight: 5, durationMinutes: 600, distanceKm: 5000, durationSource: 'estimate' }),
    row({ id: 2, aircraft: null, durationMinutes: null, distanceKm: -1 }),
    row({ id: 3, aircraft: 'ZZZZ', durationMinutes: NaN, distanceKm: Infinity })]
  const result = ready(makers(rows, board.refs, 'flights'))
  expect(result.totals).toEqual({ flights: 7, minutes: 600, km: 5000, minutesApproximate: true })
  expect(result.rows.slice(1, 5).every(row => row.flights === 0 && row.minutes === 0 && row.km === 0)).toBe(true)
  expect(result.rows[5]).toEqual({ key: 'unknown', flights: 2, minutes: 0, km: 0 })
  expect(result.flights.find(row => row.flightId === 2)?.durationMinutes).toBeNull()
  expect(ready(makers([row({ weight: 5, aircraft: 'CRJ9' })], board.refs, 'flights')).other).toEqual([])
  const tied = ready(makers([row({ weight: 3, aircraft: 'B738' }), row({ weight: 3 })], board.refs, 'flights'))
  expect(tied.leader).toEqual({ key: 'airbus', flights: 3, share: 0.5 })
})

it('aggregate has no per-flight list and retains weighted sums without inventing context', () => {
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/n5001.json', import.meta.url), 'utf8')) as OverviewPayload
  expect(ready(computeOverview(fixture, {}).makers).flights).toEqual([])
  const rows = [row(), row({ id: 2, date: row().date, durationSource: 'estimate' }), row({ id: 3, aircraft: null })]
  const raw = ready(makers(rows.concat([row({ id: 4, weight: 3 })]), board.refs, 'flights'))
  const grouped = ready(makers(aggregateRows(rows.concat([row({ id: 4, weight: 3 })])), board.refs, 'aggregate'))
  expect(grouped).toEqual({ ...raw, flights: [] })
})
