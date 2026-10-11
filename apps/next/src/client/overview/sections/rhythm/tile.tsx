'use client'
import { useMemo } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { fitK } from '../../iso/scene'
import { tape } from '../../iso/tape'
import { TILE_FIGURE_WIDTH, type TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { formatDistanceKm } from '../../../../lib/format'
import { copy } from '../rankings/display'
import { landmarkSummary } from '../timeline/landmarks'
import '../cookie.css'
import '../../iso/tape.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const total = scope?.figures.distanceKm ?? 0
  const label = formatDistanceKm(locale, total)
  const figure = useMemo(
    () =>
      tape(
        label,
        fitK(TILE_FIGURE_WIDTH[span], (k) => tape(label, k)),
      ),
    [label, span],
  )
  if (!scope || scope.rhythm.status !== 'ready') return <p>—</p>
  const { laps, moon } = landmarkSummary(total)
  const lapText = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(laps)
  const detail = moon
    ? copy(
        locale,
        `${moon.percent}% of the way to the Moon${moon.kind === 'moonBack' ? ' and back' : ''}`,
        `${moon.percent}% пути до Луны${moon.kind === 'moonBack' ? ' и обратно' : ''}`,
      )
    : copy(locale, `${lapText}× around the equator`, `Экватор: ${lapText}×`)
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-tape" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">{label}</strong>
        <p className="ov3-cookie-label">{copy(locale, 'Distance so far', 'Пройдено')}</p>
        <p className="ov3-cookie-detail">{detail}</p>
      </div>
    </div>
  )
}
