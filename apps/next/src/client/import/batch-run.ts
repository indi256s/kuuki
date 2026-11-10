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

/** The server code is always present here, so the classifier always answers. */
const batchFailure = (code: string, retryAfter: string | null): Failure =>
  classifyBatchFailure(code || 'INTERNAL', retryAfter)!

/**
 * Rows were kept although recognition stopped early: shown under an explicit "partial" heading. A cancel keeps the rows
 * found before it (ADR 0001 section 9); an interruption carries what the server reported.
 */
export type Stopped = { why: 'cancelled' } | { why: 'interrupted'; failure: Failure }

interface Held {
  batch: Batch | null
  drafts: Draft[]
}

/** One variant per server outcome; the cause of a failure exists exactly when the run failed or was interrupted. */
export type BatchState = Held &
  (
    | { phase: 'idle' | 'starting' | 'processing' | 'cancelled' }
    | { phase: 'ready'; stopped: Stopped | null }
    | { phase: 'failed'; failure: Failure }
  )

export const stoppedOf = (state: BatchState): Stopped | null =>
  state.phase === 'ready' ? state.stopped : null

/** The reason the run failed or was interrupted, if it was. */
export const failureOf = (state: BatchState): Failure | null =>
  state.phase === 'failed'
    ? state.failure
    : state.phase === 'ready' && state.stopped?.why === 'interrupted'
      ? state.stopped.failure
      : null

/** What the member gave us, for naming the run before the first snapshot arrives. */
export interface RunSource {
  type: 'file' | 'text'
  label: string | null
}

export const IDLE: Held & { phase: 'idle' } = { phase: 'idle', batch: null, drafts: [] }

export function fromSnapshot({ batch, drafts }: Snapshot): BatchState {
  if (batch.expired)
    return {
      phase: 'failed',
      batch,
      drafts: [],
      failure: batchFailure('IMPORT_BATCH_EXPIRED', null),
    }
  switch (batch.status) {
    case 'processing':
      return { phase: 'processing', batch, drafts }
    case 'failed':
      return {
        phase: 'failed',
        batch,
        drafts,
        failure: batchFailure(batch.errorCode ?? 'INTERNAL', batch.retryAfter),
      }
    // Cancelling stops extraction but keeps the rows already found (ADR 0001 section 9): they stay reachable as a stopped review.
    case 'cancelled':
      return drafts.length > 0
        ? { phase: 'ready', batch, drafts, stopped: { why: 'cancelled' } }
        : { phase: 'cancelled', batch, drafts: [] }
    case 'partial':
      return {
        phase: 'ready',
        batch,
        drafts,
        stopped: {
          why: 'interrupted',
          failure: batchFailure(batch.errorCode ?? 'JOB_INTERRUPTED', batch.retryAfter),
        },
      }
    default:
      return { phase: 'ready', batch, drafts, stopped: null }
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
            phase: 'failed',
            batch: snapshot.batch,
            drafts: snapshot.drafts,
            failure: batchFailure('JOB_INTERRUPTED', null),
          })
          return
        }
        set(fromSnapshot(snapshot))
      },
    }).catch((error) => {
      if (!current()) return
      set({
        phase: 'failed',
        batch: state.batch,
        drafts: state.drafts,
        failure: classifyRequestFailure(error),
      })
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
