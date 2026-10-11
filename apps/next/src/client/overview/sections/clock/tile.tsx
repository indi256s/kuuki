'use client'
import { useMemo } from 'react'
import { formatDateOnly } from '../../../../lib/format'
import { IsoFigure } from '../../iso/iso-figure'
import { clock } from '../../iso/clock'
import { fitK } from '../../iso/scene'
import { TILE_FIGURE_WIDTH, type TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { CoverageNote, copy, flights } from '../rankings/display'
import { departures } from './departure'
import '../cookie.css'
import '../../iso/clock.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const found = scope && departures(scope)
  const earliest = found?.earliest,
    peak = found?.peak
  const time = found?.time ?? null
  const figure = useMemo(
    () =>
      clock(
        time ?? '--:--',
        fitK(TILE_FIGURE_WIDTH[span], (k) => clock(time ?? '--:--', k)),
      ),
    [time, span],
  )
  if (!scope) return null
  if (scope.clock.status !== 'ready')
    return <p>{copy(locale, 'Not enough times yet', 'Пока мало данных о времени')}</p>
  const data = scope.clock.value
  const busiest = copy(locale, 'Busiest hour', 'Самый частый час')
  const route = earliest ? `${earliest.origin} → ${earliest.destination}` : ''
  const caption = earliest
    ? copy(locale, `Earliest · ${route}`, `Самый ранний · ${route}`)
    : busiest
  const eyebrow = earliest ? copy(locale, 'Earliest departure', 'Самый ранний вылет') : busiest
  const detail = earliest
    ? `${route} · ${formatDateOnly(locale, earliest.date)}`
    : peak
      ? flights(locale, peak.flights)
      : null
  return (
    <div>
      <div className="ov3-cookie">
        <div className="ov3-cookie-figure">
          <IsoFigure figure={figure} className="iso-clock" />
        </div>
        <div className="ov3-cookie-text">
          <strong className="ov3-cookie-value">{time ?? '—'}</strong>
          {eyebrow === caption ? (
            <p className="ov3-cookie-label">{eyebrow}</p>
          ) : (
            <>
              <p className="ov3-cookie-label ov3-cookie-full">{eyebrow}</p>
              <p className="ov3-cookie-label ov3-cookie-half">{caption}</p>
            </>
          )}
          {detail && <p className="ov3-cookie-detail">{detail}</p>}
        </div>
      </div>
      <CoverageNote
        have={data.withDepartureTime}
        total={data.total}
        en="Based on {n} of {m} flights with departure times"
        ru="По {n} из {m} перелётов с временем вылета"
      />
    </div>
  )
}
