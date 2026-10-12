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
  const operation = useRef<{
    controller: AbortController
    release: () => void
  } | null>(null)
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
      const publication = trackPublication(
        ack.revision,
        (result) => {
          setStatus(result)
          if (result === 'ready') router.refresh()
        },
        () => {
          if (operation.current === publication) operation.current = null
        },
      )
      operation.current = publication
    },
    [router],
  )
  return { acknowledge, status }
}

/**
 * Follows totals publication after the writer is gone (a form that closed on its confirmed save) and calls `onReady`
 * once totals are published. Stops on sign-out or account switch.
 */
export function followPublication(ack: DerivedAck, onReady: () => void) {
  if (ack.derived_state === 'ready') return onReady()
  if (ack.derived_state !== 'pending' || typeof ack.revision !== 'number') return
  trackPublication(ack.revision, (result) => {
    if (result === 'ready') onReady()
  })
}

/** Polls for the revision's totals as a tracked private operation, reporting only while the same session is current. */
function trackPublication(
  revision: number,
  onResult: (result: 'ready' | 'delayed') => void,
  onSettled?: () => void,
) {
  const controller = new AbortController()
  const release = trackPrivateOperation(controller)
  const generation = getAuthGeneration()
  const current = () => !controller.signal.aborted && generation === getAuthGeneration()
  void awaitPublication(revision, controller.signal, current)
    .then((result) => {
      if (result !== 'stale' && current()) onResult(result)
    })
    .finally(() => {
      release()
      onSettled?.()
    })
  return { controller, release }
}
