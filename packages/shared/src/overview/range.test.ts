import { expect, it } from 'vitest'
import { DAY_MS, dayToEpoch, epochToDay, periodDays } from './range'

it('UTC day conversions validate the calendar without shifting years 0–99', () => {
  for (const day of [
    '0000-02-29',
    '0001-01-01',
    '0099-12-31',
    '2024-02-29',
    '2026-03-29',
    '9999-12-31',
  ]) {
    expect(epochToDay(dayToEpoch(day)!)).toBe(day)
  }
  for (const day of [
    '0001-02-29',
    '1900-02-29',
    '2025-02-29',
    '2026-04-31',
    '2026-00-01',
    '2026-01-00',
    '2026-1-01',
  ]) {
    expect(dayToEpoch(day)).toBeNull()
  }
  expect(dayToEpoch('2026-03-30')! - dayToEpoch('2026-03-29')!).toBe(DAY_MS)
  expect(epochToDay(dayToEpoch('0000-01-01')! - DAY_MS)).toBeNull()
  expect(epochToDay(NaN)).toBeNull()
  expect(periodDays({ from: '2024-02', to: '2024-02' })).toEqual({
    from: '2024-02-01',
    to: '2024-02-29',
  })
  expect(periodDays({ from: '0099-02', to: '0099-02' })).toEqual({
    from: '0099-02-01',
    to: '0099-02-28',
  })
  expect(periodDays({ from: '2026-03', to: '2026-03-31' })).toBeNull()
})
