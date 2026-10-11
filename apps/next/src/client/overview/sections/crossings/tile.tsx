'use client'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import { useGlobeFigure } from './figure'
import '../cookie.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.crossings.status === 'ready' ? scope.crossings.value : null
  const figure = useGlobeFigure(span, data)
  if (!data) return <p>—</p>
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-globe" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {number(locale, data.clockShiftHours)} {copy(locale, 'h', 'ч')}
        </strong>
        <p className="ov3-cookie-label">{copy(locale, 'Clocks shifted', 'Сдвиг часов')}</p>
        <p className="ov3-cookie-detail">
          {data.equator} {copy(locale, 'equator', 'экватор')} · {data.arcticCircle}{' '}
          {copy(locale, 'Arctic Circle', 'полярный круг')}
        </p>
      </div>
    </div>
  )
}
