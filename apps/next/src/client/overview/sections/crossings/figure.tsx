'use client'

import { useEffect, useMemo, useState } from 'react'
import { CONTINENT_IDS, puzzle, type ContinentId } from '../../iso/puzzle'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import '../../iso/puzzle.css'

const LIFT_MS = 120

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
