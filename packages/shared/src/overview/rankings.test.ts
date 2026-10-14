import { expect, it } from 'vitest'
import { aggregateRows } from './aggregate'
import type { OverviewPayload } from './model'
import { rankings } from './rankings'
import fixture from './__fixtures__/n10.json'

const payload = fixture as OverviewPayload

it('accounts for every weighted flight in complete patterns, including other makers and missing evidence', () => {
  const rows = [
    { aircraft: 'BCS3', weight: 2, distanceKm: 6000, depMinute: 360 },
    { aircraft: 'E190', weight: 3, distanceKm: 12000, depMinute: 1319 },
    { aircraft: 'B738', weight: 1, distanceKm: 1499, depMinute: 1320 },
    { aircraft: null, weight: 4, distanceKm: null, depMinute: null },
    { aircraft: 'missing', weight: 1, distanceKm: -1, depMinute: 359 },
    { aircraft: 'A320', weight: 1, distanceKm: NaN, depMinute: 1440 },
  ].map((evidence, index) => ({ ...payload.rows[0], id: index + 1, ...evidence }))
  expect(rankings(rows).patterns).toEqual([
    {
      id: 'makers',
      total: 12,
      categories: [
        { key: 'airbus', count: 3 },
        { key: 'boeing', count: 1 },
        { key: 'embraer', count: 3 },
        { key: 'unknown', count: 5 },
      ],
    },
    {
      id: 'haul',
      total: 12,
      categories: [
        { key: 'short-medium', count: 3 },
        { key: 'long', count: 3 },
        { key: 'unknown', count: 6 },
      ],
    },
    {
      id: 'daytime',
      total: 12,
      categories: [
        { key: 'day', count: 5 },
        { key: 'night', count: 2 },
        { key: 'unknown', count: 5 },
      ],
    },
  ])
})

it('preserves complete departure and haul compositions when constituent flights are aggregated', () => {
  const rows = [359, 360, 1319, 1320, null].flatMap((depMinute, index) =>
    [1, 2].map((n) => ({
      ...payload.rows[0],
      id: index * 2 + n,
      date: '2025-01-01',
      distanceKm: index === 4 ? null : index % 2 ? 4000 : 1500,
      depMinute,
    })),
  )
  expect(rankings(aggregateRows(rows)).patterns).toEqual(rankings(rows).patterns)
})
