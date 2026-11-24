'use client'

import { useMemo } from 'react'
import { hangars } from '../../iso/hangars'
import { fleet } from '../../iso/fleet'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureBox, useFigureK } from '../../layout/figure-box'
import { shareText, type ShedPlan } from './model'
import '../../iso/hangars.css'
import '../../iso/fleet.css'

const key = (plan: ShedPlan) =>
  `${plan.blank}|${plan.sheds.map((shed) => `${shed.key}:${shed.name}:${shed.share}`).join(',')}`

export const labelOf = (plan: ShedPlan) => (share: number) => (plan.blank ? '—' : shareText(share))

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

export function FleetFigure({ icao, body }: { icao: string; body: string | null }) {
  const { width } = useFigureBox()
  const figure = useMemo(() => fleet([{ icao, body }], width, 'lineup'), [icao, body, width])
  return <IsoFigure figure={figure} className="iso-fleet iso-aircraft-type" />
}
