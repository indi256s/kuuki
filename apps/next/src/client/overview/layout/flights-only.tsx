'use client'

import { useOverview } from '../store/overview-context'
import { S, t } from '../copy'

/** Under Всё with ground data, every chapter is still about flights; this muted note says so in its header. */
export function FlightsOnly({ id, className }: { id?: string; className?: string }) {
  const { payload, scope, locale } = useOverview()
  if (!payload || payload.ground.length === 0 || scope?.figures.scope !== 'all') return null
  return (
    <span id={id} className={className ?? 'ov3-flights-only'}>
      {t(S.flightsOnly, locale)}
    </span>
  )
}
