'use client'
import { startTransition, useEffect, useState } from 'react'

export const INITIAL_ROWS = 60
export const ROW_CHUNK = 150

type State = { count: number; target: number }

export function useProgressiveCount(
  target: number,
  initial = INITIAL_ROWS,
  chunk = ROW_CHUNK,
): number {
  const [state, setState] = useState<State>(() => ({ count: Math.min(target, initial), target }))
  let current = state
  if (state.target !== target) {
    const count =
      target <= state.count || target - state.count <= chunk
        ? target
        : Math.max(state.count, initial)
    current = { count, target }
    setState(current)
  }
  useEffect(() => {
    if (state.count >= state.target) return
    const timer = window.setTimeout(() => {
      startTransition(() =>
        setState((old) =>
          old.target === state.target
            ? { ...old, count: Math.min(old.target, old.count + chunk) }
            : old,
        ),
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, chunk])
  return Math.min(current.count, target)
}
