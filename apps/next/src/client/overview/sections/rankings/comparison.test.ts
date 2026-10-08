import { expect, it } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import board from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { airlineComparison } from './comparison'

const payload = board as OverviewPayload
const sample = payload.rows.find(row => row.state === 'logged')!

it('compares the same facets with weighted counts, preserving one-period airline identities and excluding upcoming flights', () => {
  const data: OverviewPayload = { ...payload, mode: 'aggregate', aggregateResolution: 'day', derivedReady: true, rows: [
    { ...sample, airline: 'AA', date: '2023-06-01', aircraft: 'A320', weight: 9 },
    { ...sample, airline: 'BB', date: '2024-06-01', aircraft: 'A320', weight: 4 },
    { ...sample, airline: 'AA', date: '2024-06-01', aircraft: 'B738', weight: 12 },
    { ...sample, airline: 'CC', date: '2024-06-01', aircraft: 'A320', weight: 20, state: 'upcoming' },
  ] }
  expect(airlineComparison(data, { period: { years: [2024] }, aircraft: ['A320'] })).toEqual([
    { key: 'AA', start: 9, end: 0 }, { key: 'BB', start: 0, end: 4 },
  ])
})

it('distinguishes unavailable comparisons from a known zero and keeps legacy whole-month comparisons available', () => {
  const data: OverviewPayload = { ...payload, derivedReady: true, rows: [{ ...sample, date: '2024-06-01', airline: 'AA', weight: 3 }] }
  expect(airlineComparison(data, {})).toBeNull()
  expect(airlineComparison(data, { period: { years: [2021, 2024] } })).toBeNull()
  expect(airlineComparison({ ...data, derivedReady: false }, { period: { years: [2024] } })).toBeNull()
  expect(airlineComparison({ ...data, mode: 'aggregate', aggregateResolution: 'month' }, { period: { from: '2024-06-01', to: '2024-06-30' } })).toBeNull()
  expect(airlineComparison({ ...data, mode: 'aggregate', aggregateResolution: 'month' }, { period: { from: '2024-06', to: '2024-06' } })).toEqual([{ key: 'AA', start: 0, end: 3 }])
})
