import en from '@kuuki/shared/i18n/en'
import ru from '@kuuki/shared/i18n/ru'
import type { toUserBadgeWithDefinition } from '../../../../../functions/api/_lib/badges'
import type { Locale } from '../../lib/format'

export type EarnedBadge = ReturnType<typeof toUserBadgeWithDefinition>
const aliases: Record<string, string> = {
  'flights-1': 'launchPad', 'flights-2': 'lowOrbit', 'flights-3': 'highOrbit', 'flights-4': 'moonMission', 'flights-5': 'marsMission',
  'distance-1': 'sputnik', 'distance-2': 'vostok', 'distance-3': 'apollo', 'distance-4': 'voyager', 'distance-5': 'newHorizons',
  'airlines-1': 'loyal', 'airlines-2': 'diverse', 'airlines-3': 'collector', 'aircraft-1': 'spotter', 'aircraft-2': 'enthusiast', 'aircraft-3': 'fleetMaster',
}
export function badgeName(item: EarnedBadge, locale: Locale) {
  if (item.badge.code === 'founding-user') return locale === 'ru' ? 'Первый экипаж' : 'Founding crew'
  const geographic: Record<string, [string, string]> = { 'continent-europe': ['Europhile', 'Любитель Европы'], 'continent-asia': ['Asianaut', 'Исследователь Азии'], 'continent-americas': ['Americas Wanderer', 'Путешественник по Америке'], 'continent-africa': ['Africa Explorer', 'Исследователь Африки'], 'continent-oceania': ['Pacific Voyager', 'Тихоокеанский путешественник'] }
  if (geographic[item.badge.code]) return geographic[item.badge.code][locale === 'ru' ? 1 : 0]
  const key = aliases[item.badge.code] ?? item.badge.code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  const names: Record<string, unknown> = locale === 'ru' ? ru.badges : en.badges
  return typeof names[key] === 'string' ? names[key] as string : item.badge.name
}
const tiers: Record<string, [string, string, string]> = {
  bronze: ['Bronze', 'Бронза', '△'], silver: ['Silver', 'Серебро', '◇'], gold: ['Gold', 'Золото', '⬟'], platinum: ['Platinum', 'Платина', '⬡'], diamond: ['Diamond', 'Алмаз', '◆'],
}
export function badgeTier(tier: string | null, locale: Locale) {
  const value = tier ? tiers[tier] : null
  return value ? { label: value[locale === 'ru' ? 1 : 0], shape: value[2] } : { label: locale === 'ru' ? 'Особая награда' : 'Special award', shape: '☆' }
}
export function badgeDescription(item: EarnedBadge, locale: Locale) {
  if (locale === 'en') return item.badge.description
  if (item.badge.code === 'founding-user') return 'Вы присоединились к Kuuki на раннем этапе.'
  const criteria = item.badge.criteria as Record<string, unknown> | null
  const labels: Record<string, string> = { flights: 'Перелёты', distance_km: 'Расстояние, км', countries: 'Страны и территории', continents: 'Континенты', airlines: 'Авиакомпании', aircraft: 'Типы самолётов', aircraft_types: 'Типы самолётов', widebody_types: 'Типы широкофюзеляжных самолётов', cities: 'Города', airports: 'Аэропорты', airtime_minutes: 'Время в воздухе, мин' }
  const threshold = criteria && Object.entries(criteria).find(([key, value]) => labels[key] && typeof value === 'number')
  return threshold ? `${labels[threshold[0]]}: ${new Intl.NumberFormat(locale).format(threshold[1] as number)}` : 'Награда за ваш опыт путешествий.'
}
export const badgeEventId = (item: EarnedBadge) => `${item.id}:${item.badge_id}:${item.earned_at}`
