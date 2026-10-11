'use client'

// The member shell's import runs: every batch this tab is following, kept alive across member routes so reading carries
// on while the member is elsewhere. Only reading happens in the background; review and saving stay on /import. A page
// that shows a run "views" it, and the dock leaves viewed runs to the page. Nothing here is written to browser storage.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useAwaiting } from '../awaiting'
import {
  createBatchRun,
  defaultBatchApi,
  isReading,
  sourceOf,
  type BatchApi,
  type BatchRun,
  type BatchState,
} from './batch-run'

export interface RunEntry {
  run: BatchRun
  state: BatchState
  /** A page shows this run, so the dock does not. */
  viewed: boolean
}

/**
 * Runs that end with nothing to look at leave without a word: a cancel that kept no rows, an expired batch, or a
 * finished batch with no rows left in review.
 */
const silent = (state: BatchState) =>
  state.phase === 'cancelled' ||
  state.phase === 'idle' ||
  state.failure?.kind === 'expired' ||
  (state.phase === 'ready' && !state.partial && !state.drafts.some((d) => d.status === 'review'))

interface Held {
  views: number
  reading: boolean
  unsubscribe: () => void
}

export class ImportRuns {
  readonly api: BatchApi
  /** Every run this tab follows, in the order it started following them. */
  private runs = new Map<BatchRun, Held>()
  /** Every batch this tab has held: a stale awaiting read never brings back a run that ended or was dismissed. */
  private seen = new Set<string>()
  private listeners = new Set<() => void>()
  private entries: RunEntry[] = []
  private onTerminal: () => void = () => {}

  constructor(api: BatchApi) {
    this.api = api
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getEntries = () => this.entries

  /** Called whenever a run stops being read. */
  whenFinished(callback: () => void) {
    this.onTerminal = callback
  }

  find(batchId: string) {
    for (const run of this.runs.keys()) if (run.batchId() === batchId) return run
    return null
  }

  /** Follow batches the server is still reading. Batches already in review are the header queue's, not the dock's. */
  seed(
    drafts: ReadonlyArray<{
      batchId: string
      status: string
      sourceType: string
      sourceLabel: string | null
    }>,
  ) {
    for (const draft of drafts) {
      if (draft.status !== 'processing' || this.seen.has(draft.batchId) || this.find(draft.batchId))
        continue
      const run = createBatchRun(
        this.api,
        draft.batchId,
        sourceOf(draft.sourceType, draft.sourceLabel),
      )
      this.add(run)
      run.open()
    }
  }

  /** A page shows `run` until the returned release. A run still being read when the page lets go stays with the dock. */
  view(run: BatchRun) {
    this.add(run).views++
    this.publish()
    return () => {
      const held = this.runs.get(run)
      if (!held) return
      held.views = Math.max(0, held.views - 1)
      // Opening a finished run's review is what clears it from the dock.
      if (held.views === 0 && !isReading(run.getState().phase)) this.remove(run)
      else this.publish()
    }
  }

  /** Hide a finished run. A run still being read can only be cancelled. */
  dismiss(run: BatchRun) {
    if (isReading(run.getState().phase)) return
    this.remove(run)
  }

  /** Drops every run. A remount (Strict Mode, a new owner) starts clean and seeds again. */
  dispose() {
    for (const run of [...this.runs.keys()]) this.remove(run)
    this.seen.clear()
  }

  private add(run: BatchRun): Held {
    const known = this.runs.get(run)
    if (known) return known
    const held: Held = {
      views: 0,
      reading: isReading(run.getState().phase),
      unsubscribe: run.subscribe(() => this.changed(run)),
    }
    this.runs.set(run, held)
    this.note(run)
    this.publish()
    return held
  }

  private remove(run: BatchRun) {
    const held = this.runs.get(run)
    if (!held) return
    held.unsubscribe()
    this.runs.delete(run)
    run.dispose()
    this.publish()
  }

  private note(run: BatchRun) {
    const id = run.batchId()
    if (id) this.seen.add(id)
  }

  private changed(run: BatchRun) {
    const held = this.runs.get(run)
    if (!held) return
    this.note(run)
    const state = run.getState()
    const was = held.reading
    held.reading = isReading(state.phase)
    if (was && !held.reading) this.onTerminal()
    if (held.views === 0 && silent(state)) this.remove(run)
    else this.publish()
  }

  private publish() {
    this.entries = [...this.runs].map(([run, held]) => ({
      run,
      state: run.getState(),
      viewed: held.views > 0,
    }))
    this.listeners.forEach((listener) => listener())
  }
}

const Context = createContext<ImportRuns | null>(null)

/** The shell's runs, or null outside the member shell (welcome card, tests) and where the job worker is not bound. */
export const useImportRunsStore = () => useContext(Context)

const NO_ENTRIES: RunEntry[] = []
const subscribeNothing = () => () => {}
export function useImportRuns(): RunEntry[] {
  const store = useContext(Context)
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    store ? store.getEntries : () => NO_ENTRIES,
    () => NO_ENTRIES,
  )
}

/**
 * Mounted by the member shell only when the job worker is bound, and keyed by the owner, so signing out drops every run.
 * Seeds itself from `/api/me/awaiting` and asks it to reload when a run finishes, so the header count agrees with the dock.
 */
export function ImportRunsProvider({
  api = defaultBatchApi,
  children,
}: {
  api?: BatchApi
  children: ReactNode
}) {
  const [store] = useState(() => new ImportRuns(api))
  const { data, reload } = useAwaiting()
  useEffect(() => {
    store.whenFinished(reload)
  }, [store, reload])
  useEffect(() => {
    if (data) store.seed(data.drafts)
  }, [store, data])
  useEffect(() => () => store.dispose(), [store])
  return <Context.Provider value={store}>{children}</Context.Provider>
}
