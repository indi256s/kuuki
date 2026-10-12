// What each hero record's figure draws, picked from the scope. Pure, so the card, the takeover and the tests share one answer.
import { rowCountries, matches } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { formatNumber, type Locale } from '../../../lib/format'
import type { HeroRecord } from '../narrator/triggers'

export const HERO_RECORDS: readonly HeroRecord[] = ['flights', 'km', 'air', 'countries', 'airports']

/** The spike's stack: 3, 5, 8 or 12 stubs under the lit one, for under 25, 75 and 200 flights, and 200 or more. */
export function stubBucket(flights: number): 3 | 5 | 8 | 12 {
  return flights < 25 ? 3 : flights < 75 ? 5 : flights < 200 ? 8 : 12
}

/** The odometer's drums: whole kilometres, at most eight drums, so a total past them pins at 99,999,999 like a real counter. */
export function odometerDigits(km: number): string {
  return String(Math.min(99_999_999, Math.max(0, Math.round(km))))
}

/** Up to four stickers: the most-used airport of each of the most-visited countries, oldest first, the newest country always among them
 * (in place of the fourth when it is not). Visits and dates come from the scoped rows, so a filter re-picks them. */
export function pickStickers(
  payload: OverviewPayload,
  filter: OverviewFilter,
  scope: OverviewScope,
): { stickers: string[]; lit: number | null } {
  const rows = payload.rows.filter(
    (row) =>
      (row.state === 'logged' || row.state === 'awaiting') && matches(row, filter, payload.refs),
  )
  const first = new Map<string, string>()
  for (const row of rows)
    for (const country of rowCountries(row, payload.refs)) {
      const seen = first.get(country)
      if (seen === undefined || row.date < seen) first.set(country, row.date)
    }
  // The globe ranks countries by visits and airports by use, ties by code; each country's sticker is its first airport in that order.
  const airport = new Map<string, string>()
  for (const { iata } of scope.globe.airports) {
    const country = payload.refs.airports[iata]?.country
    if (country && !airport.has(country)) airport.set(country, iata)
  }
  const ranked = scope.globe.countries.map(({ code }) => code).filter((code) => airport.has(code))
  if (!ranked.length) return { stickers: [], lit: null }
  const newest = ranked.reduce((a, b) => {
    const da = first.get(a) ?? '',
      db = first.get(b) ?? ''
    return db > da || (db === da && b < a) ? b : a
  })
  const chosen = ranked.slice(0, 4)
  if (!chosen.includes(newest)) chosen[3] = newest
  chosen.sort((a, b) => {
    const da = first.get(a) ?? '',
      db = first.get(b) ?? ''
    return da < db ? -1 : da > db ? 1 : a < b ? -1 : 1
  })
  return { stickers: chosen.map((code) => airport.get(code)!), lit: chosen.indexOf(newest) }
}

/** The carousel tag: the scope's most-used airport (both ends of every flight counted), or null with no flights. */
export function tagCode(scope: OverviewScope): string | null {
  return scope.globe.airports[0]?.iata ?? null
}

const compactForms = {
  en: { thousand: 'k', million: 'M', hour: 'h' },
  ru: { thousand: ' тыс.', million: ' млн', hour: ' ч' },
}

/** A count short enough for the 64px index rail: 69 · 1.2k · 141k · 1.4M (RU 1,2 тыс. · 141 тыс. · 1,4 млн). Floored, never rounded up. */
export function compactNumber(locale: Locale, n: number): string {
  const forms = compactForms[locale]
  const one = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.floor(value * 10) / 10)
  if (n < 1000) return formatNumber(locale, Math.floor(n))
  if (n < 10_000) return one(n / 1000) + forms.thousand
  if (n < 1_000_000) return formatNumber(locale, Math.floor(n / 1000)) + forms.thousand
  return one(n / 1_000_000) + forms.million
}

/** The rail's value for each record, compact and floored: "69", "141k", "216h" (RU "141 тыс.", "216 ч"). */
export function railValue(
  locale: Locale,
  record: HeroRecord,
  figures: OverviewScope['figures'],
): string {
  switch (record) {
    case 'flights':
      return compactNumber(locale, figures.flights)
    case 'km':
      return compactNumber(locale, figures.distanceKm)
    case 'air': {
      const hours = Math.floor(figures.durationMinutes / 60)
      // "216h", but "1.2k h": a unit glued to a suffix would read as one word.
      return (
        compactNumber(locale, hours) +
        (locale === 'en' && hours >= 1000 ? '\u00a0h' : compactForms[locale].hour)
      )
    }
    case 'countries':
      return compactNumber(locale, figures.countries.value)
    case 'airports':
      return compactNumber(locale, figures.airports)
  }
}
