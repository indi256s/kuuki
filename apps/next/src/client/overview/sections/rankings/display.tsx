'use client'

import type { Gate } from '@kuuki/shared/overview/figures'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { formatCount, formatNumber, type Locale } from '../../../../lib/format'
import { forms, t } from '../../copy'
import { Narrator } from '../../narrator/narrator'
import { useOverview } from '../../store/overview-context'
import { PayloadAircraftReview } from '../manufacturers/aircraft-review'

export const copy = (locale: Locale, en: string, ru: string) => t({ en, ru }, locale)
export const number = (locale: Locale, value: number) => formatNumber(locale, value)
export const flights = (locale: Locale, value: number) => formatCount(locale, value, forms.flights)
export const percent = (value: number) => `${Math.round(value * 100)}%`
export function Below({ id, gate, fix }: { id: SectionId; gate: Gate<unknown>; fix?: 'aircraft' | 'times' }) {
  const { locale, scope } = useOverview()
  if (gate.status !== 'below') return null
  const total = scope?.figures.flights ?? gate.have
  const need = formatCount(locale, gate.need, forms.flightsOf)
  const sentence = fix === 'times'
    ? copy(locale, `Needs departure times on at least ${number(locale, gate.need)} flights. ${number(locale, gate.have)} of ${number(locale, total)} have them.`, `Нужно время вылета минимум у ${need}. Указано у ${number(locale, gate.have)} из ${number(locale, total)}.`)
    : fix === 'aircraft'
      ? copy(locale, `Needs an aircraft on at least ${number(locale, gate.need)} flights. ${number(locale, gate.have)} of ${number(locale, total)} have one.`, `Нужен самолёт минимум у ${need}. Указан у ${number(locale, gate.have)} из ${number(locale, total)}.`)
      : null
  return <div className="ov3-below">{sentence === null ? <Narrator slot={id} /> : <p>{sentence}</p>}
    {fix === 'aircraft' && <PayloadAircraftReview />}
    {fix === 'times' && <a href="/journal">{copy(locale, 'Add times →', 'Указать время →')}</a>}
  </div>
}
export const filterLabel = (locale: Locale) => copy(locale, 'Add filter', 'Добавить фильтр')

export const types = (locale: Locale, value: number) => formatCount(locale, value, { en: { one: '{count} type', other: '{count} types' }, ru: { one: '{count} тип', few: '{count} типа', many: '{count} типов', other: '{count} типа' } })
export const yearsCount = (locale: Locale, value: number) => formatCount(locale, value, { en: { one: '{count} year', other: '{count} years' }, ru: { one: '{count} год', few: '{count} года', many: '{count} лет', other: '{count} года' } })
