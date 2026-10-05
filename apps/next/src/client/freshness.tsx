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
  /**
   * What the read says about publication. Anything but `ready` is pending even when the revisions are equal: an older
   * build can publish a revision without the evidence projection, and only the owner sync's repair clears that.
   */
  derivedState?: 'ready' | 'pending' | 'error'
  locale: 'en' | 'ru'
}

export const isPublicationPending = (revision: number, publishedRevision: number, derivedState?: Props['derivedState']) =>
  revision > publishedRevision || (derivedState !== undefined && derivedState !== 'ready')

/** RSC owns summaries; this status-only bridge never fetches a second summary. */
export function ReadFreshness({ ownerId, revision, publishedRevision, derivedState, locale }: Props) {
  const pending = isPublicationPending(revision, publishedRevision, derivedState)
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
    if (pending) void awaitPublication(revision, controller.signal, current).then(result => {
      if (result === 'ready') router.refresh()
      else if (result === 'delayed') setDelayed(true)
    })
    return () => {
      controller.abort()
      release()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [ownerId, revision, publishedRevision, pending, router])
  if (!pending || !delayed) return null
  return <p role="status" className="status-note">{locale === 'ru'
    ? 'Обновление итогов занимает больше времени. Перелёты сохранены. Проверьте итоги позже.'
    : 'Totals are taking longer to update. Your flights are saved. Check again later.'}</p>
}
