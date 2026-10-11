'use client'
import { useMemo } from 'react'
import { formatDuration } from '../../../../lib/format'
import { IsoFigure } from '../../iso/iso-figure'
import { fitK } from '../../iso/scene'
import { foldedMap, mapPin } from '../../iso/map'
import { TILE_FIGURE_WIDTH, type TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import '../cookie.css'
import '../../iso/map.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, payload, locale } = useOverview()
  const lead = scope?.records.status === 'ready' ? scope.records.value.longest : null
  const origin = lead ? payload?.refs.airports[lead.origin] : undefined
  const destination = lead ? payload?.refs.airports[lead.destination] : undefined
  const figure = useMemo(
    () => {
      if (!lead) return null
      const from = mapPin(lead.origin, origin),
        to = mapPin(lead.destination, destination)
      return foldedMap(
        from,
        to,
        fitK(TILE_FIGURE_WIDTH[span], (k) => foldedMap(from, to, k)),
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lead` and the refs are rebuilt every render; the route and its coordinates are the key.
    [
      lead?.origin,
      lead?.destination,
      origin?.lat,
      origin?.lon,
      destination?.lat,
      destination?.lon,
      span,
    ],
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
