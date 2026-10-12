'use client'
import { IsoFigure } from '../../iso/iso-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useFigure } from '../../iso/use-figure'
import { monthName } from '../../page/scope-title'
import { useOverview } from '../../store/overview-context'
import { copy, flights } from '../rankings/display'
import { stamperFigure } from './figure'
import { monthMarks, monthTotals } from './marks'
import '../cookie.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.rhythm.status === 'ready' ? scope.rhythm.value : null
  const busiest = data?.busiestMonthOfYear ?? null
  const marks = monthMarks(monthTotals(data), locale)
  const at = busiest ? busiest.month - 1 : null
  // The stamper at rest on the headline month, its impression already printed.
  const figure = useFigure(
    span,
    `${locale}|${at}|${marks.map((mark) => mark.flights).join()}`,
    (k) => stamperFigure(k, marks, at, at, true),
  )
  if (!data) return <p>—</p>
  const gap = data.longestGap
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-stamper-tile" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {busiest ? monthName(locale, busiest.month) : '—'}
        </strong>
        <p className="ov3-cookie-label">
          {copy(locale, 'Busiest month', 'Самый активный месяц')}
          {busiest ? ` · ${flights(locale, busiest.flights)}` : ''}
        </p>
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
