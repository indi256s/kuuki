'use client'

import { formatCount, formatNumber, type Locale } from '../../../../lib/format'
import { forms, t } from '../../copy'
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
  const fill = (text: string) =>
    text.replace('{n}', number(locale, have)).replace('{m}', number(locale, total))
  return <p className="ov3-sample">{copy(locale, fill(en), fill(ru))}</p>
}
// Dots up to 12 needed flights, a thin bar beyond. Decorative children; the meter role carries the value.
export function UnlockMeter({ have, need, label }: { have: number; need: number; label: string }) {
  if (!(need > 0)) return null
  const value = Math.max(0, Math.min(have, need))
  return (
    <div
      className="ov3-unlock"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={need}
      aria-valuenow={value}
      aria-label={label}
    >
      {need <= 12 ? (
        Array.from({ length: need }, (_, index) => (
          <i key={index} className={index < value ? 'on' : undefined} aria-hidden="true" />
        ))
      ) : (
        <b style={{ inlineSize: `${(value / need) * 100}%` }} aria-hidden="true" />
      )}
    </div>
  )
}
export const filterLabel = (locale: Locale) => copy(locale, 'Add filter', 'Добавить фильтр')

export const types = (locale: Locale, value: number) =>
  formatCount(locale, value, {
    en: { one: '{count} type', other: '{count} types' },
    ru: { one: '{count} тип', few: '{count} типа', many: '{count} типов', other: '{count} типа' },
  })
export const yearsCount = (locale: Locale, value: number) =>
  formatCount(locale, value, {
    en: { one: '{count} year', other: '{count} years' },
    ru: { one: '{count} год', few: '{count} года', many: '{count} лет', other: '{count} года' },
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
