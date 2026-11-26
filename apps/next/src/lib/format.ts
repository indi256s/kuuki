import { dayToEpoch } from '@kuuki/shared/overview/range'

export type Locale = 'en' | 'ru'
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
export type CountForms = {
  en: { one: string; other: string }
  ru: { one: string; few: string; many: string; other: string }
}
export type DateStyle = 'long' | 'medium' | 'padded' | 'short'

const NBSP = ' '
const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {}
const numberFormats: Partial<Record<Locale, Intl.NumberFormat>> = {}
const dateFormats: Partial<Record<Locale, Partial<Record<DateStyle, Intl.DateTimeFormat>>>> = {}
const monthFormats: Partial<
  Record<Locale, Partial<Record<'long' | 'short', Intl.DateTimeFormat>>>
> = {}

export function pluralCategory(locale: Locale, n: number): PluralCategory {
  return (pluralRules[locale] ??= new Intl.PluralRules(locale)).select(n) as PluralCategory
}

const monthNameFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}
export function monthName(locale: Locale, month: number): string {
  const date = new Date(Date.UTC(2001, month - 1, 1))
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? (monthNameFormats[locale] ??= new Intl.DateTimeFormat(locale, {
        month: 'long',
        timeZone: 'UTC',
      })).format(date)
    : String(month)
}

export function formatNumber(locale: Locale, n: number): string {
  return (numberFormats[locale] ??= new Intl.NumberFormat(locale)).format(n)
}

export function formatCount(locale: Locale, n: number, forms: CountForms): string {
  const set: Record<string, string> = forms[locale]
  const form = set[pluralCategory(locale, n)] ?? set.other
  return form.replaceAll('{count}', formatNumber(locale, n))
}

export function formatDistanceKm(locale: Locale, km: number): string {
  return `${formatNumber(locale, km)}${NBSP}${locale === 'ru' ? 'км' : 'km'}`
}

const dateOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  padded: { day: '2-digit', month: 'short', year: 'numeric' },
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

function utcFromDateOnly(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return null
  const epoch = dayToEpoch(`${m[1]}-${m[2]}-${m[3] ?? '01'}`)
  return epoch === null ? null : new Date(epoch + 12 * 3_600_000)
}

export function formatDateOnly(locale: Locale, value: string, style: DateStyle = 'medium'): string {
  const date = utcFromDateOnly(value)
  if (!date) return value
  if (style === 'short') {
    const year = String(date.getUTCFullYear()).padStart(4, '0'),
      month = String(date.getUTCMonth() + 1).padStart(2, '0'),
      day = String(date.getUTCDate()).padStart(2, '0')
    return locale === 'ru' ? `${day}.${month}.${year}` : `${month}/${day}/${year}`
  }
  const formats = (dateFormats[locale] ??= {})
  return (formats[style] ??= new Intl.DateTimeFormat(locale, {
    ...dateOptions[style],
    timeZone: 'UTC',
  }))
    .formatToParts(date)
    .map((part) => (part.type === 'year' ? String(date.getUTCFullYear()) : part.value))
    .join('')
    .replaceAll('\u202f', ' ')
}

export function formatInstantDate(
  locale: Locale,
  value: string,
  style: DateStyle = 'medium',
  timeZone?: string,
): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        ...dateOptions[style],
        ...(timeZone ? { timeZone } : {}),
      }).format(date)
}

export function formatMonthYear(
  locale: Locale,
  value: Date | string,
  month: 'long' | 'short' = 'long',
): string {
  const date = typeof value === 'string' ? utcFromDateOnly(value) : value
  const formats = (monthFormats[locale] ??= {})
  return date && !Number.isNaN(date.getTime())
    ? (formats[month] ??= new Intl.DateTimeFormat(locale, {
        month,
        year: 'numeric',
        timeZone: 'UTC',
      }))
        .formatToParts(date)
        .map((part) => (part.type === 'year' ? String(date.getUTCFullYear()) : part.value))
        .join('')
        .replaceAll('\u202f', ' ')
    : String(value)
}

export function formatDuration(locale: Locale, minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60),
    m = total % 60
  const hUnit = locale === 'ru' ? 'ч' : 'h',
    mUnit = locale === 'ru' ? 'мин' : 'min'
  const parts: string[] = []
  if (h) parts.push(`${formatNumber(locale, h)}${NBSP}${hUnit}`)
  if (m || !h) parts.push(`${formatNumber(locale, m)}${NBSP}${mUnit}`)
  return parts.join(' ')
}

export function formatDurationDays(locale: Locale, minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes / 60)) : 0
  const days = Math.floor(total / 24),
    hours = total % 24
  const hour = `${formatNumber(locale, hours)}${NBSP}${locale === 'ru' ? 'ч' : 'h'}`
  return days ? `${formatNumber(locale, days)}${NBSP}${locale === 'ru' ? 'д' : 'd'} ${hour}` : hour
}

export function formatRelativeDate(locale: Locale, value: string, now = new Date()): string {
  const date = utcFromDateOnly(value)
  if (!date) return value
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  const days = Math.max(0, Math.round((today - date.getTime()) / 86_400_000))
  if (days < 7)
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(
      -days,
      'day',
    )
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' })
  if (days < 30) return format.format(-Math.floor(days / 7), 'week')
  const months =
    (now.getUTCFullYear() - date.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    date.getUTCMonth() -
    (now.getUTCDate() < date.getUTCDate() ? 1 : 0)
  return months < 12
    ? format.format(-Math.max(1, months), 'month')
    : format.format(-Math.floor(months / 12), 'year')
}

export function formatPeriodDate(locale: Locale, value: string): string {
  return value.length === 10 ? formatDateOnly(locale, value) : formatMonthYear(locale, value)
}
