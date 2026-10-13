'use client'

import { useEffect, useMemo, useState } from 'react'
import { CONTINENT_IDS, puzzle, type ContinentId } from '../../iso/puzzle'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import '../../iso/puzzle.css'

/** How long the lift lasts, in ms: puzzle.css's `--dur-press`. The piece seats when it is over. */
const LIFT_MS = 120

/**
 * True for the lift phase of a pick: from the render that lights a new continent until `LIFT_MS` later. `animate` is false for everything
 * that is not a pick (first render, a swipe, a filter, reduced motion), which never lifts. A new pick starts its own lift and the old piece
 * seats from wherever it is: nothing queues.
 */
function useLift(lit: ContinentId | null, animate: boolean) {
  const [state, setState] = useState({ lit, up: false })
  if (state.lit !== lit) setState({ lit, up: animate && lit !== null })
  useEffect(() => {
    if (!state.up) return
    const timer = setTimeout(() => setState((old) => ({ ...old, up: false })), LIFT_MS)
    return () => clearTimeout(timer)
  }, [state])
  return state.lit === lit && state.up
}

/**
 * The jigsaw tray in the chapter card's figure box (figure-box.ts). `lit` is the picked continent: a flown one lifts 4px and seats in the accent,
 * one not flown outlines its socket (puzzle.css). `picked` is `useReading`'s flag: only a pick moves anything.
 */
export function ContinentsFigure({
  flown,
  lit,
  label,
  picked,
}: {
  flown: Record<ContinentId, boolean>
  lit: ContinentId | null
  label: string
  picked: boolean
}) {
  // The tray is the same size whatever is flown; only the label's width could change it.
  const k = useFigureK(label, (k) => puzzle(k, { flown, lit: null, label }))
  const bits = CONTINENT_IDS.map((id) => (flown[id] ? 1 : 0)).join('')
  const figure = useMemo(
    () => puzzle(k, { flown, lit, label }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `flown` is rebuilt every render; its bits are the key.
    [k, bits, lit, label],
  )
  const up = useLift(lit, picked)
  return (
    <div className="iso-puzzle-host" data-pick={picked || undefined} data-up={up || undefined}>
      <IsoFigure figure={figure} className="iso-puzzle" />
    </div>
  )
}
