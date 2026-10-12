'use client'

import { useState } from 'react'
import { useChapter } from './chapter-context'

type State<K> = { reading: K | null; picked: boolean; headline: K | null }

/**
 * The reading a chapter's hero and figure share: the headline until the member picks another. It goes back to the headline,
 * without animating, when the chapter stops being the open one, when the headline changes and when the reading is no longer
 * one of `keys` (a filter removed it). A new pick replaces the reading; nothing queues.
 */
export function useReading<K extends string>(keys: readonly K[], headline: K | null) {
  const { active } = useChapter()
  const [state, setState] = useState<State<K>>({ reading: headline, picked: false, headline })
  const fresh = (): State<K> => ({ reading: headline, picked: false, headline })
  const atHeadline = state.reading === headline
  const stale =
    state.headline !== headline ||
    (!active && !(atHeadline && !state.picked)) ||
    (!atHeadline && state.reading !== null && !keys.includes(state.reading))
  let current = state
  if (stale) {
    current = fresh()
    setState(current)
  }
  return {
    reading: current.reading,
    isHeadline: current.reading === headline,
    /** True only after a pick since mount or the last reset; the hero rolls its value then and not before. */
    picked: current.picked,
    pick: (key: K) => setState((old) => ({ ...old, reading: key, picked: true })),
    /** Steps through `keys` in order and wraps: the figure button. */
    next: () =>
      setState((old) => {
        const at = old.reading === null ? -1 : keys.indexOf(old.reading)
        const key = keys[(at + 1) % keys.length]
        return key === undefined ? old : { ...old, reading: key, picked: true }
      }),
    reset: () => setState(fresh()),
  }
}
