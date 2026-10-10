'use client'
import { useMemo } from 'react'
import { formatDuration } from '../../../../lib/format'
import { IsoFigure } from '../../iso/iso-figure'
import { foldedMap } from '../../iso/map'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import '../cookie.css'
import '../../iso/map.css'
export function Tile() {
  const { scope, locale } = useOverview()
  const lead = scope?.records.status === 'ready' ? scope.records.value.longest : null
  const figure = useMemo(
    () => (lead ? foldedMap(lead.origin, lead.destination, 0.56) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lead` is rebuilt every render; its route is the key.
    [lead?.origin, lead?.destination],
  )
  if (!lead || !figure) return <p>—</p>
  const route = `${lead.origin} → ${lead.destination}`
  const detail =
    lead.durationMinutes === null
      ? route
      : `${route} · ${lead.durationApproximate ? '≈ ' : ''}${formatDuration(locale, lead.durationMinutes)}`
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-map" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {`${number(locale, lead.value)} ${copy(locale, 'km', 'км')}`}
        </strong>
        <p className="ov3-cookie-label ov3-cookie-full">
          {copy(locale, 'Longest flight', 'Самый длинный перелёт')}
        </p>
        <p className="ov3-cookie-label ov3-cookie-half">
          {copy(locale, 'Longest', 'Самый длинный')} · {route}
        </p>
        <p className="ov3-cookie-detail">{detail}</p>
      </div>
    </div>
  )
}
