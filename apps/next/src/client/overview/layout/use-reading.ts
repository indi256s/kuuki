'use client'

import { useState } from 'react'
import { useOverview } from '../store/overview-context'
import { useChapter } from './chapter-context'

type State<K> = {
  reading: K | null
  picked: boolean
  headline: K | null
  filter: string
  restored: string | null
}

export function useReading<K extends string>(
  keys: readonly K[],
  headline: K | null,
  initial?: { key: K | null; token: string },
) {
  const { active } = useChapter()
  const filter = JSON.stringify(useOverview().filter)
  const fresh = (): State<K> => ({
    reading: headline,
    picked: false,
    headline,
    filter,
    restored: null,
  })
  const [state, setState] = useState<State<K>>(fresh)
  const atHeadline = state.reading === headline
  const stale =
    state.headline !== headline ||
    state.filter !== filter ||
    (!active && !(atHeadline && !state.picked)) ||
    (!atHeadline && state.reading !== null && !keys.includes(state.reading))
  let current = state
  if (active && initial && keys.length > 0 && state.restored !== initial.token) {
    current = {
      reading: initial.key !== null && keys.includes(initial.key) ? initial.key : headline,
      picked: false,
      headline,
      filter,
      restored: initial.token,
    }
    setState(current)
  } else if (stale) {
    current = { ...fresh(), restored: state.restored }
    setState(current)
  }
  return {
    reading: current.reading,
    isHeadline: current.reading === headline,
    picked: current.picked,
    pick: (key: K) => setState((old) => ({ ...old, reading: key, picked: true })),
    next: () =>
      setState((old) => {
        const at = old.reading === null ? -1 : keys.indexOf(old.reading)
        const key = keys[(at + 1) % keys.length]
        return key === undefined ? old : { ...old, reading: key, picked: true }
      }),
    reset: () => setState({ ...fresh(), restored: current.restored }),
  }
}
