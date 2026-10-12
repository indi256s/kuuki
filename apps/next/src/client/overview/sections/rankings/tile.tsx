'use client'
import { IsoFigure } from '../../iso/iso-figure'
import { gateSign } from '../../iso/gate-sign'
import { useFigure } from '../../iso/use-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { referenceLabels } from '../../labels'
import { copy, flights, number } from './display'
import '../cookie.css'
import '../../iso/gate-sign.css'
export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const top = scope?.rankings.airlines[0]
  // The sign at rest, showing the top airline's code; with no airline on file it stays dim.
  const code = top?.key ?? ''
  const note = top ? `#1 ×${number(locale, top.count)}` : ''
  const figure = useFigure(span, `${code}|${note}`, (k) => gateSign(k, { code, note }))
  if (!scope) return null
  const name = top ? referenceLabels(locale).airline(top.key) : null
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure" data-blank={top ? undefined : ''}>
        <IsoFigure figure={figure} className="iso-gate" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">{top ? flights(locale, top.count) : '—'}</strong>
        <p className="ov3-cookie-label ov3-cookie-full">
          {copy(locale, 'Top airline', 'Главная авиакомпания')}
        </p>
        <p className="ov3-cookie-label ov3-cookie-half">
          {copy(locale, 'Top', 'Главная')} · {top?.key ?? '—'}
        </p>
        {name && <p className="ov3-cookie-detail">{name}</p>}
      </div>
    </div>
  )
}
