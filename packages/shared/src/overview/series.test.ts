import { expect, it } from 'vitest'
import fixture from './__fixtures__/n1.json'
import { aggregateRows } from './aggregate'
import type { OverviewPayload } from './model'
import { overviewSeries } from './series'

it('daily evidence preserves weighted completed counts and cumulative totals without synthetic aggregate flight IDs', () => {
  const payload = structuredClone(fixture) as OverviewPayload
  const row = payload.rows[0]
  payload.rows = [
    { ...row, id: 3, date: '2024-02-29', state: 'logged', distanceKm: 200 },
    { ...row, id: 1, date: '2024-02-29', state: 'logged', distanceKm: 200 },
    { ...row, id: 2, date: '2024-02-29', state: 'awaiting', distanceKm: 300 },
    { ...row, id: 4, date: '2024-04-01', state: 'upcoming' },
    { ...row, id: 5, date: '2024-04-01', state: 'logged', distanceKm: 500 },
    { ...row, id: 6, date: '2024-02-30', state: 'logged' },
  ]
  const source = overviewSeries(payload, {})
  const compact = overviewSeries(
    {
      ...payload,
      mode: 'aggregate',
      aggregateResolution: 'day',
      rows: aggregateRows(payload.rows, 'day'),
    },
    {},
  )
  expect(source.daily).toEqual([
    { date: '2024-02-29', count: 2 },
    { date: '2024-04-01', count: 1 },
  ])
  expect(compact.daily).toEqual(source.daily)
  expect(compact.monthly).toEqual(source.monthly)
  expect(source.monthly[1]).toEqual({ date: '2024-03', flights: 0, km: 0 })
  expect(compact.cumulative.at(-1)).toMatchObject({ flights: 4, km: 1200, flightId: null })
  expect(source.cumulative.map((point) => point.flightId)).toEqual([1, 2, 3, 5])
  expect(
    overviewSeries(payload, { period: { from: '2024-02-29', to: '2024-02-29' } }).daily,
  ).toEqual([{ date: '2024-02-29', count: 2 }])
})

it('legacy monthly aggregates expose monthly trends but explicitly withhold daily counts and day-located cumulative points', () => {
  const payload = {
    ...fixture,
    mode: 'aggregate',
    rows: aggregateRows(fixture.rows as OverviewPayload['rows']),
  } as OverviewPayload
  const series = overviewSeries(payload, {})
  expect(series.dailyAvailable).toBe(false)
  expect(series.daily).toEqual([])
  expect(series.cumulative).toEqual([])
  expect(series.monthly[0].flights).toBe(payload.rows.reduce((sum, row) => sum + row.weight, 0))
})
