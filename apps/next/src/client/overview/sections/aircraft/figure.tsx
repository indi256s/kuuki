'use client'

import { useMemo } from 'react'
import { hangars } from '../../iso/hangars'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import { shareText, type ShedPlan } from './model'
import '../../iso/hangars.css'

const key = (plan: ShedPlan) =>
  `${plan.blank}|${plan.sheds.map((shed) => `${shed.key}:${shed.name}:${shed.share}`).join(',')}`

/** The labels the sheds print: shares, or a dash while there is nothing to share out. */
export const labelOf = (plan: ShedPlan) => (share: number) => (plan.blank ? '—' : shareText(share))

/**
 * The Aircraft card's hangars in the card's figure box (figure-box.ts), drawn at the k that fits this journal's sheds.
 * `lit` is the shed key to light, or null; `picked` enables the 150ms crossfade (hangars.css). The sheds never move.
 */
export function HangarsFigure({
  plan,
  lit,
  picked,
}: {
  plan: ShedPlan
  lit: string | null
  picked: boolean
}) {
  const shape = key(plan)
  const k = useFigureK(shape, (k) =>
    hangars(k, { sheds: plan.sheds, lit: null, shareLabel: labelOf(plan) }),
  )
  const figure = useMemo(
    () =>
      hangars(k, { sheds: plan.sheds, lit: plan.blank ? null : lit, shareLabel: labelOf(plan) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `plan` is rebuilt every render; its sheds are the key.
    [k, shape, lit],
  )
  return (
    <div className="iso-hangars-host" data-picked={picked || undefined}>
      <IsoFigure figure={figure} className="iso-hangars" />
    </div>
  )
}
