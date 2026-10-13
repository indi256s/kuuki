'use client'
import { hangars } from '../../iso/hangars'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigure } from '../../iso/use-figure'
import { useOverview } from '../../store/overview-context'
import { CoverageNote, copy } from '../rankings/display'
import { makerName } from '../manufacturers/section'
import { labelOf } from './figure'
import { makerRows, planSheds, shareText } from './model'
import '../cookie.css'
import '../../iso/hangars.css'

export function Tile() {
  const { scope, locale } = useOverview()
  const data = scope?.makers.status === 'ready' ? scope.makers.value : null
  const rows = data ? makerRows(data).rows : []
  const plan = planSheds(rows, (key) => makerName(key, locale), locale)
  const top = rows.find((row) => row.key !== 'unknown')
  // The hangars at rest with the headline maker lit; nothing moves in a tile.
  const lit = top && !plan.blank ? plan.shedOf(top.key) : null
  const figure = useFigure(
    'full',
    `${lit}|${plan.sheds.map((shed) => `${shed.key}:${shed.name}:${shed.share}`).join(',')}`,
    (k) => hangars(k, { sheds: plan.sheds, lit, shareLabel: labelOf(plan) }),
  )
  if (!scope || !top || plan.blank) return <p>—</p>
  const others = rows
    .filter((row) => row.key !== top.key && row.key !== 'unknown')
    .slice(0, 2)
    .map((row) => `${makerName(row.key, locale)} ${shareText(row.share)}`)
    .join(', ')
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-hangars" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {shareText(top.share)} {makerName(top.key, locale)}
        </strong>
        <p className="ov3-cookie-label ov3-cookie-full">
          {copy(locale, 'Most flown maker', 'Самый частый производитель')}
        </p>
        {others ? <p className="ov3-cookie-detail">{others}</p> : null}
        <CoverageNote
          have={scope.coverage.typed}
          total={scope.coverage.total}
          en="Based on {n} of {m} flights with an aircraft"
          ru="По {n} из {m} перелётов с самолётом"
        />
      </div>
    </div>
  )
}
