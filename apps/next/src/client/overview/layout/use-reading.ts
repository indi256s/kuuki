'use client'

import { useState } from 'react'
import { useOverview } from '../store/overview-context'
import { useChapter } from './chapter-context'

type State<K> = { reading: K | null; picked: boolean; headline: K | null; filter: string }

/**
 * The reading a chapter's hero and figure share: the headline until the member picks another. It goes back to the headline,
 * without animating, when the chapter stops being the open one, when the headline changes, when the filter changes and when
 * the reading is no longer one of `keys`. A new pick replaces the reading; nothing queues.
 */
export function useReading<K extends string>(keys: readonly K[], headline: K | null) {
  const { active } = useChapter()
  // Compared by value: the filter object can be rebuilt without changing (a prefs refresh).
  const filter = JSON.stringify(useOverview().filter)
  const fresh = (): State<K> => ({ reading: headline, picked: false, headline, filter })
  const [state, setState] = useState<State<K>>(fresh)
  const atHeadline = state.reading === headline
  const stale =
    state.headline !== headline ||
    state.filter !== filter ||
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
