import { formatMonthYear, type Locale } from '../../lib/format'

/** Stamps pressed on the strip before the rest collapse into "+N" (spec: about eight). */
export const STAMP_LIMIT = 8

export type ProfileStamp = {
  code: string
  /** `MM·YY` of the last visit; owner only. */
  date: string | null
  /** "Norway, September 2026" for the owner, "Norway" for visitors. */
  name: string
}

const regionNames = new Map<Locale, Intl.DisplayNames | null>()
export function countryName(code: string, locale: Locale) {
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }))
    } catch {
      regionNames.set(locale, null)
    }
  }
  try {
    return regionNames.get(locale)?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/**
 * The stamp strip. The owner reads their own dates, latest first. Visitors get codes only, ordered by country name, so
 * the strip reveals neither when nor how often (the public route set already names the countries).
 */
export function profileStamps(
  source:
    | { kind: 'owner'; stamps: { code: string; lastVisit: string | null }[] }
    | { kind: 'visitor'; countries: string[] },
  locale: Locale,
  limit = STAMP_LIMIT,
): { stamps: ProfileStamp[]; more: number; total: number } {
  const all: ProfileStamp[] =
    source.kind === 'owner'
      ? source.stamps.map(({ code, lastVisit }) => {
          const month = lastVisit && /^\d{4}-\d{2}/.test(lastVisit) ? lastVisit.slice(0, 7) : null
          return {
            code,
            date: month ? `${month.slice(5, 7)}·${month.slice(2, 4)}` : null,
            name: month
              ? `${countryName(code, locale)}, ${formatMonthYear(locale, month)}`
              : countryName(code, locale),
          }
        })
      : source.countries
          .map((code) => ({ code, date: null, name: countryName(code, locale) }))
          .sort((a, b) => a.name.localeCompare(b.name, locale))
  return { stamps: all.slice(0, limit), more: Math.max(0, all.length - limit), total: all.length }
}
