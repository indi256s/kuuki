'use client'

import { useState } from 'react'
import { defineChart, cell, lineY, areaY, text } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { decorative } from '@tanstack/charts/mark/decorative'
import { d3Curve } from '@tanstack/charts/d3/shape'
import { brushX, type BrushXChange, type BrushRange } from '@tanstack/charts/interaction/brush'
import { controlledSignal } from '@tanstack/charts/interaction/signal'
import { scaleUtc } from 'd3-scale'
import { curveStepAfter } from 'd3-shape'
import { SegmentedControl } from '../../../ui/segmented-control'
import { MonthRange } from '../../../ui/month-range'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import { useOpenFlight } from '../../store/open-flight'
import type { Span } from '../registry'
import { Below, copy, filterLabel, number, flights } from '../rankings/display'
import { heatBucket, monthStart, monthKey } from './helpers'
import './rhythm.css'

type Metric = 'flights' | 'distanceKm' | 'durationMinutes'
export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, aggregate, ownerKey, locale, actions, isCurrent } = useOverview()
  const openFlight = useOpenFlight()
  const [metric, setMetric] = useState<Metric>('flights')
  const [showAll, setShowAll] = useState(false)
  if (!scope || !all || !payload) return null
  const gate = scope.rhythm
  if (gate.status === 'below') return <Below id="rhythm" gate={gate} />
  const data = gate.value, baseline = all.rhythm.status === 'ready' ? all.rhythm.value : data
  const years = showAll ? baseline.years : baseline.years.slice(0, 6)
  const today = payload.generatedAt.slice(0, 7)
  const rows = data.cells.filter(row => years.includes(row.year)), ghosts = baseline.cells.filter(row => years.includes(row.year))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const monthName = (month: number, short = false) => new Intl.DateTimeFormat(locale, { month: short ? 'short' : 'long', timeZone: 'UTC' }).format(monthStart(`2000-${String(month).padStart(2, '0')}`))
  const pickMonth = (key: string) => { if (isCurrent()) actions.setPeriod({ from: key, to: key }) }
  const max = baseline.max[metric]
  const grid = defineChart({ marks: [
    decorative(cell(ghosts, { x: row => String(row.month), y: row => String(row.year), key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1, inset: 3, radius: 6 })),
    ...([0, 1, 2, 3, 4] as const).map(bucket => cell(rows.filter(row => row.key <= today && heatBucket(row[metric], max) === bucket), { x: row => String(row.month), y: row => String(row.year), key: 'key', fill: `var(--heat-${bucket})`, radius: 6, inset: 3 })),
    decorative(cell(rows.filter(row => row.key > today), { x: row => String(row.month), y: row => String(row.year), key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1, inset: 3, radius: 6, states: [{ when: () => true, style: { strokeDasharray: '3 3' } }] })),
    decorative(text(rows.filter(row => row.key > today), { x: row => String(row.month), y: row => String(row.year), text: () => '–', fill: 'var(--mark-ghost)' })),
    decorative(text(rows.filter(row => row.key <= today), { x: row => String(row.month), y: row => String(row.year), text: row => number(locale, metric === 'durationMinutes' ? row[metric] / 60 : row[metric]), fill: 'var(--text)', fontSize: 10 })),
  ], scales: { x: { scale: scaleBand<string>().domain(months), axis: { line: false, ticks: { format: value => monthName(Number(value), true) }, tickLabels: { fontSize: 10 } } }, y: { scale: scaleBand<string>().domain(years.map(String)), axis: { line: false } } }, margin: { top: 8, left: 40, right: 8, bottom: 30 } })
  const baselineMonths = [...new Set(baseline.cells.filter(row => row.key <= today).map(row => row.key))].sort()
  const min = baselineMonths[0], maxMonth = baselineMonths.at(-1)!
  const period = filter.period && 'from' in filter.period ? filter.period : { from: min, to: maxMonth }
  const clampMonth = (key: string) => key < min ? min : key > maxMonth ? maxMonth : key
  const range: BrushRange<Date> = { start: monthStart(clampMonth(period.from)), end: monthStart(clampMonth(period.to)) }
  const points = data.odometer.map(row => ({ ...row, instant: new Date(`${row.date.length === 7 ? `${row.date}-01` : row.date}T00:00:00Z`) }))
  const ghostPoints = baseline.odometer.map(row => ({ ...row, instant: new Date(`${row.date.length === 7 ? `${row.date}-01` : row.date}T00:00:00Z`) }))
  const setRange = (next: { from: string; to: string } | null) => { if (isCurrent()) actions.setPeriod(next) }
  const commit = (next: BrushRange<Date>) => setRange({ from: monthKey(next.start), to: monthKey(next.end) })
  const odometer = defineChart({ marks: [
    decorative(lineY(ghostPoints, { x: 'instant', y: 'km', key: 'key', stroke: 'var(--mark-ghost)', strokeWidth: 1, curve: d3Curve(curveStepAfter) })),
    decorative(areaY(points, { x: 'instant', y1: 0, y2: 'km', key: 'key', fill: 'var(--mark-1)', fillOpacity: 0.08, curve: d3Curve(curveStepAfter) })),
    lineY(points, { x: 'instant', y: 'km', key: 'key', stroke: 'var(--mark-1)', strokeWidth: 2, curve: d3Curve(curveStepAfter) }),
  ], scales: { x: { scale: scaleUtc().domain([monthStart(min), new Date(`${maxMonth}-28T00:00:00Z`)]), axis: { line: false, ticks: { format: value => value instanceof Date ? String(value.getUTCFullYear()) : String(value) } } }, y: { scale: scaleLinear().domain([0, Math.max(1, ghostPoints.at(-1)?.km ?? 0)]), axis: { line: false } } },
    controls: [brushX({ range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(range, (next, context) => { if (context.reason.type === 'commit') commit(next) }), values: baselineMonths.map(monthStart), handleSize: 6, ariaLabel: copy(locale, 'Date range', 'Период'), startAriaLabel: copy(locale, 'Range start', 'Начало периода'), endAriaLabel: copy(locale, 'Range end', 'Конец периода'), format: value => new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(value), selectionStyle: { fill: 'var(--mark-1)', fillOpacity: 0.12 }, handleStyle: { fill: 'var(--mark-1)' } })],
    focus: 'nearest-x', margin: { top: 16, left: 55, right: 12, bottom: 30 },
  })
  const gridCaption = copy(locale, 'Flights by month', 'Перелёты по месяцам')
  const odoCaption = copy(locale, 'Cumulative distance', 'Накопленное расстояние')
  return <div className="ov3-rhythm" data-span={span}><SegmentedControl value={metric} onChange={setMetric} label={copy(locale, 'Rhythm metric', 'Показатель ритма')} options={[{ value: 'flights', label: copy(locale, 'Flights', 'Перелёты') }, { value: 'distanceKm', label: copy(locale, 'Distance', 'Расстояние') }, { value: 'durationMinutes', label: copy(locale, 'Hours', 'Часы') }]} />
    <LazyChart height={years.length * 36 + 112} label={gridCaption}>{inView => <KuukiChart definition={grid} height={years.length * 36 + 48} inView={inView} ariaLabel={gridCaption} onPick={point => pickMonth(point.datum.key)} actions={point => [{ label: filterLabel(locale), run: () => pickMonth(point.datum.key) }]} tip={points => <span>{points[0].datum.key} · {number(locale, metric === 'durationMinutes' ? points[0].datum[metric] / 60 : points[0].datum[metric])} {metric === 'flights' ? copy(locale, 'flights', 'перелётов') : metric === 'distanceKm' ? copy(locale, 'km', 'км') : copy(locale, 'h', 'ч')}</span>} table={{ caption: gridCaption, columns: [{ key: 'key', label: copy(locale, 'Month', 'Месяц') }, { key: 'value', label: copy(locale, 'Value', 'Значение'), numeric: true }], rows: rows.map(row => ({ key: row.key, value: metric === 'durationMinutes' ? row[metric] / 60 : row[metric] })) }} />}</LazyChart>
    <div className="ov3-heat-year-totals">{scope.figures.byYear.filter(row => years.includes(row.year)).map(row => <span key={row.key}>{row.year}: {flights(locale, row.flights)}</span>)}</div>
    <p className="ov3-chart-caption">{copy(locale, 'Share of the maximum month', 'Доля от максимума за месяц')}: {number(locale, metric === 'durationMinutes' ? max / 60 : max)}</p><div className="ov3-heat-legend">{[0, 1, 2, 3, 4].map(bucket => <span key={bucket}><i style={{ background: `var(--heat-${bucket})` }} />{bucket === 0 ? '0' : `${bucket * 25}%`}</span>)}</div>
    {baseline.years.length > 6 && <button className="ov3-rhythm-more" onClick={() => setShowAll(!showAll)}>{showAll ? copy(locale, 'Show latest 6 years', 'Последние 6 лет') : `${copy(locale, 'Show all years', 'Все годы')}, ${baseline.years.at(-1)}–${baseline.years[6]}`}</button>}
    <div className="ov3-rhythm-stats"><p><strong>{data.busiestMonthOfYear ? monthName(data.busiestMonthOfYear.month) : '—'}</strong>{copy(locale, 'Busiest month', 'Самый активный месяц')}</p><p><strong>{data.longestGap ? `${data.longestGap.months} ${copy(locale, 'mo', 'мес.')}` : '—'}</strong>{copy(locale, 'Longest gap', 'Самый длинный перерыв')}{data.longestGap ? ` · ${data.longestGap.from}–${data.longestGap.to}` : ''}</p></div>
    <p className="ov3-chart-caption">{odoCaption} · {copy(locale, 'km', 'км')}</p><div className="ov3-odometer"><LazyChart height={244} label={odoCaption}>{inView => <KuukiChart definition={odometer} height={180} inView={inView} ariaLabel={odoCaption} onPick={point => pickMonth(point.datum.date.slice(0, 7))} actions={point => [{ label: filterLabel(locale), run: () => pickMonth(point.datum.date.slice(0, 7)) }, ...(!aggregate && ownerKey !== 'dev' && point.datum.flightId !== null ? [{ label: copy(locale, 'Open flight', 'Открыть перелёт'), run: () => openFlight(point.datum.flightId!) }] : [])]} tip={points => <span>{points[0].datum.date} · {number(locale, points[0].datum.km)} {copy(locale, 'km', 'км')}</span>} table={{ caption: odoCaption, columns: [{ key: 'date', label: copy(locale, 'Date', 'Дата') }, { key: 'km', label: copy(locale, 'Km', 'Км'), numeric: true }], rows: data.odometer.map(row => ({ date: row.date, km: row.km })) }} />}</LazyChart></div>
    <MonthRange from={filter.period && 'from' in filter.period ? filter.period.from : ''} to={filter.period && 'from' in filter.period ? filter.period.to : ''} min={min} max={maxMonth} onChange={setRange} onClear={() => setRange(null)} locale={locale} />
  </div>
}
