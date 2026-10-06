import { describe, expect, it } from 'vitest'
import { formatCount, formatDateOnly, formatDistanceKm, formatDuration, formatInstantDate, formatMonthYear, formatNumber, formatRelativeDate, pluralCategory, type CountForms } from './format'

const flights: CountForms = {
  en: { one: '{count} flight', other: '{count} flights' },
  ru: { one: '{count} перелёт', few: '{count} перелёта', many: '{count} перелётов', other: '{count} перелёта' },
}
const nbsp = ' '

describe('plurals', () => {
  it.each([[0, 'перелётов'], [1, 'перелёт'], [2, 'перелёта'], [5, 'перелётов'], [11, 'перелётов'], [21, 'перелёт'], [22, 'перелёта'], [25, 'перелётов']])(
    'ru %i -> %s', (n, word) => {
      expect(formatCount('ru', n, flights)).toBe(`${n} ${word}`)
    })

  it('picks one/few/many categories for Russian', () => {
    expect([1, 2, 5, 21].map(n => pluralCategory('ru', n))).toEqual(['one', 'few', 'many', 'one'])
  })

  it('uses one/other in English', () => {
    expect(formatCount('en', 0, flights)).toBe('0 flights')
    expect(formatCount('en', 1, flights)).toBe('1 flight')
    expect(formatCount('en', 2, flights)).toBe('2 flights')
  })

  it('groups the interpolated count by locale', () => {
    expect(formatCount('en', 1234, flights)).toBe('1,234 flights')
    expect(formatCount('ru', 1234, flights)).toBe(`1${nbsp}234 перелёта`)
  })
})

describe('numbers and units', () => {
  it('groups digits per locale', () => {
    expect(formatNumber('en', 141255)).toBe('141,255')
    expect(formatNumber('ru', 141255).replace(/\s/g, ' ')).toBe('141 255')
  })

  it('formats distance with a localized unit', () => {
    expect(formatDistanceKm('en', 141255).replace(nbsp, ' ')).toBe('141,255 km')
    expect(formatDistanceKm('ru', 141255).replace(/\s/g, ' ')).toBe('141 255 км')
  })

  it('formats durations', () => {
    expect(formatDuration('en', 125).replaceAll(nbsp, ' ')).toBe('2 h 5 min')
    expect(formatDuration('ru', 125).replaceAll(nbsp, ' ')).toBe('2 ч 5 мин')
    expect(formatDuration('en', 45).replaceAll(nbsp, ' ')).toBe('45 min')
    expect(formatDuration('ru', 120).replaceAll(nbsp, ' ')).toBe('2 ч')
    expect(formatDuration('en', 0).replaceAll(nbsp, ' ')).toBe('0 min')
  })
})

// Run under TZ=Pacific/Kiritimati (UTC+14) and TZ=Pacific/Pago_Pago (UTC-11) to prove the day never moves.
describe('date-only formatting', () => {
  it.each(['en', 'ru'] as const)('keeps the calendar day (%s)', locale => {
    expect(formatDateOnly(locale, '2026-01-01', 'padded')).toMatch(/\b01\b/)
    expect(formatDateOnly(locale, '2026-12-31', 'padded')).toMatch(/\b31\b/)
    expect(formatDateOnly(locale, '2026-01-01', 'short')).toBe(locale === 'ru' ? '01.01.2026' : '01/01/2026')
    expect(formatDateOnly(locale, '2026-12-31', 'short')).toBe(locale === 'ru' ? '31.12.2026' : '12/31/2026')
  })

  it('formats medium and long styles', () => {
    expect(formatDateOnly('en', '2026-01-01', 'medium')).toBe('Jan 1, 2026')
    expect(formatDateOnly('en', '2026-12-31', 'long')).toBe('December 31, 2026')
    expect(formatDateOnly('ru', '2026-12-31', 'long')).toBe('31 декабря 2026 г.')
  })

  it('returns unparseable input unchanged', () => {
    expect(formatDateOnly('en', 'soon')).toBe('soon')
  })

  it('rejects impossible dates instead of rolling them over', () => {
    for (const bad of ['2026-13-45', '2026-02-30', '2026-00-10', '2026-04-31']) expect(formatDateOnly('en', bad), bad).toBe(bad)
    expect(formatMonthYear('en', '2026-13-01')).toBe('2026-13-01')
    expect(formatDateOnly('en', '2028-02-29', 'medium')).toBe('Feb 29, 2028')
  })

  it('formats month and year from strings and dates without shifting the month', () => {
    expect(formatMonthYear('en', '2026-01-01')).toBe('January 2026')
    expect(formatMonthYear('en', '2026-12-31')).toBe('December 2026')
    expect(formatMonthYear('ru', '2026-10-15')).toBe('октябрь 2026 г.')
    expect(formatMonthYear('en', new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('December 2026')
  })
})

describe('formatRelativeDate', () => {
  const now = new Date(Date.UTC(2026, 9, 5, 23, 30)) // 5 Oct 2026, late evening UTC
  it.each([
    ['2026-10-05', 'today', 'сегодня'],
    ['2026-10-04', 'yesterday', 'вчера'],
    ['2026-10-01', '4 days ago', '4 дн. назад'],
    ['2026-09-20', '2 wk. ago', '2 нед. назад'],
    ['2026-09-05', '1 mo. ago', '1 мес. назад'],
    ['2026-08-01', '2 mo. ago', '2 мес. назад'],
    ['2025-10-06', '11 mo. ago', '11 мес. назад'],
    ['2025-10-05', '1 yr. ago', '1 г. назад'],
    ['2021-01-01', '5 yr. ago', '5 л. назад'],
  ])('%s -> %s / %s', (value, en, ru) => {
    expect(formatRelativeDate('en', value, now)).toBe(en)
    expect(formatRelativeDate('ru', value, now)).toBe(ru)
  })
  it('never reports a future date and returns invalid input unchanged', () => {
    expect(formatRelativeDate('en', '2026-12-01', now)).toBe('today')
    expect(formatRelativeDate('en', 'soon', now)).toBe('soon')
  })
})

describe('formatInstantDate', () => {
  it('names the viewer-zone day of an instant', () => {
    expect(formatInstantDate('en', '2026-11-04T00:30:00.000Z', 'medium', 'UTC')).toBe('Nov 4, 2026')
    expect(formatInstantDate('en', '2026-11-04T00:30:00.000Z', 'medium', 'America/New_York')).toBe('Nov 3, 2026')
    expect(formatInstantDate('ru', '2026-11-04T12:00:00.000Z', 'long', 'UTC')).toBe('4 ноября 2026 г.')
  })
  it('returns an invalid instant unchanged', () => {
    expect(formatInstantDate('en', 'later')).toBe('later')
  })
})
