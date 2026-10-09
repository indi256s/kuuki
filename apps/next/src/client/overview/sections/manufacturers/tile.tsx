'use client'
import { useOverview } from '../../store/overview-context'
import { MakerSwatch } from '../../../ui/category-mark'
import { copy, percent } from '../rankings/display'
import './manufacturers.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.makers.status !== 'ready') return <p>—</p>
  const data = scope.makers.value,
    leader = data.leader
  const name = (key: string) =>
    key === 'unknown'
      ? copy(locale, 'Unknown', 'Неизвестно')
      : key === 'other'
        ? copy(locale, 'Other', 'Другие')
        : key === 'atr'
          ? 'ATR'
          : key[0].toUpperCase() + key.slice(1)
  return (
    <div>
      {leader && (
        <strong>
          {percent(leader.share)} <MakerSwatch maker={leader.key} /> {name(leader.key)}
        </strong>
      )}
      <div className="ov3-maker-stack" aria-hidden="true">
        {data.rows.map((row) => (
          <i
            key={row.key}
            style={{
              width: percent(data.totals.flights ? row.flights / data.totals.flights : 0),
              background: `var(--cat-maker-${row.key})`,
            }}
          />
        ))}
      </div>
      <p>
        {data.rows
          .filter((row) => row.flights > 0)
          .map((row) => `${name(row.key)} ${row.flights}`)
          .join(' · ')}
      </p>
    </div>
  )
}
