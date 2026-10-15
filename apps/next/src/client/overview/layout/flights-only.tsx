'use client'

import { useOverview } from '../store/overview-context'
import { S, t } from '../copy'

/** Under Всё with ground data, every chapter below the globe is still about flights; one muted line says so above them. */
export function FlightsOnly() {
  const { payload, scope, locale } = useOverview()
  if (!payload || payload.ground.length === 0 || scope?.figures.scope !== 'all') return null
  return <p className="ov3-flights-only">{t(S.flightsOnly, locale)}</p>
}
