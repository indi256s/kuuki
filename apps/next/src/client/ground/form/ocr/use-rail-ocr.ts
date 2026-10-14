'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../../../activity'
import { readRailTicket } from '../../api'
import {
  fileToBase64,
  markAdded,
  newRow,
  OCR_CONCURRENCY,
  OCR_MAX_FILES,
  patchPreview,
  retryRow,
  settleRow,
  startRow,
  statusForFailure,
  stopRows,
  type OcrRow,
  type Preview,
} from './model'

/**
 * Runs the per-file requests, two at a time, in the order the files were chosen. Stop aborts what is running and
 * starts nothing new; an answer is applied only if its request was not aborted, its row is still reading that
 * attempt, and the session is the one that sent it. Received rows are never rolled back.
 */
export function useRailOcr() {
  const [rows, setRows] = useState<OcrRow[]>([])
  const [cutOff, setCutOff] = useState(false)
  const rowsRef = useRef<OcrRow[]>([])
  const inflight = useRef(new Map<string, AbortController>())
  const alive = useRef(false)

  const commit = useCallback((next: OcrRow[]) => {
    rowsRef.current = next
    setRows(next)
  }, [])

  const abortAll = useCallback(() => {
    for (const controller of inflight.current.values()) controller.abort()
    inflight.current.clear()
  }, [])

  const pump = useCallback(
    function pump() {
      while (alive.current && inflight.current.size < OCR_CONCURRENCY) {
        const next = rowsRef.current.find((row) => row.status === 'waiting')
        const started = next && startRow(rowsRef.current, next.id)
        if (!next || !started) return
        commit(started)
        const attempt = next.attempt + 1
        const generation = getAuthGeneration()
        const controller = new AbortController()
        const release = trackPrivateOperation(controller)
        inflight.current.set(next.id, controller)
        const finish = (outcome: Parameters<typeof settleRow>[3]) => {
          release()
          if (inflight.current.get(next.id) === controller) inflight.current.delete(next.id)
          if (alive.current && !controller.signal.aborted && generation === getAuthGeneration())
            commit(settleRow(rowsRef.current, next.id, attempt, outcome))
          pump()
        }
        void (async () => {
          try {
            const base64 = await fileToBase64(next.file)
            if (controller.signal.aborted) return finish({ status: 'failed' })
            const result = await readRailTicket(base64, { signal: controller.signal })
            finish({ candidates: result.candidates })
          } catch (error) {
            finish({ status: statusForFailure(error) })
          }
        })()
      }
    },
    [commit],
  )

  useEffect(() => {
    alive.current = true
    const reset = () => {
      abortAll()
      commit([])
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      alive.current = false
      window.removeEventListener('kuuki:identity-reset', reset)
      abortAll()
    }
  }, [abortAll, commit])

  const add = useCallback(
    (files: File[]) => {
      setCutOff(files.length > OCR_MAX_FILES)
      commit([...rowsRef.current, ...files.slice(0, OCR_MAX_FILES).map(newRow)])
      pump()
    },
    [commit, pump],
  )
  const stop = useCallback(() => {
    abortAll()
    commit(stopRows(rowsRef.current))
  }, [abortAll, commit])
  const retry = useCallback(
    (id: string) => {
      commit(retryRow(rowsRef.current, id))
      pump()
    },
    [commit, pump],
  )
  const remove = useCallback(
    (id: string) => {
      inflight.current.get(id)?.abort()
      inflight.current.delete(id)
      commit(rowsRef.current.filter((row) => row.id !== id))
      pump()
    },
    [commit, pump],
  )
  const edit = useCallback(
    (previewId: string, patch: Partial<Preview>) =>
      commit(patchPreview(rowsRef.current, previewId, patch)),
    [commit],
  )
  const added = useCallback(
    (ids: ReadonlySet<string>) => commit(markAdded(rowsRef.current, ids)),
    [commit],
  )

  const busy = rows.some((row) => row.status === 'waiting' || row.status === 'reading')
  return { rows, cutOff, busy, add, stop, retry, remove, edit, added }
}
