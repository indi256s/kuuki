'use client'

import { useState } from 'react'
import { defineChart } from '@tanstack/charts'
import { polar, radialBarRadius, radialArc, radialText, focusGroupAngle } from '@tanstack/charts/polar'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { SegmentedControl } from '../../../ui/segmented-control'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { Below, copy, filterLabel, flights, percent } from '../rankings/display'
import './clock.css'

export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  const [mode, setMode] = useState<'departures' | 'arrivals'>('departures')
  if (!scope || !all) return null
  const gate = scope.clock
  if (gate.status === 'below') return <Below id="clock" gate={gate} fix="times" />
  const data = gate.value, baseline = all.clock.status === 'ready' ? all.clock.value : data
  const rows = mode === 'departures' ? data.byHour : data.arrByHour
  const ghosts = mode === 'departures' ? baseline.byHour : baseline.arrByHour
  const peak = mode === 'departures' ? data.peakHour : data.arrPeakHour
  const max = Math.max(1, ...ghosts.map(row => row.flights))
  const scales = {
    angle: { scale: scaleBand<string>().padding(0.14).domain(rows.map(row => row.key)) },
    radius: { scale: scaleLinear().domain([0, max]), range: [52, (context: { radius: number }) => context.radius] as const },
    clock: { channel: 'angle' as const, scale: scaleLinear().domain([0, 24]) },
    center: { channel: 'radius' as const, scale: scaleLinear().domain([0, 1]), range: [0, 1] as const },
  }
  const definition = defineChart({ marks: [
    decorative(polar({ inset: 26, scales, marks: [
      radialArc([{ start: 22 / 24 * Math.PI * 2, end: (24 + 6) / 24 * Math.PI * 2 }], { startAngle: 'start', endAngle: 'end', innerRadius: 41, outerRadius: 47, fill: 'var(--surface-inset)', key: () => 'night' }),
      radialBarRadius(ghosts, { angle: 'key', radius: 'flights', radius1: 0, key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1 }),
      radialText([0, 6, 12, 18, 22].map(hour => ({ hour, label: String(hour).padStart(2, '0') })), { angle: 'hour', angleScale: 'clock', radius: max, radiusOffset: 14, text: 'label', fontSize: 12, fill: 'var(--text-muted)' }),
      radialText([{ label: peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—' }], { angle: 0, angleScale: 'clock', radius: 0, radiusScale: 'center', text: 'label', fontSize: 22, fill: 'var(--text)', dy: -4 }),
      radialText([{ label: copy(locale, 'busiest', 'чаще всего') }], { angle: 0, angleScale: 'clock', radius: 0, radiusScale: 'center', text: 'label', fontSize: 13, fill: 'var(--text-muted)', dy: 16 }),
    ] })),
    polar({ inset: 26, scales, marks: [radialBarRadius(rows, { angle: 'key', radius: 'flights', radius1: 0, key: 'key', fill: row => row.hour === peak?.hour ? 'var(--mark-1)' : 'var(--mark-2)', cornerRadius: 1.5 })] }),
  ], scales: { x: null, y: null }, focus: focusGroupAngle })
  const pick = (hour: number) => { if (isCurrent()) actions.add(mode === 'departures' ? 'depHours' : 'arrHours', hour) }
  const title = copy(locale, mode === 'departures' ? 'Local departure time' : 'Local arrival time', mode === 'departures' ? 'Местное время вылета' : 'Местное время прилёта')
  return <div className="ov3-clock" data-span={span}><SegmentedControl value={mode} onChange={setMode} label={copy(locale, 'Clock', 'Часы')} options={[{ value: 'departures', label: copy(locale, 'Departures', 'Вылеты') }, { value: 'arrivals', label: copy(locale, 'Arrivals', 'Прилёты') }]} />
    <div className="ov3-clock-dial"><LazyChart height={364} label={title}>{inView => <KuukiChart key={mode} definition={definition} height={300} inView={inView} ariaLabel={title} onPick={point => { if ('flights' in point.datum) pick(point.datum.hour) }} actions={point => 'flights' in point.datum ? [{ label: filterLabel(locale), run: () => pick(point.datum.hour) }] : []} tip={points => { const row = points[0].datum; return <span>{'flights' in row ? `${row.key}:00–${row.key}:59 · ${flights(locale, row.flights)}` : title}</span> }} table={{ caption: title, columns: [{ key: 'key', label: copy(locale, 'Hour', 'Час') }, { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true }], rows }} />}</LazyChart></div>
    <p>{title} · {mode === 'departures' ? data.withDepartureTime : data.withArrivalTime} {copy(locale, 'of', 'из')} {data.total} {copy(locale, 'flights', 'перелётов')}</p>
    <div className="ov3-clock-stats"><p><strong>{percent(data.beforeNoonShare)}</strong> {copy(locale, 'departures before noon', 'вылетов до полудня')}</p><p><strong>{flights(locale, data.redEyes)}</strong> · {copy(locale, 'red-eye', 'ночные')} · 22:00–06:00</p></div>
  </div>
}
