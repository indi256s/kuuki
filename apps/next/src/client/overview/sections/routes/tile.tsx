'use client'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number, percent } from '../rankings/display'
import { routeArrow } from '@kuuki/shared/overview/filter'
import { forms } from '../../copy'
import { formatCount } from '../../../../lib/format'
import { usePassFigure } from './figure'
import '../cookie.css'
import '../../iso/passes.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.routes.status === 'ready' ? scope.routes.value : null
  const figure = usePassFigure(span, data)
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
          {percent(data.repeatShare)} {copy(locale, 'repeat', 'повторов')}
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
