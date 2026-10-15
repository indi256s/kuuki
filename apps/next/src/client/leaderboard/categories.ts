import { pluralCategory, type Locale } from '../../lib/format'
import {
  GROUND_CATEGORIES,
  SKY_CATEGORIES,
  type LeaderboardCategory,
} from '../../../../../functions/api/_lib/leaderboard'
export const categories: Record<LeaderboardCategory, [string, string]> = {
  flights: ['Flights', 'Перелёты'],
  distance: ['Distance', 'Расстояние'],
  // The same name as the Achievements ladder: flight and legacy countries only, never the Passport total.
  countries: ['Countries on flights', 'Страны в перелётах'],
  cities: ['Airports', 'Аэропорты'],
  airlines: ['Airlines', 'Авиакомпании'],
  rail: ['Trains', 'Поезда'],
  road: ['Road trips', 'Автопутешествия'],
  ground_countries: ['Countries by land', 'Страны по земле'],
}
export type CategoryGroup = 'sky' | 'ground'
export const categoryGroups: [CategoryGroup, readonly LeaderboardCategory[]][] = [
  ['sky', SKY_CATEGORIES],
  ['ground', GROUND_CATEGORIES],
]
export const groupName: Record<CategoryGroup, [string, string]> = {
  sky: ['In the sky', 'В небе'],
  ground: ['On the ground', 'На земле'],
}
export const categoryName = (category: string, locale: Locale) =>
  categories[category as LeaderboardCategory]?.[locale === 'ru' ? 1 : 0] ?? category

const countryForms = {
  en: ['country or territory', 'countries and territories'],
  ru: ['страна или территория', 'страны и территории', 'стран и территорий', 'страны и территории'],
} satisfies { en: [string, string]; ru: [string, string, string, string] }

export function categoryUnit(category: LeaderboardCategory, value: number, locale: Locale) {
  if (category === 'distance') return locale === 'ru' ? 'км' : 'km'
  const forms: Record<
    Exclude<LeaderboardCategory, 'distance'>,
    { en: [string, string]; ru: [string, string, string, string] }
  > = {
    flights: { en: ['flight', 'flights'], ru: ['перелёт', 'перелёта', 'перелётов', 'перелёта'] },
    countries: countryForms,
    cities: {
      en: ['airport', 'airports'],
      ru: ['аэропорт', 'аэропорта', 'аэропортов', 'аэропорта'],
    },
    airlines: {
      en: ['airline', 'airlines'],
      ru: ['авиакомпания', 'авиакомпании', 'авиакомпаний', 'авиакомпании'],
    },
    rail: {
      en: ['train journey', 'train journeys'],
      ru: ['поездка на поезде', 'поездки на поезде', 'поездок на поезде', 'поездки на поезде'],
    },
    road: {
      en: ['road trip', 'road trips'],
      ru: ['автопутешествие', 'автопутешествия', 'автопутешествий', 'автопутешествия'],
    },
    ground_countries: countryForms,
  }
  const plural = pluralCategory(locale, value)
  return locale === 'en'
    ? forms[category].en[plural === 'one' ? 0 : 1]
    : forms[category].ru[plural === 'one' ? 0 : plural === 'few' ? 1 : plural === 'many' ? 2 : 3]
}
