// Locale-aware formatting shared by server components and client islands. Pure: no DOM, no server-only imports.
// The locale is always the UI language (request locale), never the runtime's default.

export type Locale = 'en' | 'ru'
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
export type CountForms = {
  en: { one: string; other: string }
  ru: { one: string; few: string; many: string; other: string }
}
/** `long` 5 January 2026 · `medium` 5 Jan 2026 · `padded` 05 Jan 2026 (aligned lists) · `short` 05.01.2026 / 01/05/2026 */
export type DateStyle = 'long' | 'medium' | 'padded' | 'short'

const NBSP = ' '

export function pluralCategory(locale: Locale, n: number): PluralCategory {
  return new Intl.PluralRules(locale).select(n) as PluralCategory
}

export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(locale).format(n)
}

/** Picks the plural form for `n` and fills `{count}` with the locale-grouped number. */
export function formatCount(locale: Locale, n: number, forms: CountForms): string {
  const set: Record<string, string> = forms[locale]
  const form = set[pluralCategory(locale, n)] ?? set.other
  return form.replaceAll('{count}', formatNumber(locale, n))
}

/** "141 255 км" / "141,255 km"; the unit is joined with a no-break space so it never wraps alone. */
export function formatDistanceKm(locale: Locale, km: number): string {
  return `${formatNumber(locale, km)}${NBSP}${locale === 'ru' ? 'км' : 'km'}`
}

const dateOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  padded: { day: '2-digit', month: 'short', year: 'numeric' },
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

// Calendar dates (flight days) carry no time zone. Build the instant from the parsed
// components in UTC and format in UTC so no runtime offset can move the day.
function utcFromDateOnly(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1), 12))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Formats a 'YYYY-MM-DD' calendar date without ever shifting the day. Returns the input if unparseable. */
export function formatDateOnly(locale: Locale, value: string, style: DateStyle = 'medium'): string {
  const date = utcFromDateOnly(value)
  return date ? new Intl.DateTimeFormat(locale, { ...dateOptions[style], timeZone: 'UTC' }).format(date) : value
}

/**
 * Month and year, e.g. "October 2026" / «октябрь 2026 г.» (Intl's standalone nominative form for Russian).
 * Accepts a Date (read in UTC) or a 'YYYY-MM[-DD]' string (never shifted).
 */
export function formatMonthYear(locale: Locale, value: Date | string, month: 'long' | 'short' = 'long'): string {
  const date = typeof value === 'string' ? utcFromDateOnly(value) : value
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale, { month, year: 'numeric', timeZone: 'UTC' }).format(date)
    : String(value)
}

/** "2 h 5 min" / "2 ч 5 мин"; whole minutes, hours omitted below 60 and minutes omitted on the hour. */
export function formatDuration(locale: Locale, minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60), m = total % 60
  const hUnit = locale === 'ru' ? 'ч' : 'h', mUnit = locale === 'ru' ? 'мин' : 'min'
  const parts: string[] = []
  if (h) parts.push(`${formatNumber(locale, h)}${NBSP}${hUnit}`)
  if (m || !h) parts.push(`${formatNumber(locale, m)}${NBSP}${mUnit}`)
  return parts.join(' ')
}
