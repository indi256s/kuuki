'use client'
// Progressive mounting for long lists (spec D3 fallback). The server and the hydrating render show the first `initial`
// items; the rest mount after hydration in interruptible transitions of `chunk` items, so a 1,000-flight Journal is
// interactive after 60 rows instead of after all of them. Later changes that grow the list a lot (clearing a filter)
// grow from what is already mounted the same way; a sort or a small change renders at once.
import { startTransition, useEffect, useState } from 'react'

export const INITIAL_ROWS = 60
export const ROW_CHUNK = 150

type State = { count: number; target: number }

/** How many of `target` items to render now. Deterministic on the first render, so server and client markup match. */
export function useProgressiveCount(target: number, initial = INITIAL_ROWS, chunk = ROW_CHUNK): number {
  const [state, setState] = useState<State>(() => ({ count: Math.min(target, initial), target }))
  let current = state
  if (state.target !== target) {
    // Shrinking or a small growth shows everything at once; a large growth continues from what is mounted.
    const count = target <= state.count || target - state.count <= chunk ? target : Math.max(state.count, initial)
    current = { count, target }
    setState(current)
  }
  useEffect(() => {
    if (state.count >= state.target) return
    const timer = window.setTimeout(() => {
      startTransition(() => setState(old => old.target === state.target ? { ...old, count: Math.min(old.target, old.count + chunk) } : old))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, chunk])
  return Math.min(current.count, target)
}
