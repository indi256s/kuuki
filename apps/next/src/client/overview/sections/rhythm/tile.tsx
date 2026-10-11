'use client'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy } from '../rankings/display'
import { useCalendarFigure } from './figure'
import '../cookie.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.rhythm.status === 'ready' ? scope.rhythm.value : null
  const figure = useCalendarFigure(span, data, locale)
  if (!data) return <p>—</p>
  const busiest = data.busiestMonthOfYear
  const month = busiest
    ? new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        Date.UTC(2000, busiest.month - 1, 1),
      )
    : '—'
  const gap = data.longestGap
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-calendar" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">{month}</strong>
        <p className="ov3-cookie-label">{copy(locale, 'Busiest month', 'Самый активный месяц')}</p>
        {gap && (
          <p className="ov3-cookie-detail">
            {copy(locale, 'Longest gap', 'Самый длинный перерыв')} · {gap.months}{' '}
            {copy(locale, 'mo', 'мес.')}
          </p>
        )}
      </div>
    </div>
  )
}
