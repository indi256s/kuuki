'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import type { RouteProjection } from './types'

type Options = {
  ownerId: string
  period: 'all' | `${number}`
  /** Stamps of the summary or Passport data shown beside the map. */
  revision: number
  publishedRevision: number
  enabled: boolean
  /** Called once per mismatch when the projection and the shown data differ: refresh the shown data, never combine them. */
  onStale: () => void
}

/**
 * The one client read of `GET /api/flights/route-projection` (Passport map and Overview preview). A response for
 * another owner or period is a failure; `current` is set only for a ready projection whose stamps match the shown data.
 */
export function useRouteProjection({ ownerId, period, revision, publishedRevision, enabled, onStale }: Options) {
  const [projection, setProjection] = useState<RouteProjection | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refreshedStamp = useRef<string | null>(null)
  const key = `${ownerId}:${period}`
  const loaded = projection?.ownerId === ownerId && projection.period === period ? projection : null
  const mismatched = !!loaded && (loaded.revision !== revision || loaded.publishedRevision !== publishedRevision || loaded.countryState === 'updating')
  const current = loaded && !mismatched && loaded.derivedState === 'ready' ? loaded : null
  const staleStamp = mismatched ? `${key}:${revision}:${publishedRevision}:${loaded.revision}:${loaded.publishedRevision}` : null
  useEffect(() => {
    if (!staleStamp || refreshedStamp.current === staleStamp) return
    refreshedStamp.current = staleStamp
    onStale()
  }, [staleStamp, onStale])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const untrack = trackPrivateOperation(controller)
    api.get<RouteProjection>(`/api/flights/route-projection?period=${encodeURIComponent(period)}`, undefined, { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return
        if (value.ownerId !== ownerId || value.period !== period) throw new Error('Map identity or period changed')
        setErrorKey(null)
        setProjection(value)
      })
      .catch(() => { if (!controller.signal.aborted) setErrorKey(key) })
    return () => { controller.abort(); untrack() }
  }, [enabled, ownerId, period, revision, publishedRevision, key, attempt])

  /** Clears a failure and reads again. */
  const retry = useCallback(() => { setErrorKey(null); setAttempt(value => value + 1) }, [])
  return { loaded, current, mismatched, failed: errorKey === key, retry }
}
