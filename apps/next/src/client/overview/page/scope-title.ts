import { MAKER_NAMES } from '@kuuki/data/aircraft-makers'
import type { FacetKey, OverviewFilter } from '@kuuki/shared/overview/model'
import { formatPeriodDate, formatNumber, type Locale } from '../../../lib/format'
import { REGION_LABELS } from '../../passport/model'
import type { OverviewLabels } from '../labels'
import { S, t } from '../copy'

export type ScopeLabels = OverviewLabels
const monthFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}
/** Standalone month name for 1–12: "March" / «март». */
export function monthName(locale: Locale, month: number): string {
  const date = new Date(Date.UTC(2001, month - 1, 1))
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? (monthFormats[locale] ??= new Intl.DateTimeFormat(locale, {
        month: 'long',
        timeZone: 'UTC',
      })).format(date)
    : String(month)
}
// Facets without reference entities use the canonical domain ids, with paired display copy.
const VALUES: Partial<Record<FacetKey, Record<string, { en: string; ru: string }>>> = {
  regions: REGION_LABELS,
  alliances: {
    star: { en: 'Star Alliance', ru: 'Star Alliance' },
    oneworld: { en: 'oneworld', ru: 'oneworld' },
    skyteam: { en: 'SkyTeam', ru: 'SkyTeam' },
  },
  makers: {
    ...Object.fromEntries(
      Object.entries(MAKER_NAMES).map(([key, name]) => [key, { en: name, ru: name }]),
    ),
    other: { en: 'Other', ru: 'Другие' },
    unknown: { en: 'Unknown', ru: 'Неизвестно' },
  },
  bodies: {
    narrow: { en: 'Narrow-body', ru: 'Узкофюзеляжные' },
    wide: { en: 'Wide-body', ru: 'Широкофюзеляжные' },
  },
  haul: {
    short: { en: 'Short haul', ru: 'Короткие рейсы' },
    medium: { en: 'Medium haul', ru: 'Средние рейсы' },
    long: { en: 'Long haul', ru: 'Дальние рейсы' },
  },
  domestic: {
    domestic: { en: 'Domestic', ru: 'Внутренние' },
    international: { en: 'International', ru: 'Международные' },
  },
  departureBands: {
    night: { en: 'Night', ru: 'Ночь' },
    morning: { en: 'Morning', ru: 'Утро' },
    afternoon: { en: 'Afternoon', ru: 'День' },
    evening: { en: 'Evening', ru: 'Вечер' },
  },
}
function valueLabel(
  facet: FacetKey,
  value: string | number,
  labels: ScopeLabels,
  locale: Locale,
): string {
  const code = String(value)
  switch (facet) {
    case 'countries':
      return labels.country(code)
    case 'airlines':
      return labels.airline(code)
    case 'aircraft':
      return labels.aircraft(code)
    case 'airports':
      return labels.airport(code)
    case 'depHours':
    case 'arrHours':
      return `${formatNumber(locale, Number(value)).padStart(2, '0')}:00`
    case 'months':
      return monthName(locale, Number(value))
    default:
      return VALUES[facet]?.[code]?.[locale] ?? code
  }
}
export function scopeTitle(filter: OverviewFilter, labels: ScopeLabels, locale: Locale): string {
  const selections: string[] = []
  for (const key of Object.keys(filter) as Array<keyof OverviewFilter>) {
    const selected = filter[key]
    if (!selected || key === 'scope') continue
    if (key === 'period') {
      const period = filter.period!
      if ('years' in period) {
        if (period.years.length)
          selections.push(`${t(S.period, locale)} ${period.years.map(String).join(', ')}`)
      } else
        selections.push(
          `${t(S.period, locale)} ${formatPeriodDate(locale, period.from)} – ${formatPeriodDate(locale, period.to)}`,
        )
    } else if (Array.isArray(selected)) {
      for (const value of selected) selections.push(valueLabel(key, value, labels, locale))
    }
  }
  return selections.length
    ? ` · ${selections.slice(0, 2).join(', ')}${selections.length > 2 ? ` +${formatNumber(locale, selections.length - 2)}` : ''}`
    : ''
}
