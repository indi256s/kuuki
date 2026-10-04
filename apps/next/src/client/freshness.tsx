'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, getAuthGeneration } from '../../../web/src/lib/apiClient'
import { trackPrivateOperation } from './activity'

type Props = {
  ownerId: string
  revision: number
  publishedRevision: number
  locale: 'en' | 'ru'
}
type Status = { revision: number; published_revision: number; derived_state: 'ready' | 'pending' | 'error' }
const delays = [1000, 2000, 4000, 8000, 8000, 8000]

/** RSC owns summaries; this status-only bridge never fetches a second summary. */
export function ReadFreshness({ ownerId, revision, publishedRevision, locale }: Props) {
  const router = useRouter()
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    let lastRefresh = Date.now()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    const refresh = () => {
      if (!current() || document.visibilityState !== 'visible' || Date.now() - lastRefresh < 5000) return
      lastRefresh = Date.now()
      router.refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const wait = (milliseconds: number) => new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, milliseconds)
      controller.signal.addEventListener('abort', finish, { once: true })
      if (controller.signal.aborted) finish()
    })
    if (revision > publishedRevision) void (async () => {
      try {
        for (const delay of delays) {
          await wait(delay)
          if (!current()) return
          const status = await api.get<Status>('/api/me/derived-state', undefined, { signal: controller.signal })
          if (!current()) return
          if (status.published_revision >= revision && status.derived_state === 'ready') {
            router.refresh()
            return
          }
          if (status.derived_state === 'error') break
        }
        if (current()) setDelayed(true)
      } catch {
        if (current()) setDelayed(true)
      }
    })()
    return () => {
      controller.abort()
      release()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [ownerId, revision, publishedRevision, router])
  if (revision <= publishedRevision || !delayed) return null
  return <p role="status" className="status-note">{locale === 'ru'
    ? 'Обновление итогов занимает больше времени. Перелёты сохранены. Проверьте итоги позже.'
    : 'Totals are taking longer to update. Your flights are saved. Check again later.'}</p>
}
