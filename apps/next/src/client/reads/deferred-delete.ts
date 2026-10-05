'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import type { DerivedAck } from '../../../../web/src/lib/derivedState'

/** The six seconds are visible time. Nothing is sent if the host unmounts during Undo; `onAbandoned` then receives the dropped IDs. */
export function useDeferredDelete(onCommitted: (ack: DerivedAck, ids: number[]) => void, onAbandoned?: (ids: number[]) => void) {
  const [pending, setPending] = useState<{ ids: number[]; seconds: number } | null>(null)
  const [failed, setFailed] = useState<number[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const operation = useRef<{ ids: number[]; remaining: number; last: number; controller: AbortController } | null>(null)
  const committed = useRef(onCommitted)
  const inFlight = useRef<AbortController | null>(null)
  const abandoned = useRef(onAbandoned)
  useEffect(() => { committed.current = onCommitted; abandoned.current = onAbandoned }, [onCommitted, onAbandoned])
  useEffect(() => {
    const tick = () => {
      const op = operation.current
      if (!op) return
      const now = Date.now()
      if (!document.hidden) op.remaining -= now - op.last
      op.last = now
      if (op.remaining > 0) { const seconds = Math.ceil(op.remaining / 1000); setPending(current => current && current.seconds === seconds && current.ids === op.ids ? current : { ids: op.ids, seconds }); return }
      operation.current = null
      setSubmitting(true)
      const release = trackPrivateOperation(op.controller)
      const request = op.ids.length === 1 ? api.delete<DerivedAck>(`/api/flights/${op.ids[0]}`, { signal: op.controller.signal }) : api.post<DerivedAck>('/api/flights/bulk-delete', { ids: op.ids }, { signal: op.controller.signal })
      void request.then(ack => { if (!op.controller.signal.aborted) { setPending(null); committed.current(ack, op.ids) } }).catch(() => {
        if (!op.controller.signal.aborted) { setPending(null); setFailed(op.ids) }
      }).finally(() => { release(); inFlight.current = null; if (!op.controller.signal.aborted) setSubmitting(false) })
      inFlight.current = op.controller
    }
    const visibility = () => { if (operation.current) operation.current.last = Date.now() }
    const timer = setInterval(tick, 100)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearInterval(timer); document.removeEventListener('visibilitychange', visibility)
      const dropped = operation.current
      dropped?.controller.abort(); operation.current = null; inFlight.current?.abort()
      if (dropped) abandoned.current?.(dropped.ids)
    }
  }, [])
  const schedule = (ids: number[]) => {
    if (!ids.length || operation.current || inFlight.current) return
    setFailed(null)
    operation.current = { ids, remaining: 6000, last: Date.now(), controller: new AbortController() }
    setPending({ ids, seconds: 6 })
  }
  const undo = () => {
    if (!operation.current) return
    operation.current.controller.abort()
    operation.current = null
    setPending(null)
  }
  return { pending, failed, submitting, schedule, undo }
}
