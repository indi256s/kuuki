import { expect, it } from 'vitest'
import { matches, previousPeriod } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'

it('exact-day comparison preserves facets and equal inclusive spans across leap days and early years', () => {
  expect(
    previousPeriod({ period: { from: '2024-03-01', to: '2024-03-02' }, countries: ['JP'] }),
  ).toEqual({ period: { from: '2024-02-28', to: '2024-02-29' }, countries: ['JP'] })
  expect(previousPeriod({ period: { from: '0099-01-01', to: '0099-01-01' } })).toEqual({
    period: { from: '0098-12-31', to: '0098-12-31' },
  })
  expect(previousPeriod({ period: { from: '0000-01-01', to: '0000-01-01' } })).toBeNull()
})

const row = (date: string, overrides: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1,
  weight: 1,
  date,
  state: 'logged',
  origin: 'LHR',
  destination: 'JFK',
  airline: 'BA',
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
  ...overrides,
})
const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }

it('month facet ORs its values, ANDs other facets, reads legacy month rows and rejects bad dates', () => {
  const only = (filter: OverviewFilter, date: string, overrides?: Partial<OverviewRow>) =>
    matches(row(date, overrides), filter, refs)
  expect(only({ months: [3] }, '2024-03-15')).toBe(true)
  expect(only({ months: [3] }, '2024-04-15')).toBe(false)
  expect(only({ months: [3, 12] }, '2023-12-31')).toBe(true)
  expect(only({ months: [3], airlines: ['TK'] }, '2024-03-15')).toBe(false)
  expect(only({ months: [3], airlines: ['BA'] }, '2024-03-15')).toBe(true)
  expect(only({ months: [3] }, '2024-03')).toBe(true)
  expect(only({ months: [3] }, '2024-03-01', { weight: 4 })).toBe(true)
  expect(only({ months: [3] }, '2024-02-30')).toBe(false)
  expect(only({ months: [3] }, 'garbage')).toBe(false)
  expect(only({ months: [] }, 'garbage')).toBe(true)
})
