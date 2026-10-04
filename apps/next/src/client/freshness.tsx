'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthGeneration } from '../../../web/src/lib/apiClient'
import { trackPrivateOperation } from './activity'
import { awaitPublication } from './write-feedback'

type Props = {
  ownerId: string
  revision: number
  publishedRevision: number
  locale: 'en' | 'ru'
}

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
    if (revision > publishedRevision) void awaitPublication(revision, controller.signal, current).then(result => {
      if (result === 'ready') router.refresh()
      else if (result === 'delayed') setDelayed(true)
    })
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
