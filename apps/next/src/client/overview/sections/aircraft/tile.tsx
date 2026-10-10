'use client'
import { useMemo } from 'react'
import { fleet } from '../../iso/fleet'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import { CoverageNote, copy, number, types } from '../rankings/display'
import '../cookie.css'
import '../../iso/fleet.css'
export function Tile() {
  const { scope, payload, locale } = useOverview()
  const data = scope?.fleet.status === 'ready' ? scope.fleet.value : null
  const figure = useMemo(
    () =>
      fleet(
        (data?.topTypes ?? []).map(({ key }) => ({
          icao: key,
          body: payload?.refs.aircraft[key]?.type ?? null,
        })),
        145,
      ),
    [data, payload],
  )
  if (!scope || scope.fleet.status !== 'ready' || scope.makers.status !== 'ready' || !data)
    return <p>—</p>
  const top = data.topTypes[0]
  return (
    <div className="ov3-cookie">
      <div className="ov3-cookie-figure">
        <IsoFigure figure={figure} className="iso-fleet" />
      </div>
      <div className="ov3-cookie-text">
        <strong className="ov3-cookie-value">
          {top ? `${top.key} ×${number(locale, top.flights)}` : '—'}
        </strong>
        <p className="ov3-cookie-label ov3-cookie-full">
          {copy(locale, 'Most flown type', 'Самый частый тип')}
        </p>
        <p className="ov3-cookie-label ov3-cookie-half">
          {copy(locale, 'Most flown', 'Самый частый')} · {types(locale, data.types)}
        </p>
        <p className="ov3-cookie-detail">
          {top && (payload?.refs.aircraft[top.key]?.name ?? top.key)} · {types(locale, data.types)}
        </p>
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
