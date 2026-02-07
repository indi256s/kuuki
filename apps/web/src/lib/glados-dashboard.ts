import i18n from 'i18next'
import type { BadgeTrackId } from './badge-tracks'

type FlavorState = 'empty' | 'active' | 'high'

function getFlavorState(tierIndex: number): FlavorState {
  if (tierIndex < 0) return 'empty'
  if (tierIndex <= 1) return 'active'
  return 'high'
}

export function getFlavorText(trackId: BadgeTrackId, tierIndex: number, value: number): string {
  const state = getFlavorState(tierIndex)
  const variants = i18n.t(`dashboard.flavor.${trackId}.${state}`, { returnObjects: true }) as string[]
  return variants[Math.abs(value) % variants.length]
}

export function getTimeRelatable(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return i18n.t('dashboard.flavor.timeRelatable.quickHop')
  if (minutes < 1440) {
    const movies = Math.round(minutes / 120)
    return movies === 1
      ? i18n.t('dashboard.flavor.timeRelatable.oneMovie')
      : i18n.t('dashboard.flavor.timeRelatable.movies', { count: movies })
  }
  const days = Math.round(minutes / 1440)
  if (days <= 7) return i18n.t('dashboard.flavor.timeRelatable.vacation')
  if (days <= 30) return i18n.t('dashboard.flavor.timeRelatable.twoWeeks')
  return i18n.t('dashboard.flavor.timeRelatable.fullMonth')
}
