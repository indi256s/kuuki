'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from './activity'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { awaitPublication } from './publication'

export { awaitPublication }

/** Canonical success is independent of the bounded derived-publication check. */
export function useWriteFeedback(ownerId: string) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'ready' | 'pending' | 'delayed'>('idle')
  const operation = useRef<{ controller: AbortController; release: () => void } | null>(null)
  useEffect(
    () => () => {
      operation.current?.controller.abort()
      operation.current?.release()
    },
    [ownerId],
  )
  const acknowledge = useCallback(
    (ack: DerivedAck) => {
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
      void awaitPublication(ack.revision, controller.signal, current)
        .then((result) => {
          if (result === 'ready') {
            setStatus('ready')
            router.refresh()
          } else if (result === 'delayed') setStatus('delayed')
        })
        .finally(() => {
          release()
          if (operation.current?.controller === controller) operation.current = null
        })
    },
    [router],
  )
  return { acknowledge, status }
}
