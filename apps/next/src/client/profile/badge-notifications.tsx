'use client'
import { useEffect, useRef, useState } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { IdentitySnapshot, trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { badgeEventId, badgeName, type EarnedBadge } from './achievements'
import { notificationStorage } from './storage'
import { unseenBadges } from './unseen'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
import './profile.css'

export function BadgeNotifications({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const [notice, setNotice] = useState<{
    ownerId: string
    badges: EarnedBadge[]
    first: boolean
  } | null>(null)
  const pending = useRef<EarnedBadge[]>([])
  useEffect(() => {
    let stopped = false
    let active: AbortController | null = null
    const clear = () => {
      stopped = true
      active?.abort()
      pending.current = []
      setNotice(null)
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
          const result = unseenBadges(ownerId, badges, notificationStorage())
          if (result.badges.length) {
            const merged = [...pending.current, ...result.badges]
            pending.current = [
              ...new Map(merged.map((item) => [badgeEventId(item), item])).values(),
            ]
            setNotice((current) => ({
              ownerId,
              badges: pending.current,
              first: current?.first ?? result.first,
            }))
          }
        })
        .catch(() => {})
        .finally(release)
    }
    pending.current = []
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
  }, [ownerId])
  if (!notice || notice.ownerId !== ownerId) return null
  return (
    <IdentitySnapshot ownerId={ownerId}>
      <aside className="badge-notice" data-first={notice.first || undefined} role="status">
        <strong>{locale === 'ru' ? 'Новые достижения' : 'New achievements'}</strong>
        <ul>
          {notice.badges.map((item) => (
            <li key={item.id}>{badgeName(item, locale)}</li>
          ))}
        </ul>
        <Button
          variant="ghost"
          onClick={() => {
            pending.current = []
            setNotice(null)
          }}
        >
          {locale === 'ru' ? 'Закрыть' : 'Dismiss'}
        </Button>
      </aside>
    </IdentitySnapshot>
  )
}
