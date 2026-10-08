'use client'
import { useOverview } from '../../store/overview-context'
import { referenceLabels } from '../../labels'
import { copy } from './display'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope) return null
  const rows = scope.rankings.airlines.slice(0, 3), top = rows[0], route = scope.rankings.routes[0]
  return <div className="ov3-rankings-tile"><div className="ov3-mini-bars" aria-hidden="true">{rows.map(row => <div key={row.key}><span>{row.key}</span><i style={{ width: `${top ? row.count / top.count * 100 : 0}%` }} /></div>)}</div><strong>{top ? `${referenceLabels(locale).airline(top.key)} ×${top.count}` : '—'}</strong><p>{copy(locale, 'Top airline', 'Главная авиакомпания')}{route ? ` · ${route.key} ×${route.count}` : ''}</p></div>
}
