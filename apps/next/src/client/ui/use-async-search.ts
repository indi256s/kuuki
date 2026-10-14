'use client'
import { useEffect, useState } from 'react'

export type AsyncSearch<T> =
  /** Query shorter than `minChars`: nothing was asked. */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; results: T[] }
  | { status: 'error' }

type Settled<T> = { query: string; attempt: number; outcome: 'ready' | 'error'; results: T[] }

/**
 * Debounced, abortable search whose answer always belongs to the query on screen. A response for an older query
 * (or an older retry) is never shown, even when the search function ignores its signal: the state is keyed by
 * the query it answered, so a stale entry simply does not match.
 */
export function useAsyncSearch<T>(
  query: string,
  search: (query: string, signal: AbortSignal) => Promise<T[]>,
  { minChars = 2, delayMs = 250 }: { minChars?: number; delayMs?: number } = {},
): { state: AsyncSearch<T>; retry: () => void } {
  const trimmed = query.trim()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const active = trimmed.length >= minChars

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      search(trimmed, controller.signal).then(
        (results) => {
          if (!controller.signal.aborted)
            setSettled({ query: trimmed, attempt, outcome: 'ready', results })
        },
        () => {
          if (!controller.signal.aborted)
            setSettled({ query: trimmed, attempt, outcome: 'error', results: [] })
        },
      )
    }, delayMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // `search` is deliberately not a dependency: a new closure each render must not restart the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, attempt, active, delayMs])

  let state: AsyncSearch<T>
  if (!active) state = { status: 'idle' }
  else if (settled && settled.query === trimmed && settled.attempt === attempt)
    state =
      settled.outcome === 'ready'
        ? { status: 'ready', results: settled.results }
        : { status: 'error' }
  else state = { status: 'loading' }
  return { state, retry: () => setAttempt((n) => n + 1) }
}
