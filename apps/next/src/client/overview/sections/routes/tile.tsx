'use client'
import { useOverview } from '../../store/overview-context'
import { copy, number, percent } from '../rankings/display'
import { routeArrow } from '@kuuki/shared/overview/filter'
import { forms } from '../../copy'
import { formatCount } from '../../../../lib/format'
import './routes.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.routes.status !== 'ready') return <p>—</p>
  const data = scope.routes.value,
    max = Math.max(1, ...data.byYear.map((row) => row.flights))
  return (
    <div>
      <div className="ov3-routes-mini" aria-hidden="true">
        {data.byYear.map((row) => (
          <i key={row.key} style={{ height: (row.flights / max) * 48 }} />
        ))}
      </div>
      <strong>{formatCount(locale, data.distinct, forms.routes)}</strong>
      <p>
        {percent(data.repeatShare)} {copy(locale, 'repeat', 'повторов')}
        {data.top ? ` · ${routeArrow(data.top.key)} ×${number(locale, data.top.count)}` : ''}
      </p>
    </div>
  )
}
