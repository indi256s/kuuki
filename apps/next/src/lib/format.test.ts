import { expect, it, vi } from 'vitest'

it('reuses formatters while keeping locale, date style and changing values distinct', async () => {
  const number = vi.spyOn(Intl, 'NumberFormat')
  const plural = vi.spyOn(Intl, 'PluralRules')
  const date = vi.spyOn(Intl, 'DateTimeFormat')
  const { formatNumber, pluralCategory, formatDateOnly, formatMonthYear } = await import('./format')
  try {
    expect(formatNumber('en', 12345)).toBe('12,345')
    expect(formatNumber('ru', 12345)).toBe('12\u00a0345')
    expect(pluralCategory('en', 1)).toBe('one')
    expect(pluralCategory('ru', 2)).toBe('few')
    expect(formatDateOnly('en', '2026-01-05', 'long')).toBe('January 5, 2026')
    expect(formatDateOnly('en', '2026-01-05', 'padded')).toBe('Jan 05, 2026')
    expect(formatDateOnly('ru', '2026-01-05', 'long')).toBe('5 января 2026 г.')
    expect(formatMonthYear('en', '2026-01', 'long')).toBe('January 2026')
    expect(formatMonthYear('en', '2026-01', 'short')).toBe('Jan 2026')
    expect(formatMonthYear('ru', '2026-01', 'long')).toBe('январь 2026 г.')
    const calls = [number.mock.calls.length, plural.mock.calls.length, date.mock.calls.length]
    expect(formatNumber('en', 54321)).toBe('54,321')
    expect(formatNumber('ru', 54321)).toBe('54\u00a0321')
    expect(pluralCategory('en', 2)).toBe('other')
    expect(pluralCategory('ru', 5)).toBe('many')
    expect(formatDateOnly('en', '2027-02-06', 'long')).toBe('February 6, 2027')
    expect(formatDateOnly('en', '2027-02-06', 'padded')).toBe('Feb 06, 2027')
    expect(formatDateOnly('ru', '2027-02-06', 'long')).toBe('6 февраля 2027 г.')
    expect(formatMonthYear('en', '2027-02', 'long')).toBe('February 2027')
    expect(formatMonthYear('en', '2027-02', 'short')).toBe('Feb 2027')
    expect(formatMonthYear('ru', '2027-02', 'long')).toBe('февраль 2027 г.')
    expect([number.mock.calls.length, plural.mock.calls.length, date.mock.calls.length]).toEqual(
      calls,
    )
  } finally {
    vi.restoreAllMocks()
  }
})
