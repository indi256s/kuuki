import type { FacetKey } from '@kuuki/shared/overview/model'
import type { Locale } from '../../../lib/format'
import type { OverviewLabels } from '../labels'
import { scopeTitle } from '../page/scope-title'

export type FilterFacet = FacetKey | 'period'
const NAMES: Record<FilterFacet, { en: string; ru: string }> = {
  period: { en: 'Period', ru: 'Период' }, countries: { en: 'Country', ru: 'Страна' },
  airports: { en: 'Airport', ru: 'Аэропорт' }, airlines: { en: 'Airline', ru: 'Авиакомпания' },
  alliances: { en: 'Alliance', ru: 'Альянс' }, routes: { en: 'Route', ru: 'Маршрут' },
  aircraft: { en: 'Aircraft', ru: 'Самолёт' }, families: { en: 'Family', ru: 'Семейство' },
  makers: { en: 'Manufacturer', ru: 'Производитель' }, bodies: { en: 'Body type', ru: 'Тип фюзеляжа' },
  haul: { en: 'Haul', ru: 'Дальность' }, domestic: { en: 'Domestic / international', ru: 'Внутренние / международные' },
  departureBands: { en: 'Departure time', ru: 'Время вылета' }, depHours: { en: 'Departure hour', ru: 'Час вылета' },
  arrHours: { en: 'Arrival hour', ru: 'Час прилёта' }, regions: { en: 'Region', ru: 'Регион' },
}
export const facetName = (facet: FilterFacet, locale: Locale): string => NAMES[facet][locale]
export function facetValueLabel(facet: FilterFacet, value: string | number, labels: OverviewLabels, locale: Locale): string {
  return facet === 'period' ? String(value) : scopeTitle({ [facet]: [value] }, labels, locale).slice(3)
}
export function chipLabel(facet: FilterFacet, values: readonly (string | number)[], labels: OverviewLabels, locale: Locale) {
  return { name: facetName(facet, locale), values: values.slice(0, 2).map(value => facetValueLabel(facet, value, labels, locale)).join(', '), more: Math.max(0, values.length - 2) }
}
