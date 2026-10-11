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

/** Runs that end with nothing to look at leave without a word: a cancel that kept no rows, or an expired batch. */
const silent = (state: BatchState) =>
  state.phase === 'cancelled' || state.phase === 'idle' || state.failure?.kind === 'expired'

export class ImportRuns {
  readonly api: BatchApi
  private runs: BatchRun[] = []
  private views = new Map<BatchRun, number>()
  private unsubscribe = new Map<BatchRun, () => void>()
  private reading = new Map<BatchRun, boolean>()
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
    return this.runs.find((run) => run.batchId() === batchId) ?? null
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
      const run = createBatchRun(this.api, draft.batchId, {
        type: draft.sourceType === 'text' ? 'text' : 'file',
        label: draft.sourceLabel,
      })
      this.add(run)
      run.open()
    }
  }

  /** A page shows `run` until the returned release. A run still being read when the page lets go stays with the dock. */
  view(run: BatchRun) {
    this.add(run)
    this.views.set(run, (this.views.get(run) ?? 0) + 1)
    this.publish()
    return () => {
      const left = (this.views.get(run) ?? 1) - 1
      if (left > 0) this.views.set(run, left)
      else this.views.delete(run)
      // Opening a finished run's review is what clears it from the dock.
      if (left <= 0 && !isReading(run.getState().phase)) this.remove(run)
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
    for (const run of [...this.runs]) this.remove(run)
    this.seen.clear()
  }

  private add(run: BatchRun) {
    if (this.runs.includes(run)) return
    this.runs = [...this.runs, run]
    this.reading.set(run, isReading(run.getState().phase))
    this.unsubscribe.set(
      run,
      run.subscribe(() => this.changed(run)),
    )
    this.note(run)
    this.publish()
  }

  private remove(run: BatchRun) {
    if (!this.runs.includes(run)) return
    this.unsubscribe.get(run)?.()
    this.unsubscribe.delete(run)
    this.reading.delete(run)
    this.views.delete(run)
    run.dispose()
    this.runs = this.runs.filter((item) => item !== run)
    this.publish()
  }

  private note(run: BatchRun) {
    const id = run.batchId()
    if (id) this.seen.add(id)
  }

  private changed(run: BatchRun) {
    this.note(run)
    const state = run.getState()
    const was = this.reading.get(run) ?? false
    const now = isReading(state.phase)
    this.reading.set(run, now)
    if (was && !now) this.onTerminal()
    if (!this.views.has(run) && silent(state)) this.remove(run)
    else this.publish()
  }

  private publish() {
    this.entries = this.runs.map((run) => ({
      run,
      state: run.getState(),
      viewed: this.views.has(run),
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
