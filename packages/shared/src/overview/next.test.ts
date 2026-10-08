import { expect, it } from 'vitest'
import board from './__fixtures__/board.json'
import n5001 from './__fixtures__/n5001.json'
import { computeOverview } from './compute'
import { aggregateRows } from './aggregate'
import type { OverviewPayload, OverviewRow } from './model'

const data = board as OverviewPayload
const upcoming = data.rows.find(row => row.state === 'upcoming')!

it('board next flights ignore filters and use the payload UTC date', () => {
  const result = computeOverview(data, { airlines: ['XX'] })
  expect(result.next).toHaveLength(2)
  expect(result.next[0]).toEqual({ flightId: 70, date: '2026-10-10', origin: 'DXB', destination: 'MLE',
    airline: 'EK', flightNumber: upcoming.flightNumber, daysAway: 3, newCountry: false })
})

it('new country uses counted unsuppressed evidence and passport, never earlier upcoming rows', () => {
  const rows = [
    { ...upcoming, id: 3, destination: 'SYD', date: '2026-10-11' },
    { ...upcoming, id: 2, destination: 'SYD' },
    { ...upcoming, id: 1, state: 'awaiting', suppressed: 2, destination: 'SYD' },
    { ...upcoming, id: 4, destination: 'ZZZ' },
  ] as OverviewRow[]
  const payload: OverviewPayload = { ...data, rows, passport: { ...data.passport, countryCodes: [] },
    refs: { ...data.refs, airports: { ...data.refs.airports, SYD: { lat: -34, lon: 151, country: 'AU', city: 'Sydney', name: 'SYD' } } } }
  const result = computeOverview(payload, {}).next
  expect(result.map(row => [row.flightId, row.newCountry])).toEqual([[2, true], [4, false], [3, true]])
  expect(computeOverview({ ...payload, passport: { ...payload.passport, countryCodes: ['AU'] } }, {}).next
    .every(row => !row.newCountry)).toBe(true)
  expect(computeOverview({ ...payload, rows: rows.map(row => row.id === 1 ? { ...row, suppressed: 0 } : row) }, {}).next
    .every(row => !row.newCountry)).toBe(true)
})

it('days away crosses UTC calendar boundaries and malformed dates stay finite', () => {
  const payload = { ...data, generatedAt: '2026-03-28T23:59:59Z', rows: [
    { ...upcoming, date: '2026-03-30' }, { ...upcoming, id: 71, date: '2026-02-30' },
    { ...upcoming, id: 72, date: 'bad' },
  ] }
  expect(computeOverview(payload, {}).next.map(row => row.daysAway)).toEqual([0, 2, 0])
  expect(computeOverview({ ...payload, generatedAt: 'bad' }, {}).next.every(row => row.daysAway === 0)).toBe(true)
})

it('replay is chronological and scoped with real flight ids', () => {
  const replay = computeOverview(data, { airlines: ['TK'] }).replay
  expect(replay).toHaveLength(24)
  expect(replay.map(row => row.date)).toEqual([...replay.map(row => row.date)].sort())
  expect(replay.every(row => data.rows.some(source => source.id === row.flightId && source.airline === 'TK' && source.state !== 'upcoming'))).toBe(true)
  expect(new Set(replay.map(row => row.key)).size).toBe(replay.length)
  const aggregate = computeOverview(n5001 as OverviewPayload, {}).replay
  expect(aggregate.length).toBeGreaterThan(0)
  expect(aggregate.every(row => row.flightId === null && /^\d{4}-\d{2}$/.test(row.date))).toBe(true)
  expect(aggregate.reduce((sum, row) => sum + row.weight, 0)).toBe((n5001 as OverviewPayload).rows
    .filter(row => row.state !== 'upcoming').reduce((sum, row) => sum + row.weight, 0))
})

it('aggregate replay keys distinguish monthly dimensions and remain stable on input reorder', () => {
  const base: OverviewRow = { ...upcoming, state: 'logged', id: 1, date: '2025-01-05', depMinute: 360 }
  const rows = aggregateRows([base, { ...base, id: 2, date: '2025-01-15', arrMinute: 600 },
    { ...base, id: 3, date: '2025-01-20', depMinute: 420 }])
  const payload: OverviewPayload = { ...data, mode: 'aggregate', rows }
  const replay = computeOverview(payload, {}).replay
  expect(replay).toHaveLength(3)
  expect(new Set(replay.map(row => row.key)).size).toBe(3)
  expect(replay.every(row => row.flightId === null && row.date === '2025-01')).toBe(true)
  expect(computeOverview({ ...payload, rows: [...rows].reverse() }, {}).replay).toEqual(replay)
  expect(computeOverview({ ...data, rows: [base, { ...base, id: 2 }] }, {}).replay.map(row => row.flightId)).toEqual([1, 2])
})

it('early calendar years do not inherit the Date.UTC 1900 offset', () => {
  const payload = { ...data, generatedAt: '0099-12-31T23:59:59Z', rows: [
    { ...upcoming, date: '0100-01-01' }, { ...upcoming, id: 1, date: '0099-12-30', state: 'logged' as const },
  ] }
  const result = computeOverview(payload, {})
  expect(result.next[0].daysAway).toBe(1)
  expect(result.figures.firstDate).toBe('0099-12-30')
  expect(result.figures.byYear).toEqual([{ key: '0099', year: 99, flights: 1 }])
})
