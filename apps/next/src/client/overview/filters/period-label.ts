import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { periodDays } from '@kuuki/shared/overview/range'
import { formatDateOnly, type Locale } from '../../../lib/format'

/** `12.03` / `03/12`, with a two-digit year when asked. */
function compactDay(locale: Locale, day: string, year: boolean): string {
  const [y, m, d] = day.split('-')
  const short = y.slice(2)
  return locale === 'ru'
    ? `${d}.${m}${year ? `.${short}` : ''}`
    : `${m}/${d}${year ? `/${short}` : ''}`
}

/** The period as its button names it: All time, 2024, 2022–2024, 2019, 2022, or a compact day range that fits half a phone row. */
export function periodLabel(period: OverviewFilter['period'], locale: Locale): string {
  const all = locale === 'ru' ? 'Всё время' : 'All time'
  if (!period) return all
  if ('years' in period) {
    const years = [...new Set(period.years)].sort((a, b) => a - b)
    if (!years.length) return all
    const first = years[0],
      last = years.at(-1)!
    if (years.length === 1) return String(first)
    if (last - first === years.length - 1) return `${first}–${last}`
    return years.length === 2 ? `${first}, ${last}` : `${first}, ${years[1]} +${years.length - 2}`
  }
  const days = periodDays(period)
  if (!days) return all
  const sameYear = days.from.slice(0, 4) === days.to.slice(0, 4)
  return `${compactDay(locale, days.from, !sameYear)}–${compactDay(locale, days.to, true)}`
}

/** The period in full for the button's accessible name, with the dates spelled out. */
export function periodName(period: OverviewFilter['period'], locale: Locale): string {
  const prefix = locale === 'ru' ? 'Период' : 'Period'
  const days = period && 'from' in period ? periodDays(period) : null
  return days
    ? `${prefix}: ${formatDateOnly(locale, days.from)} – ${formatDateOnly(locale, days.to)}`
    : `${prefix}: ${periodLabel(period, locale)}`
}
