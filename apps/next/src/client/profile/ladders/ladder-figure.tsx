import { useMemo, type CSSProperties } from 'react'
import { IsoFigure } from '../../overview/iso/iso-figure'
import { fitBox } from '../../overview/iso/scene'
import { LADDER_FIGURES } from './figures'
import type { LadderId, LadderLod } from './figures/types'
import './ladders.css'

const HERO = { width: 320, height: 200, maxK: 2.2 }
const THUMB = 56
export const STRIP_THUMB = 88

export type RungState = 'earned' | 'next' | 'later'

const fitOf = (ladder: LadderId, rung: number, lod: LadderLod, initials?: string, box = THUMB) => {
  const { build } = LADDER_FIGURES[ladder]
  return lod === 'hero'
    ? Math.min(
        HERO.maxK,
        fitBox(HERO.width, HERO.height, (k) => build(k, { rung, lod, initials })),
      )
    : fitBox(box, box, (k) => build(k, { rung, lod, initials }))
}

export function useStripK(ladder: LadderId, box = STRIP_THUMB) {
  return useMemo(() => {
    const { rungs } = LADDER_FIGURES[ladder]
    return Math.min(
      ...Array.from({ length: rungs }, (_, i) => fitOf(ladder, i + 1, 'thumb', undefined, box)),
    )
  }, [ladder, box])
}

export function LadderFigure({
  ladder,
  rung,
  size,
  state = 'earned',
  k,
  box,
  initials,
}: {
  ladder: LadderId
  rung: number
  size: LadderLod
  state?: RungState
  k?: number
  box?: number
  initials?: string
}) {
  const figure = useMemo(() => {
    const scale = k ?? fitOf(ladder, rung, size, initials, box)
    return LADDER_FIGURES[ladder].build(scale, { rung, lod: size, initials })
  }, [ladder, rung, size, k, box, initials])
  return (
    <span
      className="ladder-figure"
      data-size={size}
      data-state={state}
      style={box ? ({ '--ladder-box': `${box}px` } as CSSProperties) : undefined}
    >
      <IsoFigure figure={figure} />
    </span>
  )
}
