import { expect, it } from 'vitest'
import { aggregateRows } from './aggregate'
import { matches } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'

const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }
const row = (id: number, airline: string | null, date: string): OverviewRow => ({
  id, airline, date, weight: 1, state: 'logged', origin: 'IST', destination: 'FRA', aircraft: null,
  flightNumber: null, depMinute: 425, arrMinute: 400, distanceKm: 2000, durationMinutes: 180,
  durationSource: 'times', zonesOverflown: 2, originTz: null, destTz: null, departureUtc: null, suppressed: 0,
})

it.each([
  ['S7', '2022-04-18', '2022-04-19', 'oneworld'],
  ['QR', '2013-10-29', '2013-10-30', 'oneworld'],
] as const)('monthly %s transition preserves independent source scoped counts', (airline, before, after, alliance) => {
  const rows = [row(1, airline, before), row(2, airline, after), row(3, airline, after.slice(0, 8) + String(Number(after.slice(8)) + 1).padStart(2, '0')), row(4, null, after)]
  const grouped = aggregateRows(rows)
  expect(grouped).toHaveLength(3)
  expect(grouped.map(r => r.date)).toEqual([before, after, after])
  expect(aggregateRows([...rows].reverse())).toEqual(grouped)
  expect(aggregateRows(grouped)).toEqual(grouped)
  const activeBefore = airline === 'S7'
  const activeIds = activeBefore ? [1] : [2, 3]
  const cases: Array<[OverviewFilter, number[]]> = [
    [{ alliances: [alliance] }, activeIds],
    [{ alliances: [alliance], depHours: [7], arrHours: [6], airports: ['FRA'] }, activeIds],
    [{ airlines: [airline] }, [1, 2, 3]],
    [{ alliances: ['skyteam'] }, []],
  ]
  for (const [filter, expectedIds] of cases) {
    expect(rows.filter(r => matches(r, filter, refs)).map(r => r.id)).toEqual(expectedIds)
    expect(grouped.filter(r => matches(r, filter, refs)).reduce((sum, r) => sum + r.weight, 0)).toBe(expectedIds.length)
  }
})

it('aggregation normalizes invalid local times to missing and valid times to hour starts', () => {
  const rows = [null, NaN, Infinity, -1, 1439.5, 1440, 0, 1439].map((minute, i) => ({
    ...row(i + 1, null, '2025-01-03'), depMinute: minute, arrMinute: minute,
  }))
  const grouped = aggregateRows(rows)
  expect(grouped.map(r => [r.depMinute, r.arrMinute, r.weight])).toEqual([[null, null, 6], [0, 0, 1], [1380, 1380, 1]])
  expect(aggregateRows(grouped)).toEqual(grouped)
})
