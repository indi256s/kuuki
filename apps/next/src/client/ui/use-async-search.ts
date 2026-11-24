'use client'
import { useEffect, useState } from 'react'

export type AsyncSearch<T> =
  | { status: 'idle' }
  | { status: 'loading'; previous: T[] }
  | { status: 'ready'; results: T[] }
  | { status: 'error' }

type Settled<T> = { query: string; attempt: number; outcome: 'ready' | 'error'; results: T[] }

export function useAsyncSearch<T>(
  query: string,
  search: (query: string, signal: AbortSignal) => Promise<T[]>,
  { minChars = 2, delayMs = 250 }: { minChars?: number; delayMs?: number } = {},
): { state: AsyncSearch<T>; retry: () => void } {
  const trimmed = query.trim()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const active = trimmed.length >= minChars
  if (!active && settled !== null) setSettled(null)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, attempt, active, delayMs])

  let state: AsyncSearch<T>
  if (!active) state = { status: 'idle' }
  else if (settled && settled.query === trimmed && settled.attempt === attempt)
    state =
      settled.outcome === 'ready'
        ? { status: 'ready', results: settled.results }
        : { status: 'error' }
  else state = { status: 'loading', previous: settled?.outcome === 'ready' ? settled.results : [] }
  return { state, retry: () => setAttempt((n) => n + 1) }
}
