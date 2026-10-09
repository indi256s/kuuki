'use client'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import './crossings.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.crossings.status !== 'ready') return <p>—</p>
  const data = scope.crossings.value,
    max = Math.max(1, ...data.shiftByYear.map((row) => Math.max(row.forward, row.back)))
  return (
    <div>
      <div className="ov3-shift-mini" aria-hidden="true">
        {data.shiftByYear.map((row) => (
          <span key={row.key}>
            <i style={{ height: (row.forward / max) * 24 }} />
            <i style={{ height: (row.back / max) * 24 }} />
          </span>
        ))}
      </div>
      <strong>
        {number(locale, data.clockShiftHours)} {copy(locale, 'h shifted', 'ч сдвига')}
      </strong>
      <p>
        {data.equator} {copy(locale, 'equator', 'экватор')} · {data.arcticCircle}{' '}
        {copy(locale, 'Arctic Circle', 'полярный круг')}
      </p>
    </div>
  )
}
