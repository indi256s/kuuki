import type { Locale } from '../../lib/format'

const dayFormats = new Map<string, Intl.DateTimeFormat>()
export const dayFormat = (locale: Locale, month: 'long' | 'short' = 'short') => {
  const key = `${locale}:${month}`
  let format = dayFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: 'numeric', month, timeZone: 'UTC' })
    dayFormats.set(key, format)
  }
  return format
}

export const formatDay = (locale: Locale, date: string) =>
  dayFormat(locale).format(new Date(`${date}T12:00:00Z`))

export const formatMonthDay = (
  locale: Locale,
  monthDay: { month: number; day: number },
  month: 'long' | 'short' = 'long',
) => dayFormat(locale, month).format(new Date(Date.UTC(2000, monthDay.month - 1, monthDay.day, 12)))
