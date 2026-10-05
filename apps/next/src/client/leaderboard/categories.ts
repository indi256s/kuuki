import { pluralCategory, type Locale } from '../../lib/format'
import type { LeaderboardCategory } from '../../../../../functions/api/_services/publicLeaderboard'
export const categories: Record<LeaderboardCategory, [string, string]> = { flights: ['Flights', 'Перелёты'], distance: ['Distance', 'Расстояние'], countries: ['Countries and territories', 'Страны и территории'], cities: ['Airports', 'Аэропорты'], airlines: ['Airlines', 'Авиакомпании'] }
export const categoryName = (category: string, locale: Locale) => categories[category as LeaderboardCategory]?.[locale === 'ru' ? 1 : 0] ?? category

export function categoryUnit(category: LeaderboardCategory, value: number, locale: Locale) {
  if (category === 'distance') return locale === 'ru' ? 'км' : 'km'
  const forms: Record<Exclude<LeaderboardCategory, 'distance'>, { en: [string, string]; ru: [string, string, string, string] }> = {
    flights: { en: ['flight', 'flights'], ru: ['перелёт', 'перелёта', 'перелётов', 'перелёта'] },
    countries: { en: ['country or territory', 'countries and territories'], ru: ['страна или территория', 'страны и территории', 'стран и территорий', 'страны и территории'] },
    cities: { en: ['airport', 'airports'], ru: ['аэропорт', 'аэропорта', 'аэропортов', 'аэропорта'] },
    airlines: { en: ['airline', 'airlines'], ru: ['авиакомпания', 'авиакомпании', 'авиакомпаний', 'авиакомпании'] },
  }
  const plural = pluralCategory(locale, value)
  return locale === 'en' ? forms[category].en[plural === 'one' ? 0 : 1] : forms[category].ru[plural === 'one' ? 0 : plural === 'few' ? 1 : plural === 'many' ? 2 : 3]
}
