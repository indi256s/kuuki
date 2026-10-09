import { expect, it } from 'vitest'
import { aggregateRows } from './aggregate'
import { matches } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'

const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }
const row = (id: number, airline: string | null, date: string): OverviewRow => ({
  id,
  airline,
  date,
  weight: 1,
  state: 'logged',
  origin: 'IST',
  destination: 'FRA',
  aircraft: null,
  flightNumber: null,
  depMinute: 425,
  arrMinute: 400,
  distanceKm: 2000,
  durationMinutes: 180,
  durationSource: 'times',
  zonesOverflown: 2,
  originTz: null,
  destTz: null,
  departureUtc: null,
  suppressed: 0,
})

it.each([
  ['S7', '2022-04-18', '2022-04-19', 'oneworld'],
  ['QR', '2013-10-29', '2013-10-30', 'oneworld'],
] as const)(
  'monthly %s transition preserves independent source scoped counts',
  (airline, before, after, alliance) => {
    const rows = [
      row(1, airline, before),
      row(2, airline, after),
      row(3, airline, after.slice(0, 8) + String(Number(after.slice(8)) + 1).padStart(2, '0')),
      row(4, null, after),
    ]
    const grouped = aggregateRows(rows)
    expect(grouped).toHaveLength(3)
    expect(grouped.map((r) => r.date)).toEqual([before, after, after])
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
      expect(rows.filter((r) => matches(r, filter, refs)).map((r) => r.id)).toEqual(expectedIds)
      expect(
        grouped.filter((r) => matches(r, filter, refs)).reduce((sum, r) => sum + r.weight, 0),
      ).toBe(expectedIds.length)
    }
  },
)

it('aggregation normalizes invalid local times to missing and valid times to hour starts', () => {
  const rows = [null, NaN, Infinity, -1, 1439.5, 1440, 0, 1439].map((minute, i) => ({
    ...row(i + 1, null, '2025-01-03'),
    depMinute: minute,
    arrMinute: minute,
  }))
  const grouped = aggregateRows(rows)
  expect(grouped.map((r) => [r.depMinute, r.arrMinute, r.weight])).toEqual([
    [null, null, 6],
    [0, 0, 1],
    [1380, 1380, 1],
  ])
  expect(aggregateRows(grouped)).toEqual(grouped)
})

it('same-distance source witnesses retain the actual tie winner before aggregation loses its context', () => {
  const rows = [
    row(9, null, '2025-01-01'),
    { ...row(2, null, '2025-01-20'), flightNumber: 'ACTUAL', durationMinutes: 240 },
    { ...row(7, null, '2025-01-25'), depMinute: 430 },
  ]
  const grouped = aggregateRows(rows)
  expect(grouped).toHaveLength(1)
  expect(grouped[0]).toMatchObject({
    id: 2,
    date: '2025-01-01',
    weight: 3,
    distanceKm: 6000,
    durationMinutes: 600,
    flightNumber: null,
    depMinute: 420,
    recordExtrema: {
      longest: { flightId: 2, date: '2025-01-20', flightNumber: 'ACTUAL', durationMinutes: 240 },
      shortest: { flightId: 2, date: '2025-01-20' },
    },
    recordFlights: {
      latest: { flightId: 7, date: '2025-01-25', value: 2000 },
      earliestDeparture: { flightId: 2, date: '2025-01-20', depMinute: 425 },
    },
  })
  expect(aggregateRows([...rows].reverse())).toEqual(grouped)
  expect(aggregateRows(grouped)).toEqual(grouped)
})

it('precise samples survive lossy merging, reversal and reaggregation without changing grouping', () => {
  const rows = [30, 120, 90].map((durationMinutes, i) => ({
    ...row(i + 1, null, '2025-01-03'),
    durationMinutes,
  }))
  const grouped = aggregateRows(rows)
  expect(grouped).toHaveLength(1)
  expect(grouped[0]).toMatchObject({
    weight: 3,
    durationMinutes: 240,
    preciseDurationSamples: [30, 90, 120],
  })
  expect(aggregateRows([...rows].reverse())).toEqual(grouped)
  expect(aggregateRows(grouped)).toEqual(grouped)
  expect(rows.every((row) => !('preciseDurationSamples' in row))).toBe(true)
  const emptyEvidence = { ...rows[0], preciseDurationSamples: [] }
  expect(aggregateRows([emptyEvidence, rows[1]])[0].preciseDurationSamples).toEqual([120])
  expect(emptyEvidence.preciseDurationSamples).toEqual([])
  const malformedEvidence = { ...rows[0], preciseDurationSamples: [-1, NaN, Infinity] }
  expect(aggregateRows([malformedEvidence])[0].preciseDurationSamples).toBeUndefined()
  expect(
    aggregateRows([{ ...rows[0], durationSource: 'estimate', preciseDurationSamples: [30] }])[0]
      .preciseDurationSamples,
  ).toBeUndefined()
  const ineligible = [row(4, null, '2025-01-03')]
    .map((row) => ({ ...row, weight: 2 }))
    .concat([
      { ...row(5, null, '2025-01-03'), durationSource: 'estimate' as const },
      { ...row(6, null, '2025-01-03'), durationMinutes: -1 },
    ])
  expect(aggregateRows(ineligible).every((row) => !row.preciseDurationSamples)).toBe(true)
})

it('day aggregates retain inclusive range counts and precise weighted metrics within a month', () => {
  const rows = [
    row(1, null, '2024-02-28'),
    row(2, null, '2024-02-29'),
    row(3, null, '2024-02-29'),
    row(4, null, '2024-03-01'),
  ]
  const grouped = aggregateRows(rows, 'day')
  expect(
    grouped.map(({ date, weight, durationMinutes, preciseDurationSamples }) => ({
      date,
      weight,
      durationMinutes,
      preciseDurationSamples,
    })),
  ).toEqual([
    { date: '2024-02-28', weight: 1, durationMinutes: 180, preciseDurationSamples: [180] },
    { date: '2024-02-29', weight: 2, durationMinutes: 360, preciseDurationSamples: [180, 180] },
    { date: '2024-03-01', weight: 1, durationMinutes: 180, preciseDurationSamples: [180] },
  ])
  const selected = grouped.filter((r) =>
    matches(r, { period: { from: '2024-02-29', to: '2024-02-29' } }, refs),
  )
  expect(selected.reduce((sum, r) => sum + r.weight, 0)).toBe(2)
  expect(selected.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0)).toBe(4000)
  expect(aggregateRows(grouped, 'day')).toEqual(grouped)
  expect(aggregateRows(rows)).toHaveLength(2)
})
