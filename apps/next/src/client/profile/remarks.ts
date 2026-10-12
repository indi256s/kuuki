// The holder page's owner-only "Remarks" line (spec: narrator, profile bank). One deterministic line per owner and
// trigger, picked from three EN/RU variants (glados-copy: triples, numbers only from params, RU «вы» and plural-safe
// label forms). Visitors never see it, so it may tease the owner about their own journal.
import { formatNumber, type Locale } from '../../lib/format'
import { fill, t } from '../overview/copy'
import type { Line } from '../overview/narrator/corpus'
import { fnv1a32 } from '../overview/narrator/pick'

export type RemarksTrigger =
  | 'zero'
  | 'few'
  | 'airborne'
  | 'countries'
  | 'airlines'
  | 'redEye'
  | 'steady'

/** Fits two lines on the 400px holder page (328px measure, 15px Commissioner). */
export const REMARKS_MAX = 88

export const REMARKS_CORPUS: Record<RemarksTrigger, [Line, Line, Line]> = {
  zero: [
    {
      en: 'Nothing logged yet. The passport is in mint condition.',
      ru: 'Пока ничего не записано. Паспорт в идеальном состоянии.',
    },
    {
      en: 'No flights on record. Visitors see a very tidy page.',
      ru: 'Перелётов в журнале нет. Посетители видят очень аккуратную страницу.',
    },
    {
      en: 'No flights yet. A spotless record, technically.',
      ru: 'Перелётов пока нет. Формально репутация безупречна.',
    },
  ],
  few: [
    {
      en: 'Flights so far: {flights}. The cabinet is mostly shelf.',
      ru: 'Перелётов пока: {flights}. Витрина состоит в основном из полок.',
    },
    {
      en: 'Flights on record: {flights}. Early days, but the page is paying attention.',
      ru: 'Перелётов в журнале: {flights}. Начало положено, страница следит.',
    },
    {
      en: 'Flights: {flights}. Visitors will assume you are pacing yourself.',
      ru: 'Перелётов: {flights}. Посетители решат, что вы бережёте силы.',
    },
  ],
  airborne: [
    {
      en: '{days} days airborne. Your seat has seen more of the world than you have.',
      ru: '{days} сут. в воздухе. Ваше кресло повидало больше, чем вы.',
    },
    {
      en: '{days} days airborne, a good part of it waiting for the trolley.',
      ru: '{days} сут. в воздухе. Значительная часть — в ожидании тележки.',
    },
    {
      en: '{days} days aloft. Cabin crew could list you as a fixture.',
      ru: 'В воздухе — {days} сут. Экипаж может вносить вас в опись салона.',
    },
  ],
  countries: [
    {
      en: '{countries} countries stamped. Border officers know the handwriting.',
      ru: 'Стран в паспорте: {countries}. Пограничники узнают почерк.',
    },
    {
      en: '{countries} countries. The passport is doing the heavy lifting.',
      ru: 'Стран: {countries}. Основную нагрузку несёт паспорт.',
    },
    {
      en: '{countries} countries so far. The ink budget is under review.',
      ru: 'Стран на сегодня: {countries}. Расход чернил передан комиссии.',
    },
  ],
  airlines: [
    {
      en: '{airlines} airlines so far. Loyalty programmes remain unconvinced.',
      ru: 'Авиакомпаний: {airlines}. Программы лояльности пока не убеждены.',
    },
    {
      en: '{airlines} airlines on record. None of them knows about the others.',
      ru: 'Авиакомпаний в журнале: {airlines}. Друг о друге они не знают.',
    },
    {
      en: '{airlines} airlines tried. The search for a favourite continues.',
      ru: 'Опробовано авиакомпаний: {airlines}. Поиски любимой продолжаются.',
    },
  ],
  redEye: [
    {
      en: 'A pre-dawn departure is on record. Sleep was treated as optional.',
      ru: 'В журнале есть вылет до рассвета. Сон признан необязательным.',
    },
    {
      en: 'At least one departure before five. The airport coffee remembers you.',
      ru: 'Как минимум один вылет до пяти утра. Кофе в аэропорту вас помнит.',
    },
    {
      en: 'Pre-dawn flights: confirmed. Your body clock has filed a complaint.',
      ru: 'Вылеты до рассвета: подтверждено. Биологические часы подали жалобу.',
    },
  ],
  steady: [
    {
      en: 'Flights on record: {flights}. Steady, if unspectacular.',
      ru: 'Перелётов в журнале: {flights}. Стабильно, без лишнего блеска.',
    },
    {
      en: 'Flights: {flights}. The journal has no complaints.',
      ru: 'Перелётов: {flights}. Замечаний у журнала нет.',
    },
    {
      en: 'Flights logged: {flights}. Nothing dramatic, which pilots appreciate.',
      ru: 'Записано перелётов: {flights}. Без происшествий — пилоты такое ценят.',
    },
  ],
}

export type RemarksStats = {
  total_flights: number
  total_duration_minutes: number
  countries_count: number
  airlines_count: number
  has_night_departure: boolean
}

/** First matching trigger, in priority order, with its params (unformatted). */
export function remarksTrigger(stats: RemarksStats): {
  id: RemarksTrigger
  params: Record<string, number>
} {
  const flights = stats.total_flights
  const days = Math.floor((stats.total_duration_minutes || 0) / 1440)
  if (flights <= 0) return { id: 'zero', params: {} }
  if (flights < 5) return { id: 'few', params: { flights } }
  if (days >= 2) return { id: 'airborne', params: { days } }
  if (stats.countries_count >= 10)
    return { id: 'countries', params: { countries: stats.countries_count } }
  if (stats.airlines_count >= 5)
    return { id: 'airlines', params: { airlines: stats.airlines_count } }
  if (stats.has_night_departure) return { id: 'redEye', params: {} }
  return { id: 'steady', params: { flights } }
}

export function remarksLine(ownerId: string, stats: RemarksStats, locale: Locale) {
  const { id, params } = remarksTrigger(stats)
  const variant = fnv1a32(`${ownerId}|profile|${id}`) % 3
  const values = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, formatNumber(locale, value)]),
  )
  return fill(t(REMARKS_CORPUS[id][variant], locale), values)
}
