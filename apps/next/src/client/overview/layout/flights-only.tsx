'use client'

import { useOverview } from '../store/overview-context'
import { S, t } from '../copy'

export function FlightsOnly() {
  const { payload, scope, locale } = useOverview()
  if (!payload || payload.ground.length === 0 || scope?.figures.scope !== 'all') return null
  return <p className="ov3-flights-only">{t(S.flightsOnly, locale)}</p>
}
