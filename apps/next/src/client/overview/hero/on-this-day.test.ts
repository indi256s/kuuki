import { expect, it } from 'vitest'
import type { OverviewRow } from '@kuuki/shared/overview/model'
import { localDay, onThisDay } from './on-this-day'

const row = (id: number, date: string, state: OverviewRow['state'] = 'logged') =>
  ({ id, date, state, origin: 'TBS', destination: 'DOH' }) as OverviewRow

it('picks the most recent earlier year on the same month-day and counts the rest of that day', () => {
  const rows = [
    row(1, '2021-10-09'),
    row(2, '2023-10-09'),
    row(4, '2023-10-09'),
    row(3, '2023-10-10'),
    row(5, '2024-10-09', 'awaiting'),
    row(6, '2026-10-09'),
    row(7, '2027-10-09'),
  ]
  expect(onThisDay(rows, '2026-10-09')).toEqual({
    year: '2023',
    flightId: 2,
    origin: 'TBS',
    destination: 'DOH',
    more: 1,
  })
  expect(onThisDay([row(1, '2026-10-09')], '2026-10-09')).toBeNull()
})
it('remembers 29 February only in leap years and ignores monthly dates', () => {
  expect(onThisDay([row(1, '2020-02-29')], '2026-02-28')).toBeNull()
  expect(onThisDay([row(1, '2020-02-29')], '2028-02-29')?.year).toBe('2020')
  expect(onThisDay([row(1, '2023-10')], '2026-10-09')).toBeNull()
  expect(localDay(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
})
