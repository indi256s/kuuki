'use client'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import { RouteSketch } from './route-sketch'
import './records.css'
export function Tile() {
  const { scope, locale } = useOverview()
  const lead = scope?.records.status === 'ready' ? scope.records.value.longest : null
  if (!lead) return <p>—</p>
  return <div><RouteSketch /><strong>{lead ? `${number(locale, lead.value)} ${copy(locale, 'km', 'км')}` : '—'}</strong><p>{copy(locale, 'Longest', 'Самый длинный')}{lead ? ` · ${lead.origin} → ${lead.destination}` : ''}</p></div>
}
