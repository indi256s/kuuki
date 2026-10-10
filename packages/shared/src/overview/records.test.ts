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
