'use client'
import { useEffect, useRef, useState } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { IdentitySnapshot, trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { badgeEventId, badgeName, type EarnedBadge } from './achievements'
import { notificationStorage } from './storage'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
import './profile.css'

const memory = new Map<string, string[]>()
/** First successful snapshot on a device is a baseline. Future deltas are one immutable batch. */
export function unseenBadges(
  ownerId: string,
  badges: EarnedBadge[],
  storage: Pick<Storage, 'getItem' | 'setItem'>,
) {
  const key = `kuuki:badge-events:${ownerId}`
  let previous = memory.get(key)
  try {
    const raw = storage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (Array.isArray(value) && value.every((id) => typeof id === 'string'))
        previous = previous ? [...new Set([...previous, ...value])] : value
    }
  } catch {
    /* blocked storage keeps the tab baseline */
  }
  const ids = badges.map(badgeEventId)
  const fresh = previous ? badges.filter((item) => !previous.includes(badgeEventId(item))) : []
  const seen = [...new Set([...(previous ?? []), ...ids])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {
    /* memory prevents remount replay */
  }
  return { badges: fresh, first: !!previous && previous.length === 0 && fresh.length > 0 }
}
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
