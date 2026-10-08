'use client'

import { defineChart, rect, text } from '@tanstack/charts'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { Below, copy, filterLabel, number } from '../rankings/display'
import './crossings.css'

export function CrossingDots({ count }: { count: number }) {
  return <div className="ov3-crossing-dots" aria-hidden="true">{Array.from({ length: Math.min(12, count) }, (_, i) => <i key={i} />)}{count > 12 && <span>+{count - 12}</span>}</div>
}
export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  if (!scope || !all) return null
  const gate = scope.crossings
  if (gate.status === 'below') return <Below id="crossings" gate={gate} />
  const data = gate.value, baseline = all.crossings.status === 'ready' ? all.crossings.value : data
  const years = baseline.shiftByYear.map(row => row.year)
  const rows = baseline.shiftByYear.map(base => data.shiftByYear.find(row => row.year === base.year) ?? { ...base, forward: 0, back: 0, flights: 0 }).map((row, i) => ({ ...row, x1: i + 0.18, x2: i + 0.82, xm: i + 0.5, negative: -row.back }))
  const ghosts = baseline.shiftByYear.map((row, i) => ({ ...row, x1: i + 0.18, x2: i + 0.82, negative: -row.back }))
  const definition = defineChart({ marks: [
    decorative(rect(ghosts, { x1: 'x1', x2: 'x2', y1: () => 0, y2: 'forward', key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1 })),
    decorative(rect(ghosts, { x1: 'x1', x2: 'x2', y1: 'negative', y2: () => 0, key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1 })),
    rect(rows.filter(row => row.forward > 0), { x1: 'x1', x2: 'x2', y1: () => 0, y2: 'forward', key: 'key', fill: 'var(--mark-1)', radius: 3 }),
    rect(rows.filter(row => row.back > 0), { x1: 'x1', x2: 'x2', y1: 'negative', y2: () => 0, key: 'key', fill: 'var(--mark-2)', radius: 3 }),
    decorative(text(rows, { x: 'xm', y: 'forward', text: row => row.flights === 0 ? '–' : row.forward ? `+${number(locale, row.forward)}` : '', fill: 'var(--text)', fontSize: 11, dy: -8 })),
    decorative(text(rows.filter(row => row.back > 0), { x: 'xm', y: 'negative', text: row => `−${number(locale, row.back)}`, fill: 'var(--text)', fontSize: 11, dy: 14 })),
  ], scales: { x: { scale: scaleLinear().domain([0, Math.max(1, years.length)]), axis: { line: false, ticks: { values: rows.map(row => row.xm), format: value => String(rows[Math.floor(Number(value))]?.year ?? '') } } }, y: { scale: scaleLinear().domain([-Math.max(1, ...ghosts.map(row => row.back)) * 1.3, Math.max(1, ...ghosts.map(row => row.forward)) * 1.3]), axis: false } }, margin: { top: 20, bottom: 30, left: 8, right: 8 } })
  const pick = (year: number) => { if (isCurrent()) actions.setPeriod({ years: [year] }) }
  const route = (record: typeof data.lastEquator) => record ? `${record.origin} → ${record.destination}` : copy(locale, 'No crossing recorded', 'Пересечений пока нет')
  const hit = data.offsets.filter(row => row.hit).length
  const caption = copy(locale, 'Clock change per year · hours', 'Сдвиг часов по годам · часы')
  return <div className="ov3-crossings" data-span={span}><div className="ov3-crossing-tiles">
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Clocks shifted', 'Сдвиг часов')}</p><div className="ov3-crossing-figure"><strong>{number(locale, data.clockShiftHours)} {copy(locale, 'h', 'ч')}</strong><div className="ov3-shift-split" aria-hidden="true"><i style={{ flexGrow: data.forwardHours }} /><i style={{ flexGrow: data.backHours }} /></div></div><small>{number(locale, data.forwardHours)} {copy(locale, 'h forward', 'ч вперёд')} · {number(locale, data.backHours)} {copy(locale, 'h back', 'ч назад')}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Time zones', 'Часовые пояса')}</p><div className="ov3-crossing-figure"><strong>{hit}</strong><div className="ov3-offset-ticks" aria-hidden="true">{data.offsets.map(row => <i key={row.key} style={{ background: row.hit ? 'var(--mark-1)' : 'var(--mark-ghost)' }} />)}</div></div><small>{hit} {copy(locale, 'of 24 hourly UTC offsets', 'из 24 часовых смещений UTC')}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Equator', 'Экватор')}</p><div className="ov3-crossing-figure"><strong>{data.equator}</strong><CrossingDots count={data.equator} /></div><small>{route(data.lastEquator)}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Arctic Circle', 'Полярный круг')}</p><div className="ov3-crossing-figure"><strong>{data.arcticCircle}</strong><CrossingDots count={data.arcticCircle} /></div><small>{route(data.lastArctic)}</small></div>
  </div><p className="ov3-chart-caption">{caption}</p><LazyChart height={284} label={caption}>{inView => <KuukiChart definition={definition} height={220} inView={inView} ariaLabel={caption} onPick={point => pick(point.datum.year)} actions={point => [{ label: filterLabel(locale), run: () => pick(point.datum.year) }]} tip={points => <span>{points[0].datum.year} · +{number(locale, points[0].datum.forward)} / −{number(locale, points[0].datum.back)} {copy(locale, 'h', 'ч')}</span>} table={{ caption, columns: [{ key: 'year', label: copy(locale, 'Year', 'Год') }, { key: 'forward', label: copy(locale, 'Forward', 'Вперёд'), numeric: true }, { key: 'back', label: copy(locale, 'Back', 'Назад'), numeric: true }, { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true }], rows: rows.map(row => ({ year: row.year, forward: row.flights ? row.forward : '–', back: row.flights ? row.back : '–', flights: row.flights })) }} />}</LazyChart></div>
}
