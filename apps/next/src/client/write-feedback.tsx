'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, getAuthGeneration } from '../../../web/src/lib/apiClient'
import { trackPrivateOperation } from './activity'
import type { DerivedAck } from '../../../web/src/lib/derivedState'

type Publication = { derived_state: 'ready' | 'pending' | 'error'; published_revision: number }
const delays = [1000, 2000, 4000, 8000, 8000, 8000]

/** Bounded backoff poll for derived publication; 'stale' means the caller was aborted or the account changed. */
export async function awaitPublication(revision: number, signal: AbortSignal, current: () => boolean): Promise<'ready' | 'delayed' | 'stale'> {
  try {
    for (const delay of delays) {
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
        const timer = setTimeout(finish, delay)
        signal.addEventListener('abort', finish, { once: true })
        if (signal.aborted) finish()
      })
      if (!current()) return 'stale'
      const result = await api.get<Publication>('/api/me/derived-state', undefined, { signal })
      if (!current()) return 'stale'
      if (result.derived_state === 'ready' && result.published_revision >= revision) return 'ready'
      if (result.derived_state === 'error') break
    }
  } catch { /* reported as delayed */ }
  return current() ? 'delayed' : 'stale'
}

/** Canonical success is independent of the bounded derived-publication check. */
export function useWriteFeedback(ownerId: string) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'ready' | 'pending' | 'delayed'>('idle')
  const operation = useRef<{ controller: AbortController; release: () => void } | null>(null)
  useEffect(() => () => {
    operation.current?.controller.abort()
    operation.current?.release()
  }, [ownerId])
  const acknowledge = useCallback((ack: DerivedAck) => {
    operation.current?.controller.abort()
    operation.current?.release()
    operation.current = null
    if (ack.derived_state === 'ready') {
      setStatus('ready')
      router.refresh()
      return
    }
    if (ack.derived_state !== 'pending' || typeof ack.revision !== 'number') {
      setStatus('delayed')
      return
    }
    setStatus('pending')
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    operation.current = { controller, release }
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    void awaitPublication(ack.revision, controller.signal, current).then(result => {
      if (result === 'ready') {
        setStatus('ready')
        router.refresh()
      } else if (result === 'delayed') setStatus('delayed')
    }).finally(() => { release(); if (operation.current?.controller === controller) operation.current = null })
  }, [router])
  return { acknowledge, status }
}
