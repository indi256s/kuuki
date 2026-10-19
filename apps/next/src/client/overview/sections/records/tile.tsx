'use client'
import { formatDuration } from '../../../../lib/format'
import { IsoFigure } from '../../iso/iso-figure'
import { foldedMap, mapPin } from '../../iso/map'
import { useFigure } from '../../iso/use-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import '../cookie.css'
import '../../iso/map.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, payload, locale } = useOverview()
  const lead = scope?.records.status === 'ready' ? scope.records.value.longest : null
  const origin = lead ? payload?.refs.airports[lead.origin] : undefined
  const destination = lead ? payload?.refs.airports[lead.destination] : undefined
  // The map at rest: the headline route pinned, unlit until the tile is touched.
  const figure = useFigure(
    span,
    `${lead?.origin}|${lead?.destination}|${origin?.lat}|${origin?.lon}|${destination?.lat}|${destination?.lon}`,
    (k) =>
      foldedMap(
        mapPin(lead?.origin ?? '', origin),
        mapPin(lead?.destination ?? '', destination),
        k,
      ),
  )
  if (!lead) return <p>—</p>
  const route = `${lead.origin} → ${lead.destination}`
  const detail =
    lead.durationMinutes === null
      ? route
      : `${route} · ${formatDuration(locale, lead.durationMinutes)}`
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
