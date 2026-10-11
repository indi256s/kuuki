// One server batch as seen by this tab: submit, resume from a batch id, watch while recognition runs, and keep per-row
// updates. Free of React, so the import runs provider can keep a run alive across routes and the hook can read it with
// `useSyncExternalStore`. The snapshot is the only authority; nothing here is written to browser storage.
import { watchBatch } from './batch-watcher'
import { connectEvents } from './import-events'
import { classifyBatchFailure, classifyRequestFailure, type Failure } from './import-errors'
import { readBatch, submitSource, type ImportSource } from './import-api'
import type { Batch, Draft, ImportEvent, Snapshot } from './import-types'

export interface BatchApi {
  readBatch: (batchId: string, signal?: AbortSignal) => Promise<Snapshot>
  connect: (
    batchId: string,
    after: number,
    onEvent: (event: ImportEvent) => void,
    signal: AbortSignal,
  ) => Promise<void>
  submit: (
    source: ImportSource,
    operationId: string,
    signal?: AbortSignal,
  ) => Promise<{ batchId: string } | Snapshot>
  sleep: (ms: number) => Promise<void>
}

export const defaultBatchApi: BatchApi = {
  readBatch,
  connect: (batchId, after, onEvent, signal) => connectEvents(batchId, after, onEvent, signal),
  submit: submitSource,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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

/** What the member gave us, for naming the run before the first snapshot arrives. */
export interface RunSource {
  type: 'file' | 'text'
  label: string | null
}

export const IDLE: BatchState = {
  phase: 'idle',
  batch: null,
  drafts: [],
  failure: null,
  partial: false,
  cancelled: false,
}

export function fromSnapshot({ batch, drafts }: Snapshot): BatchState {
  if (batch.expired)
    return {
      ...IDLE,
      phase: 'failed',
      batch,
      failure: classifyBatchFailure('IMPORT_BATCH_EXPIRED', null),
    }
  switch (batch.status) {
    case 'processing':
      return { ...IDLE, phase: 'processing', batch, drafts }
    case 'failed':
      return {
        ...IDLE,
        phase: 'failed',
        batch,
        drafts,
        failure: classifyBatchFailure(batch.errorCode ?? 'INTERNAL', batch.retryAfter),
      }
    // Cancelling stops extraction but keeps the rows already found (ADR 0001 section 9): they stay reachable as a stopped review.
    case 'cancelled':
      return drafts.length > 0
        ? { ...IDLE, phase: 'ready', batch, drafts, partial: true, cancelled: true }
        : { ...IDLE, phase: 'cancelled', batch }
    case 'partial':
      return {
        ...IDLE,
        phase: 'ready',
        batch,
        drafts,
        failure: classifyBatchFailure(batch.errorCode ?? 'JOB_INTERRUPTED', batch.retryAfter),
        partial: true,
      }
    default:
      return { ...IDLE, phase: 'ready', batch, drafts }
  }
}

export const isReading = (phase: Phase) => phase === 'starting' || phase === 'processing'

export interface BatchRun {
  subscribe: (listener: () => void) => () => void
  getState: () => BatchState
  /** The batch this run follows; set as soon as the server names it, before its first snapshot. */
  batchId: () => string | null
  source: () => RunSource | null
  /** Called with the id of every batch a submission is accepted as. */
  onBatchId: (listener: (id: string) => void) => () => void
  /** Follow the run's batch if it is still being read and nothing follows it. Safe to call again after `dispose`. */
  open: () => void
  start: (source: ImportSource, operationId: string) => Promise<void>
  /**
   * Re-read the stored snapshot (after a confirm, a conflict or a lost response). `expected` is the batch the caller saw;
   * a reload asked for an older batch answers null instead of reading the current one.
   */
  reload: (expected?: string | null) => Promise<Snapshot | null>
  setDraft: (next: Draft) => void
  reset: () => void
  /** Stop following the batch and drop an unanswered submission. The state is kept, and `open` resumes. */
  dispose: () => void
}

export const sourceOf = (type: string, label?: string | null): RunSource => ({
  type: type === 'text' ? ('text' as const) : ('file' as const),
  label: label ?? null,
})

export function createBatchRun(
  api: BatchApi,
  initialBatchId: string | null = null,
  initialSource: RunSource | null = null,
): BatchRun {
  let state: BatchState = initialBatchId ? { ...IDLE, phase: 'starting' } : IDLE
  let controller: AbortController | null = null
  let activeBatchId = initialBatchId
  let source = initialSource
  const listeners = new Set<() => void>()
  const idListeners = new Set<(id: string) => void>()

  const set = (next: BatchState) => {
    state = next
    if (next.batch) source = sourceOf(next.batch.sourceType, next.batch.sourceLabel)
    listeners.forEach((listener) => listener())
  }
  const following = () => controller !== null && !controller.signal.aborted

  const watch = (batchId: string) => {
    controller?.abort()
    const own = new AbortController()
    controller = own
    activeBatchId = batchId
    const current = () => controller === own && !own.signal.aborted
    void watchBatch({
      load: () => api.readBatch(batchId, own.signal),
      connect: (after, onEvent) => api.connect(batchId, after, onEvent, own.signal),
      sleep: (ms) => api.sleep(ms),
      signal: own.signal,
      onSnapshot: (snapshot, info) => {
        if (!current()) return
        if (info.reupload && snapshot.batch.status === 'processing') {
          own.abort()
          set({
            ...IDLE,
            phase: 'failed',
            batch: snapshot.batch,
            drafts: snapshot.drafts,
            failure: classifyBatchFailure('JOB_INTERRUPTED', null),
          })
          return
        }
        set(fromSnapshot(snapshot))
      },
    }).catch((error) => {
      if (!current()) return
      set({ ...state, phase: 'failed', failure: classifyRequestFailure(error) })
    })
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getState: () => state,
    batchId: () => activeBatchId,
    source: () => source,
    onBatchId: (listener) => {
      idListeners.add(listener)
      return () => idListeners.delete(listener)
    },

    open: () => {
      if (activeBatchId && isReading(state.phase) && !following()) watch(activeBatchId)
    },

    start: async (input, operationId) => {
      controller?.abort()
      activeBatchId = null
      source = sourceOf(input.type, input.sourceLabel)
      const own = new AbortController()
      controller = own
      set({ ...IDLE, phase: 'starting' })
      try {
        const answer = await api.submit(input, operationId, own.signal)
        if (own.signal.aborted) return
        // A 202 names the batch to watch; an answer read inside the request is already its snapshot.
        const id = 'batchId' in answer ? answer.batchId : answer.batch.id
        activeBatchId = id
        idListeners.forEach((listener) => listener(id))
        if ('batchId' in answer || answer.batch.status === 'processing') watch(id)
        else set(fromSnapshot(answer))
      } catch (error) {
        if (own.signal.aborted) return
        set({ ...IDLE, phase: 'failed', failure: classifyRequestFailure(error) })
      }
    },

    reload: async (expected) => {
      const id = expected === undefined ? (state.batch?.id ?? initialBatchId) : expected
      const own = controller
      const phase = state.phase
      if (!id || !own || own.signal.aborted || activeBatchId !== id) return null
      const current = () => controller === own && !own.signal.aborted && activeBatchId === id
      let snapshot: Snapshot
      try {
        snapshot = await api.readBatch(id, own.signal)
      } catch (error) {
        if (!current()) return null
        throw error
      }
      if (!current() || snapshot.batch.id !== id) return null
      set(fromSnapshot(snapshot))
      if (phase === 'failed' && snapshot.batch.status === 'processing') watch(id)
      return snapshot
    },

    setDraft: (next) => {
      set({
        ...state,
        drafts: state.drafts.map((row) =>
          row.id === next.id && next.version >= row.version ? next : row,
        ),
      })
    },

    reset: () => {
      activeBatchId = null
      controller?.abort()
      source = null
      set(IDLE)
    },

    dispose: () => {
      controller?.abort()
    },
  }
}
