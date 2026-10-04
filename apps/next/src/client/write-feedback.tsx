'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, getAuthGeneration } from '../../../web/src/lib/apiClient'
import { trackPrivateOperation } from './activity'

export type WriteAcknowledgement = { derived_state?: 'ready' | 'pending'; revision?: number }
type Publication = { derived_state: 'ready' | 'pending' | 'error'; published_revision: number }
const delays = [1000, 2000, 4000, 8000, 8000, 8000]

/** Canonical success is independent of the bounded derived-publication check. */
export function useWriteFeedback(ownerId: string) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'ready' | 'pending' | 'delayed'>('idle')
  const operation = useRef<{ controller: AbortController; release: () => void } | null>(null)
  useEffect(() => () => {
    operation.current?.controller.abort()
    operation.current?.release()
  }, [ownerId])
  const acknowledge = useCallback((ack: WriteAcknowledgement) => {
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
    void (async () => {
      try {
        for (const delay of delays) {
          await new Promise<void>(resolve => {
            const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve() }
            const timer = setTimeout(finish, delay)
            controller.signal.addEventListener('abort', finish, { once: true })
            if (controller.signal.aborted) finish()
          })
          if (!current()) return
          const result = await api.get<Publication>('/api/me/derived-state', undefined, { signal: controller.signal })
          if (!current()) return
          if (result.derived_state === 'ready' && result.published_revision >= ack.revision!) {
            setStatus('ready')
            router.refresh()
            return
          }
          if (result.derived_state === 'error') break
        }
        if (current()) setStatus('delayed')
      } catch { if (current()) setStatus('delayed') }
      finally { release(); if (operation.current?.controller === controller) operation.current = null }
    })()
  }, [router])
  return { acknowledge, status }
}
