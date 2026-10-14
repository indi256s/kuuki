'use client'
import { useEffect } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import type { EarnedBadge } from './achievements'
import { FOUNDING, NEW_ACHIEVEMENTS, RUNG_NAME } from './ladders/copy'
import { toTiles, visibleBadges } from './ladders/model'
import { notificationStorage } from './storage'
import { unseenBadges } from './unseen'
import { useToast } from '../ui/toast'
import type { Locale } from '../../lib/format'

/** Announces newly earned achievements in the shell's toast region, one line per ladder. */
export function BadgeNotifications({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const { show, dismiss } = useToast()
  useEffect(() => {
    let stopped = false
    let active: AbortController | null = null
    const shown = new Set<number>()
    const clear = () => {
      stopped = true
      active?.abort()
      shown.forEach(dismiss)
      shown.clear()
    }
    const load = () => {
      if (stopped) return
      active?.abort()
      const controller = new AbortController()
      active = controller
      const release = trackPrivateOperation(controller)
      const generation = getAuthGeneration()
      void api
        .get<EarnedBadge[]>('/api/me/badges', undefined, { signal: controller.signal })
        .then((badges) => {
          if (
            stopped ||
            controller.signal.aborted ||
            generation !== getAuthGeneration() ||
            badges.some((item) => item.user_id !== ownerId)
          )
            return
          // Hidden rows (legacy, cities) never toast.
          const result = unseenBadges(ownerId, visibleBadges(badges), notificationStorage())
          if (!result.badges.length) return
          // One line per ladder: a batch that climbs several rungs names only the highest.
          const lines = toTiles(result.badges).map((tile) =>
            tile.kind === 'founding'
              ? FOUNDING.name[locale]
              : RUNG_NAME[tile.ladder][tile.rung - 1][locale],
          )
          shown.add(
            show({
              kind: 'success',
              message: NEW_ACHIEVEMENTS[locale],
              description: lines.join('\n'),
              duration: 8000,
            }),
          )
        })
        .catch(() => {})
        .finally(release)
    }
    load()
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, load)
    window.addEventListener('focus', load)
    window.addEventListener('kuuki:identity-reset', clear)
    // Badges can publish after the mutation; bounded account reads do not infer awards from flights.
    const interval = window.setInterval(load, 60_000)
    return () => {
      clear()
      window.clearInterval(interval)
      window.removeEventListener(LIFECYCLE_CHANGED_EVENT, load)
      window.removeEventListener('focus', load)
      window.removeEventListener('kuuki:identity-reset', clear)
    }
  }, [ownerId, locale, show, dismiss])
  return null
}
