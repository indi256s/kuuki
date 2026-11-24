'use client'

import { useMemo, type CSSProperties } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import { stamper } from '../../iso/stamper'
import { reducedMotion } from '../../layout/drag-motion'
import type { Mark } from './marks'
import { useStamp } from './use-stamp'
import '../../iso/stamper.css'

const SIZING = { month: 0, flights: 0, monthLabel: '', flightsLabel: '' }
const CENTRE = 5
const none = ''

export function bandLabels(marks: readonly Mark[], at: number, wrap: boolean) {
  if (wrap && marks.length === 12) return marks.map((mark) => mark.band)
  const slots = Array.from({ length: 12 }, () => none)
  for (let step = -2; step <= 2; step++)
    slots[(CENTRE + step + 12) % 12] = marks[at + step]?.band ?? none
  return slots
}

export function stamperFigure(
  k: number,
  marks: readonly Mark[],
  at: number | null,
  print: number | null,
  wrap: boolean,
) {
  const index = at ?? 0,
    mark = at === null ? undefined : marks[at],
    printed = print === null ? undefined : marks[print]
  return stamper(k, {
    month: wrap && marks.length === 12 ? index : CENTRE,
    flights: 0,
    monthLabel: printed?.print ?? none,
    bandLabel: mark?.band ?? none,
    flightsLabel: printed?.flights ?? none,
    monthLabels: bandLabels(marks, index, wrap),
    ink: printed ? 0.9 : 0,
  })
}

export function RhythmStamper({
  marks,
  at,
  picked,
  wrap,
}: {
  marks: readonly Mark[]
  at: number | null
  picked: boolean
  wrap: boolean
}) {
  const stamp = useStamp(at ?? 0, picked && !reducedMotion(), marks.length, wrap)
  const k = useFigureK('', (k) => stamper(k, SIZING))
  const print = at === null ? null : Math.min(stamp.impression, marks.length - 1)
  const key = `${wrap}|${at}|${print}|${marks.map((mark) => `${mark.band}/${mark.print}/${mark.flights}`).join()}`
  const figure = useMemo(
    () => stamperFigure(k, marks, at, print, wrap),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `marks` is rebuilt every render; `key` names everything it holds.
    [k, key],
  )
  return (
    <div
      ref={stamp.host}
      className="iso-stamper-host"
      data-stamp={stamp.phase}
      style={{ '--roll-from': stamp.from } as CSSProperties}
    >
      <IsoFigure figure={figure} className="iso-stamper-pick" />
    </div>
  )
}
