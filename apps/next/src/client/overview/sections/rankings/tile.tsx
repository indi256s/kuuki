'use client'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { referenceLabels } from '../../labels'
import { copy } from './display'
import { useBoardFigure } from './figure'
import '../cookie.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const figure = useBoardFigure(span, scope?.rankings.airlines ?? [])
  if (!scope) return null
  const top = scope.rankings.airlines[0],
    route = scope.rankings.routes[0]
  const routeText = route ? `${route.key.replace('-', ' → ')} ×${route.count}` : null
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-board" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {top ? `${referenceLabels(locale).airline(top.key)} ×${top.count}` : '—'}
        </strong>
        <p className="ov3-cookie-label">{copy(locale, 'Top airline', 'Главная авиакомпания')}</p>
        {routeText && <p className="ov3-cookie-detail">{routeText}</p>}
      </div>
    </div>
  )
}
