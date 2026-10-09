'use client'

import { useSyncExternalStore } from 'react'
import { useOverview } from '../store/overview-context'
import { useOpenFlight } from '../store/open-flight'
import { Button } from '../../ui/button'
import { formatNumber } from '../../../lib/format'
import { t } from '../copy'
import { localDay, onThisDay } from './on-this-day'

const subscribeNever = () => () => {}
// A memory, not a stat: unfiltered rows, the owner's own flights only, nothing rendered without a match.
export function OnThisDayLine() {
  const { payload, aggregate, ownerKey, locale } = useOverview()
  const openFlight = useOpenFlight()
  // The user's local day exists only in the browser; the server snapshot is null, so hydration matches and the line appears right after.
  const today = useSyncExternalStore(
    subscribeNever,
    () => localDay(new Date()),
    () => null,
  )
  if (!payload || aggregate || payload.mode !== 'flights' || today === null) return null
  const memory = onThisDay(payload.rows, today)
  if (!memory) return null
  const lead = t({ en: `On this day, ${memory.year}`, ru: `В этот день, ${memory.year}` }, locale)
  const more =
    memory.more > 0
      ? ` · ${t({ en: `+${formatNumber(locale, memory.more)} more`, ru: `ещё ${formatNumber(locale, memory.more)}` }, locale)}`
      : ''
  const route = (
    <span className="ov3-otd-route">
      {memory.origin} → {memory.destination}
    </span>
  )
  const content = (
    <>
      {lead} · {route}
      {more}
    </>
  )
  if (ownerKey === 'dev') return <p className="ov3-otd">{content}</p>
  return (
    <Button
      variant="ghost"
      static
      className="ov3-otd"
      aria-label={`${t({ en: 'Open flight', ru: 'Открыть перелёт' }, locale)} · ${lead} · ${memory.origin} → ${memory.destination}${more}`}
      onClick={() => openFlight(memory.flightId)}
    >
      {content}
    </Button>
  )
}
