'use client'
import { useOverview } from '../../store/overview-context'
import { copy, types } from '../rankings/display'
import './fleet.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.fleet.status !== 'ready') return <p>—</p>
  const data = scope.fleet.value
  return <div><div className="ov3-body-preview" aria-hidden="true">{data.bodies.map(row => <i key={row.key} style={{ flexGrow: row.flights, background: `var(--cat-maker-${row.maker})` }} />)}</div><strong>{data.topFamily ? `${data.topFamily.family} ×${data.topFamily.flights}` : '—'}</strong><p>{copy(locale, 'Most flown type', 'Самый частый тип')} · {types(locale, data.familyCount)}</p></div>
}
