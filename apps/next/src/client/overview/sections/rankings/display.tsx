'use client'

import { formatCount, formatNumber, type Locale } from '../../../../lib/format'
import { fill, forms, t } from '../../copy'
import { useOverview } from '../../store/overview-context'
import './below.css'

export const copy = (locale: Locale, en: string, ru: string) => t({ en, ru }, locale)
export const number = (locale: Locale, value: number) => formatNumber(locale, value)
export const flights = (locale: Locale, value: number) => formatCount(locale, value, forms.flights)
export const percent = (value: number) => `${Math.round(value * 100)}%`
export function CoverageNote({
  have,
  total,
  en,
  ru,
}: {
  have: number
  total: number
  en: string
  ru: string
}) {
  const { locale } = useOverview()
  if (have >= total) return null
  return (
    <p className="ov3-sample">
      {fill(copy(locale, en, ru), { n: number(locale, have), m: number(locale, total) })}
    </p>
  )
}
export const filterLabel = (locale: Locale) => copy(locale, 'Add filter', 'Добавить фильтр')

export const types = (locale: Locale, value: number) =>
  formatCount(locale, value, {
    en: { one: '{count} type', other: '{count} types' },
    ru: { one: '{count} тип', few: '{count} типа', many: '{count} типов', other: '{count} типа' },
  })
export const moreAirlines = (locale: Locale, value: number) =>
  formatCount(locale, value, {
    en: { one: 'Show {count} more airline', other: 'Show {count} more airlines' },
    ru: {
      one: 'Показать ещё {count} авиакомпанию',
      few: 'Показать ещё {count} авиакомпании',
      many: 'Показать ещё {count} авиакомпаний',
      other: 'Показать ещё {count} авиакомпании',
    },
  })
