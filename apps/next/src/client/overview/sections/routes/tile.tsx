'use client'
import { routeArrow } from '@kuuki/shared/overview/filter'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number, percent } from '../rankings/display'
import { forms } from '../../copy'
import { formatCount } from '../../../../lib/format'
import { usePassFigure } from './figure'
import '../cookie.css'
import '../../iso/passes.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.routes.status === 'ready' ? scope.routes.value : null
  // The headline route is the most-flown one, the same row the sheet's hero and figure open on.
  const top = scope?.rankings.routes[0] ?? null
  const figure = usePassFigure(span, data?.repeatShare ?? 0, top ? routeArrow(top.key) : '')
  if (!data) return <p>—</p>
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-passes" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {formatCount(locale, data.distinct, forms.routes)}
        </strong>
        <p className="ov3-cookie-label">
          {percent(data.repeatShare)}{' '}
          {copy(locale, 'on repeat routes', 'на повторяющихся маршрутах')}
        </p>
        {data.top && (
          <p className="ov3-cookie-detail">
            {routeArrow(data.top.key)} ×{number(locale, data.top.count)}
          </p>
        )}
      </div>
    </div>
  )
}
