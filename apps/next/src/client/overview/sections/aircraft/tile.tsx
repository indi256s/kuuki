'use client'
import { useOverview } from '../../store/overview-context'
import { CoverageNote, copy, percent, types } from '../rankings/display'
import { makerName } from '../manufacturers/section'
import '../fleet/fleet.css'
import '../manufacturers/manufacturers.css'
import './aircraft.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.fleet.status !== 'ready' || scope.makers.status !== 'ready') return <p>—</p>
  const fleet = scope.fleet.value,
    makers = scope.makers.value,
    leader = makers.leader
  return (
    <div>
      <div className="ov3-maker-stack" aria-hidden="true">
        {makers.rows.map((row) => (
          <i
            key={row.key}
            style={{
              width: percent(makers.totals.flights ? row.flights / makers.totals.flights : 0),
              background: `var(--cat-maker-${row.key})`,
            }}
          />
        ))}
      </div>
      <strong>
        {fleet.topFamily ? `${fleet.topFamily.family} ×${fleet.topFamily.flights}` : '—'}
      </strong>
      <p>
        {copy(locale, 'Most flown type', 'Самый частый тип')} · {types(locale, fleet.familyCount)}
        {leader && ` · ${percent(leader.share)} ${makerName(leader.key, locale)}`}
      </p>
      <CoverageNote
        have={scope.coverage.typed}
        total={scope.coverage.total}
        en="Based on {n} of {m} flights with an aircraft"
        ru="По {n} из {m} перелётов с самолётом"
      />
    </div>
  )
}
