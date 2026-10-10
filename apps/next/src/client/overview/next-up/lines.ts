import type { DistanceRung, Goal } from '@kuuki/shared/overview/goals'
import {
  formatCount,
  formatDistanceKm,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../../lib/format'
import { fill, forms } from '../copy'

type Unlock = Extract<Goal, { kind: 'unlock' }>

// The verb follows the count, so each form carries its own ("Ещё 2 перелёта откроют", "Ещё 5 перелётов откроют").
const unlockForms = {
  flights: {
    en: {
      one: '{count} more flight unlocks {title}',
      other: '{count} more flights unlock {title}',
    },
    ru: {
      one: 'Ещё {count} перелёт откроет раздел «{title}»',
      few: 'Ещё {count} перелёта откроют раздел «{title}»',
      many: 'Ещё {count} перелётов откроют раздел «{title}»',
      other: 'Ещё {count} перелёта откроют раздел «{title}»',
    },
  },
  // Rhythm counts months with flights, not flights.
  months: {
    en: {
      one: '{count} more month with flights unlocks {title}',
      other: '{count} more months with flights unlock {title}',
    },
    ru: {
      one: 'Ещё {count} месяц с перелётами откроет раздел «{title}»',
      few: 'Ещё {count} месяца с перелётами откроют раздел «{title}»',
      many: 'Ещё {count} месяцев с перелётами откроют раздел «{title}»',
      other: 'Ещё {count} месяца с перелётами откроют раздел «{title}»',
    },
  },
  times: {
    en: {
      one: '{count} more flight with a departure time unlocks {title}',
      other: '{count} more flights with departure times unlock {title}',
    },
    ru: {
      one: 'Ещё {count} перелёт со временем вылета откроет раздел «{title}»',
      few: 'Ещё {count} перелёта со временем вылета откроют раздел «{title}»',
      many: 'Ещё {count} перелётов со временем вылета откроют раздел «{title}»',
      other: 'Ещё {count} перелёта со временем вылета откроют раздел «{title}»',
    },
  },
  aircraft: {
    en: {
      one: '{count} more flight with an aircraft unlocks {title}',
      other: '{count} more flights with an aircraft unlock {title}',
    },
    ru: {
      one: 'Ещё {count} перелёт с указанным самолётом откроет раздел «{title}»',
      few: 'Ещё {count} перелёта с указанным самолётом откроют раздел «{title}»',
      many: 'Ещё {count} перелётов с указанным самолётом откроют раздел «{title}»',
      other: 'Ещё {count} перелёта с указанным самолётом откроют раздел «{title}»',
    },
  },
} satisfies Record<string, CountForms>

const subjects = {
  flights: { en: 'Flights', ru: 'Перелётов' },
  months: { en: 'Months with flights', ru: 'Месяцев с перелётами' },
  times: { en: 'Flights with departure times', ru: 'Перелётов с временем вылета' },
  aircraft: { en: 'Flights with an aircraft', ru: 'Перелётов с самолётом' },
}

// The count follows "of", so Russian needs the genitive.
const countriesOf: CountForms = {
  en: { one: '{count} country', other: '{count} countries' },
  ru: {
    one: '{count} страны',
    few: '{count} стран',
    many: '{count} стран',
    other: '{count} стран',
  },
}
const milestoneForms = { flights: forms.flightsOf, countries: countriesOf }

const rungs: Record<DistanceRung, { en: string; ru: string }> = {
  equator: { en: 'Around the equator', ru: 'Вокруг экватора' },
  moon: { en: 'To the Moon', ru: 'До Луны' },
  moon_back: { en: 'To the Moon and back', ru: 'До Луны и обратно' },
}

/** The row's sentence and the meter's accessible name. The caller supplies the localized section title. */
export function goalCopy(
  goal: Goal,
  locale: Locale,
  sectionTitle: (goal: Unlock) => string,
): { line: string; label: string } {
  const have = formatNumber(locale, Math.round(goal.have))
  const of = locale === 'ru' ? 'из' : 'of'
  if (goal.kind === 'unlock') {
    const need = formatNumber(locale, goal.need)
    const line = fill(
      formatCount(locale, Math.max(1, Math.ceil(goal.need - goal.have)), unlockForms[goal.unit]),
      { title: sectionTitle(goal) },
    )
    const needed = locale === 'ru' ? 'нужных' : 'needed'
    return { line, label: `${subjects[goal.unit][locale]}: ${have} ${of} ${need} ${needed}` }
  }
  const line =
    goal.metric === 'distanceKm'
      ? `${rungs[goal.rung][locale]}: ${have} ${of} ${formatDistanceKm(locale, goal.need)}`
      : `${have} ${of} ${formatCount(locale, goal.need, milestoneForms[goal.metric])}`
  return { line, label: line }
}
