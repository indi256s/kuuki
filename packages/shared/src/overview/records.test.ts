import { expect, it } from 'vitest'
import type { OverviewPayload, OverviewRow } from './model'
import { records } from './records'
import fixture from './__fixtures__/n10.json'

const payload = fixture as OverviewPayload
const row = (id: number, date: string, depMinute: number | null): OverviewRow => ({
  ...payload.rows[0],
  id,
  weight: 1,
  date,
  depMinute,
})
const latest = (rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights') => {
  const gate = records(rows, payload.refs, mode)
  if (gate.status !== 'ready') throw new Error('Expected ready records')
  return gate.value.latestDeparture
}

it('latest departure skips invalid evidence and breaks minute ties by newer date then lower id', () => {
  const rows = [
    row(1, '2025-01-01', 0),
    row(2, '2025-01-01', 1439),
    row(9, '2025-01-02', 1439),
    row(7, '2025-01-02', 1439),
    row(3, '2025-02-30', 1439),
    ...[null, NaN, Infinity, -1, 1439.5, 1440].map((minute, i) =>
      row(i + 10, '2025-01-03', minute),
    ),
  ]
  const expected = {
    flightId: 7,
    origin: payload.rows[0].origin,
    destination: payload.rows[0].destination,
    date: '2025-01-02',
    depMinute: 1439,
    value: 1439,
  }
  expect(latest(rows)).toEqual(expected)
  expect(latest([...rows].reverse())).toEqual(expected)
})

it('withholds latest departure when any row is weighted or carries aggregate witnesses', () => {
  const rows = [row(1, '2025-01-01', 365), row(2, '2025-01-02', 1385)]
  const witness = row(3, '2025-01-03', 420)
  for (const extra of [
    { weight: 2 },
    {
      recordExtrema: {
        longest: null,
        shortest: null,
        longestDuration: null,
        shortestDuration: null,
        biggestClockJump: null,
      },
    },
    {
      recordFlights: {
        latest: null,
        earliestDeparture: {
          flightId: 3,
          origin: witness.origin,
          destination: witness.destination,
          date: witness.date,
          value: 425,
          depMinute: 425,
        },
      },
    },
  ]) {
    expect(latest([...rows, { ...witness, ...extra }])).toBeNull()
  }
  expect(latest([...rows, witness], 'aggregate')).toBeNull()
})

it('lists the five longest distinct directed routes with their weighted flight counts', () => {
  const leg = (id: number, origin: string, destination: string, km: number, weight = 1) => ({
    ...row(id, '2025-01-01', null),
    origin,
    destination,
    distanceKm: km * weight,
    weight,
  })
  const top = (rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights') => {
    const gate = records(rows, payload.refs, mode)
    if (gate.status !== 'ready') throw new Error('Expected ready records')
    return gate.value.longest5
  }
  const rows = [
    leg(1, 'AAA', 'BBB', 100),
    leg(2, 'AAA', 'BBB', 100),
    leg(3, 'BBB', 'AAA', 100),
    leg(4, 'CCC', 'DDD', 900),
    leg(5, 'EEE', 'FFF', 500),
    leg(6, 'GGG', 'HHH', 300),
    leg(7, 'III', 'JJJ', 700),
    leg(8, 'KKK', 'LLL', 200),
  ]
  expect(top(rows)).toEqual([
    { origin: 'CCC', destination: 'DDD', km: 900, flights: 1 },
    { origin: 'III', destination: 'JJJ', km: 700, flights: 1 },
    { origin: 'EEE', destination: 'FFF', km: 500, flights: 1 },
    { origin: 'GGG', destination: 'HHH', km: 300, flights: 1 },
    { origin: 'KKK', destination: 'LLL', km: 200, flights: 1 },
  ])
  const few = [leg(1, 'AAA', 'BBB', 100), leg(2, 'AAA', 'BBB', 100), leg(3, 'BBB', 'AAA', 100)]
  expect(top(few)).toEqual([
    { origin: 'AAA', destination: 'BBB', km: 100, flights: 2 },
    { origin: 'BBB', destination: 'AAA', km: 100, flights: 1 },
  ])
  expect(
    top(
      [leg(1, 'AAA', 'BBB', 100, 4), leg(2, 'CCC', 'DDD', 50), leg(3, 'EEE', 'FFF', 60)],
      'aggregate',
    )[0],
  ).toEqual({
    origin: 'AAA',
    destination: 'BBB',
    km: 100,
    flights: 4,
  })
})

it('counts every flight on a longest route, including those without a distance', () => {
  const leg = (id: number, origin: string, destination: string, distanceKm: number | null) => ({
    ...row(id, '2025-01-01', null),
    origin,
    destination,
    distanceKm,
  })
  const gate = records(
    [
      leg(1, 'TBS', 'IST', 1000),
      leg(2, 'TBS', 'IST', null),
      leg(3, 'TBS', 'IST', null),
      leg(4, 'AAA', 'BBB', null),
    ],
    payload.refs,
    'flights',
  )
  if (gate.status !== 'ready') throw new Error('Expected ready records')
  expect(gate.value.longest5).toEqual([{ origin: 'TBS', destination: 'IST', km: 1000, flights: 3 }])
})
