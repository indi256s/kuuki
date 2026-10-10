import { expect, it } from 'vitest'
import type { Gate } from './figures'
import type { OverviewRow } from './model'
import { routes, type Routes } from './routes'

let nextId = 1
const row = (
  origin: string,
  destination: string,
  date: string,
  extra: Partial<OverviewRow> = {},
): OverviewRow => ({
  id: nextId++,
  weight: 1,
  date,
  state: 'logged',
  origin,
  destination,
  airline: null,
  aircraft: null,
  flightNumber: null,
  depMinute: null,
  arrMinute: null,
  distanceKm: null,
  durationMinutes: null,
  zonesOverflown: null,
  durationSource: null,
  originTz: null,
  destTz: null,
  departureUtc: null,
  suppressed: 0,
  ...extra,
})
const ready = (gate: Gate<Routes>): Routes => {
  if (gate.status !== 'ready') throw new Error('routes below gate')
  return gate.value
}
const run = (rows: OverviewRow[], counted = rows, home: string | null = null) =>
  routes(rows, counted, home)

it('stays below the gate under five weighted flights', () => {
  const rows = [row('IST', 'LHR', '2024-01-01'), row('IST', 'LHR', '2024-02-01', { weight: 3 })]
  expect(run(rows)).toEqual({ status: 'below', have: 4, need: 5 })
  expect(run([...rows, row('IST', 'CDG', '2024-03-01')]).status).toBe('ready')
})

it('classifies the profile at the 0.8 and 0.5 distinct-per-flight thresholds', () => {
  const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']
  const flown = (pairs: string[][]) =>
    ready(run(pairs.map(([a, b], i) => row(a, b, dates[i % dates.length])))).profile
  // 5 flights, 4 routes = 0.8
  expect(
    flown([
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'D'],
      ['A', 'E'],
      ['B', 'A'],
    ]),
  ).toBe('explorer')
  // 5 flights, 3 routes = 0.6
  expect(
    flown([
      ['A', 'B'],
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'C'],
      ['A', 'D'],
    ]),
  ).toBe('mixed')
  // 6 flights, 3 routes = 0.5
  expect(
    flown([
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'C'],
      ['A', 'C'],
      ['A', 'D'],
      ['A', 'D'],
    ]),
  ).toBe('commuter')
})

it('top is the most flown undirected route, ties by key ascending, and null below two flights', () => {
  const tie = ready(
    run([
      row('LHR', 'IST', '2024-01-01'),
      row('IST', 'LHR', '2024-01-02'),
      row('CDG', 'FRA', '2024-01-03'),
      row('FRA', 'CDG', '2024-01-04'),
      row('AMS', 'ZRH', '2024-01-05'),
    ]),
  )
  expect(tie.top).toEqual({ key: 'CDG-FRA', count: 2 })
  expect(tie.distinct).toBe(3)
  const none = ready(
    run(['A-B', 'A-C', 'A-D', 'A-E', 'A-F'].map((p) => row(p[0], p[2], '2024-01-01'))),
  )
  expect(none.top).toBeNull()
  expect(none.repeatShare).toBe(0)
})

it('repeatShare counts flights on routes flown at least twice, using row weight', () => {
  const value = ready(
    run([
      row('A', 'B', '2024-01-01', { weight: 3 }),
      row('B', 'A', '2024-01-02'),
      row('A', 'C', '2024-01-03'),
      row('A', 'D', '2024-01-04'),
    ]),
  )
  expect(value.flights).toBe(6)
  expect(value.repeatShare).toBeCloseTo(4 / 6)
  expect(value.top).toEqual({ key: 'A-B', count: 4 })
})

it('homeShare is null without home and counts flights touching the home airport', () => {
  const rows = [
    row('IST', 'LHR', '2024-01-01'),
    row('LHR', 'IST', '2024-01-02'),
    row('LHR', 'CDG', '2024-01-03'),
    row('CDG', 'FRA', '2024-01-04'),
    row('FRA', 'IST', '2024-01-05'),
  ]
  expect(ready(run(rows)).homeShare).toBeNull()
  expect(ready(run(rows, rows, 'IST')).homeShare).toBeCloseTo(3 / 5)
})

it('newRoutes counts first flights across counted rows, contiguously by year, within scope', () => {
  const counted = [
    row('IST', 'LHR', '2021-05-01'),
    row('IST', 'LHR', '2024-02-01'),
    row('IST', 'CDG', '2024-03-01'),
    row('IST', 'FRA', '2024-04-01'),
    row('IST', 'FRA', '2024-05-01'),
    row('IST', 'AMS', '2024-06-01'),
    row('IST', 'ZRH', '2023-06-01', { state: 'awaiting' }),
  ]
  const all = ready(run(counted))
  expect(all.byYear).toEqual([
    { key: '2021', year: 2021, flights: 1, newRoutes: 1 },
    { key: '2022', year: 2022, flights: 0, newRoutes: 0 },
    { key: '2023', year: 2023, flights: 1, newRoutes: 1 },
    { key: '2024', year: 2024, flights: 5, newRoutes: 3 },
  ])
  // Filtered to 2024 the span still comes from counted; LHR was first flown in 2021 so it is not new.
  const scoped = ready(
    run(
      counted.filter((r) => r.date.startsWith('2024')),
      counted,
    ),
  )
  expect(scoped.byYear.map((y) => [y.year, y.flights, y.newRoutes])).toEqual([
    [2021, 0, 0],
    [2022, 0, 0],
    [2023, 0, 0],
    [2024, 5, 3],
  ])
})

it('ignores invalid dates in byYear but still counts the flights', () => {
  const rows = [
    row('A', 'B', '2024-02-30'),
    row('A', 'C', '2024-01-01'),
    row('A', 'D', '2024-01-02'),
    row('A', 'E', '2024-01-03'),
    row('A', 'F', '2024-01-04'),
  ]
  const value = ready(run(rows))
  expect(value.flights).toBe(5)
  expect(value.byYear).toEqual([{ key: '2024', year: 2024, flights: 4, newRoutes: 4 }])
})
