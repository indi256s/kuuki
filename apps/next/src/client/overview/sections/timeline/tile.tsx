'use client'
import { useOverview } from '../../store/overview-context'
import { copy, number } from '../rankings/display'
import './timeline.css'
const SAMPLES = 24
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope || scope.rhythm.status !== 'ready') return <p>—</p>
  const { odometer } = scope.rhythm.value, total = odometer.at(-1)?.km ?? 0
  const picked = odometer.length > SAMPLES ? Array.from({ length: SAMPLES }, (_, index) => odometer[Math.round(index * (odometer.length - 1) / (SAMPLES - 1))]) : odometer
  const line = picked.map((row, index) => `${index / Math.max(1, picked.length - 1) * 100},${total ? 100 - row.km / total * 100 : 100}`).join(' ')
  return <div><svg className="ov3-line-mini" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{picked.length > 1 && <polyline points={line} fill="none" stroke="var(--mark-1)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}</svg><strong>{number(locale, Math.round(total))} {copy(locale, 'km', 'км')}</strong><p>{copy(locale, 'Distance so far', 'Пройдено всего')}</p></div>
}
