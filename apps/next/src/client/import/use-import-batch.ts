'use client'

// Owns the client's view of one server batch: submit, resume from a batch id, watch while recognition runs, and
// keep per-row updates. The snapshot is the only authority; nothing here is written to browser storage.
import { useCallback, useEffect, useRef, useState } from 'react'
import { watchBatch } from './batch-watcher'
import { connectEvents } from './import-events'
import { classifyBatchFailure, classifyRequestFailure, type Failure } from './import-errors'
import { readBatch, submitSource, type ImportSource } from './import-api'
import type { Batch, Draft, ImportEvent, Snapshot } from './import-types'

export interface BatchApi {
  readBatch: (batchId: string, signal?: AbortSignal) => Promise<Snapshot>
  connect: (batchId: string, after: number, onEvent: (event: ImportEvent) => void, signal: AbortSignal) => Promise<void>
  submit: (source: ImportSource, operationId: string, signal?: AbortSignal) => Promise<{ batchId: string } | Snapshot>
  sleep: (ms: number) => Promise<void>
}

export const defaultBatchApi: BatchApi = {
  readBatch,
  connect: (batchId, after, onEvent, signal) => connectEvents(batchId, after, onEvent, signal),
  submit: submitSource,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
}

export type Phase = 'idle' | 'starting' | 'processing' | 'ready' | 'failed' | 'cancelled'

export interface BatchState {
  phase: Phase
  batch: Batch | null
  drafts: Draft[]
  failure: Failure | null
  /** Rows were kept although recognition stopped early: shown under an explicit "partial" heading. */
  partial: boolean
  /** Recognition was cancelled by the member and the rows found before that are kept (a stopped, partial review). */
  cancelled: boolean
}

const IDLE: BatchState = { phase: 'idle', batch: null, drafts: [], failure: null, partial: false, cancelled: false }

function fromSnapshot({ batch, drafts }: Snapshot): BatchState {
  if (batch.expired) return { ...IDLE, phase: 'failed', batch, failure: classifyBatchFailure('IMPORT_BATCH_EXPIRED', null) }
  switch (batch.status) {
    case 'processing': return { ...IDLE, phase: 'processing', batch, drafts }
    case 'failed': return { ...IDLE, phase: 'failed', batch, drafts, failure: classifyBatchFailure(batch.errorCode ?? 'INTERNAL', batch.retryAfter) }
    // Cancelling stops extraction but keeps the rows already found (ADR 0001 section 9): they stay reachable as a stopped review.
    case 'cancelled': return drafts.length > 0 ? { ...IDLE, phase: 'ready', batch, drafts, partial: true, cancelled: true } : { ...IDLE, phase: 'cancelled', batch }
    case 'partial': return { ...IDLE, phase: 'ready', batch, drafts, failure: classifyBatchFailure(batch.errorCode ?? 'JOB_INTERRUPTED', batch.retryAfter), partial: true }
    default: return { ...IDLE, phase: 'ready', batch, drafts }
  }
}

export function useImportBatch({ api = defaultBatchApi, initialBatchId, onBatchId }: { api?: BatchApi; initialBatchId?: string | null; onBatchId?: (id: string) => void }) {
  const [state, setState] = useState<BatchState>(initialBatchId ? { ...IDLE, phase: 'starting' } : IDLE)
  const controller = useRef<AbortController | null>(null)
  const idCallback = useRef(onBatchId)
  useEffect(() => { idCallback.current = onBatchId })
  const apiRef = useRef(api)
  useEffect(() => { apiRef.current = api })

  const watch = useCallback((batchId: string) => {
    controller.current?.abort()
    const own = new AbortController()
    controller.current = own
    const current = () => controller.current === own && !own.signal.aborted
    void watchBatch({
      load: () => apiRef.current.readBatch(batchId, own.signal),
      connect: (after, onEvent) => apiRef.current.connect(batchId, after, onEvent, own.signal),
      sleep: ms => apiRef.current.sleep(ms),
      signal: own.signal,
      onSnapshot: (snapshot, info) => {
        if (!current()) return
        if (info.reupload && snapshot.batch.status === 'processing') {
          own.abort()
          setState({ ...IDLE, phase: 'failed', batch: snapshot.batch, drafts: snapshot.drafts, failure: classifyBatchFailure('JOB_INTERRUPTED', null) })
          return
        }
        setState(fromSnapshot(snapshot))
      },
    }).catch(error => {
      if (!current()) return
      setState(previous => ({ ...previous, phase: 'failed', failure: classifyRequestFailure(error) }))
    })
  }, [])

  useEffect(() => {
    if (initialBatchId) watch(initialBatchId)
    return () => controller.current?.abort()
    // The id from the URL is read once; later ids come from `start`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(async (source: ImportSource, operationId: string) => {
    controller.current?.abort()
    const own = new AbortController()
    controller.current = own
    setState({ ...IDLE, phase: 'starting' })
    try {
      const answer = await apiRef.current.submit(source, operationId, own.signal)
      if (own.signal.aborted) return
      if ('batchId' in answer) { idCallback.current?.(answer.batchId); watch(answer.batchId); return }
      idCallback.current?.(answer.batch.id)
      if (answer.batch.status === 'processing') watch(answer.batch.id)
      else setState(fromSnapshot(answer))
    } catch (error) {
      if (own.signal.aborted) return
      setState({ ...IDLE, phase: 'failed', failure: classifyRequestFailure(error) })
    }
  }, [watch])

  /** Re-read the stored snapshot (after a confirm, a conflict or a lost response). */
  const reload = useCallback(async (): Promise<Snapshot | null> => {
    const id = state.batch?.id ?? initialBatchId
    if (!id) return null
    const snapshot = await apiRef.current.readBatch(id)
    setState(fromSnapshot(snapshot))
    return snapshot
  }, [state.batch?.id, initialBatchId])

  const setDraft = useCallback((next: Draft) => {
    setState(previous => ({ ...previous, drafts: previous.drafts.map(row => row.id === next.id && next.version >= row.version ? next : row) }))
  }, [])

  const reset = useCallback(() => { controller.current?.abort(); setState(IDLE) }, [])

  return { ...state, start, reload, setDraft, reset }
}
