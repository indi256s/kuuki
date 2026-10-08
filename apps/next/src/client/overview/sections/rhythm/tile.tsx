'use client'
import { useOverview } from '../../store/overview-context'
import { copy, yearsCount } from '../rankings/display'
import { heatBucket, monthStart } from './helpers'
import './rhythm.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.rhythm.status !== 'ready') return <p>—</p>
  const data = scope.rhythm.value
  const month = data.busiestMonthOfYear ? new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(monthStart(`2000-${String(data.busiestMonthOfYear.month).padStart(2, '0')}`)) : '—'
  return <div><div className="ov3-heat-mini" aria-hidden="true">{data.cells.filter(row => data.years.slice(0, 6).includes(row.year)).map(row => <i key={row.key} style={{ background: `var(--heat-${heatBucket(row.flights, data.max.flights)})` }} />)}</div><strong>{month}</strong><p>{copy(locale, 'Busiest month', 'Самый активный месяц')} · {yearsCount(locale, data.years.length)}</p></div>
}
