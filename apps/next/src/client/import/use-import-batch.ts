'use client'

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
    const { phase } = run.getState()
    if (initialBatchId && phase !== 'idle' && !isReading(phase))
      void run.reload(initialBatchId).catch(() => {})
    run.open()
    return () => {
      release()
      leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, store])

  const seen = state.batch?.id ?? initialBatchId ?? null
  const reload = useCallback(() => run.reload(seen), [run, seen])

  return { ...state, start: run.start, reload, setDraft: run.setDraft, reset: run.reset }
}
