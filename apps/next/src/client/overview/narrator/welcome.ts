import { findAirport } from '@kuuki/data/airport-lookup'
import { airportAliases } from '@kuuki/shared'
import { formatCount, formatDistanceKm, type CountForms, type Locale } from '../../../lib/format'
import { foundOf } from '../../welcome/found'
import type { FactFlight } from '../../welcome/types'
import { fill, t } from '../copy'
import type { Line } from './corpus'
import { fnv1a32 } from './pick'

export type WelcomeTrigger = 'upcoming' | 'single' | 'big' | 'small'

export const BIG_FLIGHTS = 10
export const LINE_MAX = 90

const flightForms: CountForms = {
  en: { one: '{count} flight', other: '{count} flights' },
  ru: {
    one: '{count} перелёт',
    few: '{count} перелёта',
    many: '{count} перелётов',
    other: '{count} перелёта',
  },
}
const countryForms: CountForms = {
  en: { one: '{count} country', other: '{count} countries' },
  ru: {
    one: '{count} страна',
    few: '{count} страны',
    many: '{count} стран',
    other: '{count} страны',
  },
}
const upcomingForms: CountForms = {
  en: { one: '{count} upcoming flight', other: '{count} upcoming flights' },
  ru: {
    one: '{count} перелёт',
    few: '{count} перелёта',
    many: '{count} перелётов',
    other: '{count} перелёта',
  },
}

export const WELCOME_CORPUS: Record<WelcomeTrigger, [Line, Line, Line]> = {
  upcoming: [
    {
      en: 'Nothing flown yet, {booked} booked. The journal is ready when you are.',
      ru: 'Пока не летали, забронировано: {booked}. Журнал готов, как только будете готовы вы.',
    },
    {
      en: '{booked} booked and none flown. The journal is patient. Mostly.',
      ru: 'Забронировано: {booked}, полётов ноль. Журнал терпелив, но не вечно.',
    },
    {
      en: '{booked} booked, nothing flown. Ambitious, for a travel log.',
      ru: 'Сплошное будущее, забронировано: {booked}. Журнал уже точит карандаш.',
    },
  ],
  single: [
    {
      en: 'One flight, {route}. Every journal starts with one.',
      ru: 'Один перелёт, {route}. Любой журнал с чего-то начинается.',
    },
    {
      en: '{route} is on the books. Everyone has to start somewhere.',
      ru: 'Перелёт {route} в журнале. Все с чего-то начинают.',
    },
    {
      en: 'A single flight, {route}. The journal has high hopes for the second.',
      ru: 'Один перелёт, {route}. Журнал уже ждёт второго.',
    },
  ],
  big: [
    {
      en: '{flights} since {since}, and {city} still can’t get rid of you.',
      ru: '{flights} с {since} года, а {city} всё ещё не может вас отпустить.',
    },
    {
      en: '{flights} since {since}. {city} has started holding your seat.',
      ru: '{flights} с {since} года. {city} уже придерживает для вас место.',
    },
    {
      en: '{flights} logged. Consider this journal officially underprepared.',
      ru: '{flights} в журнале. К такому он явно не готовился.',
    },
  ],
  small: [
    {
      en: '{flights} since {since}. A modest start, and it’s all on record.',
      ru: '{flights} с {since} года. Скромное начало, зато всё записано.',
    },
    {
      en: '{flights} since {since}, and {city} already knows your face.',
      ru: '{flights} с {since} года, и {city} уже знает вас в лицо.',
    },
    {
      en: '{flights} logged. Plenty of room left in the journal.',
      ru: 'Пока в журнале: {flights}. Места ещё полно.',
    },
  ],
}

type Facts = {
  flown: FactFlight[]
  booked: number
  countries: number
  since: number | undefined
  city: { en: string; ru: string } | undefined
  route: string
}

function topCity(flown: FactFlight[]): Facts['city'] {
  const visits = new Map<string, number>()
  for (const flight of flown) {
    for (const code of [flight.origin, flight.destination]) {
      const iata = code.toUpperCase()
      if (findAirport(iata)?.city) visits.set(iata, (visits.get(iata) ?? 0) + 1)
    }
  }
  let best: string | undefined
  for (const [iata, n] of visits) {
    const top = best === undefined ? 0 : (visits.get(best) ?? 0)
    if (n > top || (n === top && best !== undefined && iata < best)) best = iata
  }
  if (!best) return undefined
  const city = findAirport(best)?.city
  return city ? { en: city, ru: airportAliases[best]?.city ?? city } : undefined
}

function factsOf(flights: FactFlight[]): Facts {
  const flown = flights.filter((flight) => !flight.upcoming)
  const found = foundOf(flown)
  const first = flown[0]
  return {
    flown,
    booked: flights.length - flown.length,
    countries: found.countries.length,
    since: found.since,
    city: topCity(flown),
    route: first ? `${first.origin.toUpperCase()}–${first.destination.toUpperCase()}` : '',
  }
}

function triggerOf(facts: Facts): WelcomeTrigger {
  if (facts.flown.length === 0 && facts.booked > 0) return 'upcoming'
  if (facts.flown.length === 1) return 'single'
  if (facts.flown.length >= BIG_FLIGHTS) return 'big'
  return 'small'
}

export function pickWelcomeLine({
  flights,
  seed,
  locale,
}: {
  flights: FactFlight[]
  seed: string
  locale: Locale
}): string {
  const facts = factsOf(flights)
  const trigger = triggerOf(facts)
  const values: Record<string, string> = {
    flights: formatCount(locale, facts.flown.length, flightForms),
    booked: formatCount(locale, facts.booked, flightForms),
    route: facts.route,
  }
  if (facts.since !== undefined) values.since = String(facts.since)
  if (facts.city) values.city = facts.city[locale]
  const lines = WELCOME_CORPUS[trigger]
  const start = fnv1a32(seed + trigger) % 3
  for (let step = 0; step < 3; step++) {
    const text = t(lines[(start + step) % 3], locale)
    const needs = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '')
    if (!needs.every((key) => key in values)) continue
    const line = fill(text, values)
    if (line.length <= LINE_MAX) return line
  }
  return fill(t(lines[2], locale), values)
}

export function statsLine({
  flights,
  leftOut,
  locale,
}: {
  flights: FactFlight[]
  leftOut: number
  locale: Locale
}): string {
  const facts = factsOf(flights)
  const ru = locale === 'ru'
  const n = formatCount(locale, leftOut, flightForms)
  const one = leftOut === 1
  const omitted =
    leftOut <= 0
      ? ''
      : ru
        ? `Не учтено: ${n}; добавить ${one ? 'его' : 'их'} можно в любой момент из журнала.`
        : `${n} left out; add ${one ? 'it' : 'them'} anytime from your journal.`
  if (triggerOf(facts) === 'upcoming') {
    const booked = formatCount(locale, facts.booked, upcomingForms)
    if (omitted) return ru ? `${omitted} Предстоит: ${booked}.` : `${omitted} ${booked}.`
    return ru
      ? `Предстоит: ${booked}. Прошлые можно добавить в любой момент из журнала.`
      : `${booked}. Add past ones anytime from your journal.`
  }
  const km = foundOf(facts.flown).km ?? 0
  const base = `${formatCount(locale, facts.countries, countryForms)}, ${formatDistanceKm(locale, km)}.`
  if (!omitted) return base
  return leftOut >= facts.flown.length ? `${omitted} ${base}` : `${base} ${omitted}`
}
