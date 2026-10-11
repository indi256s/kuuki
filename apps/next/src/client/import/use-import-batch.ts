'use client'

// Owns the client's view of one server batch: submit, resume from a batch id, watch while recognition runs, and
// keep per-row updates. The snapshot is the only authority; nothing here is written to browser storage.
// Inside the member shell's import runs the run belongs to the shell, so leaving the page keeps it being read; outside
// (the welcome card, tests) the run is this hook's own and unmounting stops it.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  createBatchRun,
  defaultBatchApi,
  isReading,
  type BatchApi,
  type BatchRun,
} from './batch-run'
import { useImportRunsStore } from './import-runs'

export { defaultBatchApi, type BatchApi, type BatchState, type Phase } from './batch-run'

export function useImportBatch({
  api,
  initialBatchId,
  onBatchId,
}: {
  api?: BatchApi
  initialBatchId?: string | null
  onBatchId?: (id: string) => void
}) {
  const store = useImportRunsStore()
  const apiRef = useRef(api ?? store?.api ?? defaultBatchApi)
  useEffect(() => {
    apiRef.current = api ?? store?.api ?? defaultBatchApi
  })
  const idCallback = useRef(onBatchId)
  useEffect(() => {
    idCallback.current = onBatchId
  })

  const [run] = useState<BatchRun>(() => {
    const held = initialBatchId ? store?.find(initialBatchId) : null
    if (held) return held
    // The run reads the latest api, as the hook always has.
    const latest: BatchApi = {
      readBatch: (...args) => apiRef.current.readBatch(...args),
      connect: (...args) => apiRef.current.connect(...args),
      submit: (...args) => apiRef.current.submit(...args),
      sleep: (ms) => apiRef.current.sleep(ms),
    }
    return createBatchRun(latest, initialBatchId ?? null)
  })
  const state = useSyncExternalStore(run.subscribe, run.getState, run.getState)

  useEffect(() => {
    const release = run.onBatchId((id) => idCallback.current?.(id))
    if (!store) {
      run.open()
      return () => {
        release()
        run.dispose()
      }
    }
    const leave = store.view(run)
    // A run the shell already finished is read once more, so its review starts from the stored snapshot.
    const { phase } = run.getState()
    if (initialBatchId && phase !== 'idle' && !isReading(phase))
      void run.reload(initialBatchId).catch(() => {})
    run.open()
    return () => {
      release()
      leave()
    }
    // The id from the URL is read once; later ids come from `start`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, store])

  const seen = state.batch?.id ?? initialBatchId ?? null
  const reload = useCallback(() => run.reload(seen), [run, seen])

  // The run's own methods are stable for its lifetime.
  return { ...state, start: run.start, reload, setDraft: run.setDraft, reset: run.reset }
}
