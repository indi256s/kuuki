'use client'
import { IsoFigure } from '../../iso/iso-figure'
import { puzzle } from '../../iso/puzzle'
import { useFigure } from '../../iso/use-figure'
import type { TileSpan } from '../../mobile/tiles'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import { TOTAL, byFlights, continentName, type ContinentId } from './continents'
import '../cookie.css'
import '../../iso/puzzle.css'

export function Tile({ span }: { span: TileSpan }) {
  const { scope, locale } = useOverview()
  const data = scope?.continents.status === 'ready' ? scope.continents.value : null
  const bits = (data?.rows ?? []).map((row) => (row.flights > 0 ? 1 : 0)).join('')
  // The tray at rest: nothing lifted or lit, and no label (too small to read at tile size).
  const figure = useFigure(span, bits, (k) =>
    puzzle(k, {
      flown: Object.fromEntries(
        (data?.rows ?? []).map((row) => [row.id, row.flights > 0]),
      ) as Record<ContinentId, boolean>,
      lit: null,
      label: '',
    }),
  )
  if (!data) return <p>—</p>
  const lead = byFlights(data.rows)[0]
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-puzzle" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">{number(locale, data.flown)}</strong>
        <p className="ov3-cookie-label">
          {copy(locale, `of ${TOTAL} continents`, `из ${TOTAL} континентов`)}
        </p>
        {lead && (
          <p className="ov3-cookie-detail">
            {copy(
              locale,
              `${continentName(lead.id, locale)} most`,
              `Чаще всего — ${continentName(lead.id, locale)}`,
            )}
          </p>
        )}
      </div>
    </div>
  )
}
