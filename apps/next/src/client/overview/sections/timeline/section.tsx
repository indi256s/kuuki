'use client'

import { useState } from 'react'
import { overviewSeries } from '@kuuki/shared/overview/series'
import { DAY_MS, dayToEpoch, epochToDay, periodDays } from '@kuuki/shared/overview/range'
import { SegmentedControl } from '../../../ui/segmented-control'
import { MonthRange } from '../../../ui/month-range'
import { Button } from '../../../ui/button'
import { KuukiChart } from '../../charts/kuuki-chart'
import { ArcLine } from '../../charts/arc-line'
import { ArcBrush } from '../../charts/arc-brush'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import { useOpenFlight } from '../../store/open-flight'
import type { Span } from '../registry'
import { Below, copy, filterLabel, number } from '../rankings/display'
import { landmarkSummary, lapCrossings, nextLandmark, progressPercent, spreadLabels, withinReach, type Landmark } from './landmarks'
import './timeline.css'

// Plot insets in CSS pixels shared by the line, its axis labels and the brush below it; the plot fills whatever width the card measures.
const PLOT_LEFT = 55, PLOT_RIGHT = 12
// Vertical layout in CSS pixels: a strip above the plot for lap labels, the plot, then the date axis. The svg height (plot plus axes) follows its width.
const STRIP = 32, AXIS = 30
const chartHeight = (width: number) => Math.round(Math.min(320, Math.max(180, width * .3)))
export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, aggregate, ownerKey, locale, actions, isCurrent } = useOverview()
  const openFlight = useOpenFlight()
  const [cumulativeMetric, setCumulativeMetric] = useState<'km' | 'flights'>('km')
  if (!scope || !all || !payload) return null
  const gate = scope.rhythm
  if (gate.status === 'below') return <Below id="timeline" gate={gate} />
  const data = gate.value, baseline = all.rhythm.status === 'ready' ? all.rhythm.value : data
  const today = payload.generatedAt.slice(0, 7)
  const pickMonth = (key: string) => { if (isCurrent()) actions.setPeriod({ from: key, to: key }) }
  const pickDay = (day: string) => { if (isCurrent()) actions.setPeriod({ from: day, to: day }) }
  const series = overviewSeries(payload, filter), allSeries = overviewSeries(payload, {})
  const baselineMonths = [...new Set(baseline.cells.filter(row => row.key <= today).map(row => row.key))].sort()
  const min = baselineMonths[0], maxMonth = baselineMonths.at(-1)!
  const boundsDays = periodDays({ from: min, to: maxMonth })!
  const bounds: readonly [number, number] = [dayToEpoch(boundsDays.from)!, dayToEpoch(boundsDays.to)!]
  const period = filter.period && 'from' in filter.period ? filter.period : { from: min, to: maxMonth }
  const rangeDays = periodDays(period) ?? boundsDays
  const legacyPoints = data.odometer.map(row => ({ ...row, flights: 0 }))
  const legacyGhosts = baseline.odometer.map(row => ({ ...row, flights: 0 }))
  const dated = series.dailyAvailable ? series.cumulative : legacyPoints
  const baselineDated = allSeries.dailyAvailable ? allSeries.cumulative : legacyGhosts
  const valueKey = series.dailyAvailable ? cumulativeMetric : 'km'
  const linePoints = dated.map(row => ({ key: row.key, datum: row, label: `${row.date} · ${number(locale, row[valueKey])}`, x: dayToEpoch(row.date.length === 7 ? `${row.date}-01` : row.date)!, y: row[valueKey] }))
  const ghostPoints = baselineDated.map(row => ({ x: dayToEpoch(row.date.length === 7 ? `${row.date}-01` : row.date)!, y: row[valueKey] }))
  // Landmarks (equator laps, the Moon) only annotate distance. The reference line widens the scale only when it is within reach of the total.
  const total = valueKey === 'km' ? linePoints.at(-1)?.y ?? 0 : 0
  const crossings = valueKey === 'km' ? lapCrossings(linePoints) : []
  const landmark = valueKey === 'km' ? nextLandmark(total) : null
  const reference = landmark && withinReach(total, landmark) ? landmark : null
  const yMax = Math.max(1, reference?.km ?? 0, ...ghostPoints.map(point => point.y), ...linePoints.map(point => point.y))
  const landmarkNote = valueKey === 'km' && total > 0 && !reference ? landmarkSentence(locale, total) : null
  const lapKey = crossings.length > 0 ? copy(locale, '1×, 2×… mark laps around the equator.', 'Метки 1×, 2×… — круги вокруг экватора.') : null
  const setRange = (next: { from: string; to: string } | null) => { if (isCurrent()) actions.setPeriod(next) }
  const pickLine = (date: string) => series.dailyAvailable ? pickDay(date) : pickMonth(date.slice(0, 7))
  const odoCaption = valueKey === 'km' ? copy(locale, 'Cumulative distance', 'Накопленное расстояние') : copy(locale, 'Cumulative flights', 'Накопленные перелёты')
  const unit = valueKey === 'km' ? copy(locale, 'km', 'км') : copy(locale, 'flights', 'перелётов')
  const active = !!filter.period
  return <div className="ov3-timeline" data-span={span}>
    {series.dailyAvailable && <SegmentedControl value={cumulativeMetric} onChange={setCumulativeMetric} label={copy(locale, 'Cumulative metric', 'Накопленный показатель')} options={[{ value: 'km', label: copy(locale, 'Distance', 'Расстояние') }, { value: 'flights', label: copy(locale, 'Flights', 'Перелёты') }]} />}
    <h3 className="ov3-chart-caption">{odoCaption} · {unit}</h3>{lapKey && <p className="ov3-timeline-key">{lapKey}</p>}<div className="ov3-odometer"><LazyChart height={244} label={odoCaption}>{inView => <KuukiChart points={linePoints} height={chartHeight} inView={inView} ariaLabel={odoCaption} onPick={point => pickLine(point.datum.date)} actions={point => [{ label: filterLabel(locale), run: () => pickLine(point.datum.date) }, ...(!aggregate && ownerKey !== 'dev' && point.datum.flightId !== null ? [{ label: copy(locale, 'Open flight', 'Открыть перелёт'), run: () => openFlight(point.datum.flightId!) }] : [])]} tip={points => <span>{points[0].label} {unit}</span>} table={{ caption: odoCaption, columns: [{ key: 'date', label: copy(locale, 'Date', 'Дата') }, { key: 'value', label: unit, numeric: true }], rows: dated.map(row => ({ date: row.date, value: row[valueKey] })) }}>{(mark, { width, height }) => { const plotWidth = Math.max(40, width - PLOT_LEFT - PLOT_RIGHT), plotHeight = Math.max(40, height - STRIP - AXIS); return <>
      <g transform={`translate(${PLOT_LEFT},${STRIP})`}><ArcLine points={linePoints} ghost={ghostPoints} xDomain={bounds} yDomain={[0, yMax]} height={plotHeight} width={plotWidth} stepAfter area mark={mark} />
        <Landmarks crossings={crossings} reference={reference} total={total} bounds={bounds} yMax={yMax} width={plotWidth} height={plotHeight} locale={locale} /></g>
      {[0, .5, 1].map(ratio => <text key={ratio} x={PLOT_LEFT - 7} y={STRIP + plotHeight - ratio * plotHeight} textAnchor="end" fill="var(--text-muted)" fontSize={12} data-sans>{number(locale, yMax * ratio)}</text>)}
      {[bounds[0], bounds[1]].map((epoch, index) => <text key={index} x={index ? PLOT_LEFT + plotWidth : PLOT_LEFT} y={STRIP + plotHeight + 23} textAnchor={index ? 'end' : 'start'} fill="var(--text-muted)" fontSize={12} data-sans>{new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(epoch)}</text>)}
    </>}}</KuukiChart>}</LazyChart></div>
    {landmarkNote && <p className="ov3-timeline-landmarks">{landmarkNote}</p>}
    {series.dailyAvailable ? <ExactRange key={`${ownerKey}|${JSON.stringify(filter)}|${bounds.join()}`} from={rangeDays.from} to={rangeDays.to} bounds={bounds} points={ghostPoints} locale={locale} active={active} onChange={setRange} /> : <>
      <p>{copy(locale, 'Daily detail is unavailable in this older monthly summary.', 'В старой месячной сводке нет данных по дням.')}</p>
      <MonthRange from={period.from.slice(0, 7)} to={period.to.slice(0, 7)} min={min} max={maxMonth} onChange={setRange} onClear={() => setRange(null)} locale={locale} />
    </>}
  </div>
}

const LAP_LABEL_DX = 48
const percentOf = (value: number) => `${value}%`
function landmarkSentence(locale: 'en' | 'ru', total: number) {
  const { laps, moon } = landmarkSummary(total)
  const lapText = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(laps)
  const back = moon?.kind === 'moonBack'
  return copy(locale,
    `${number(locale, total)} km. ${lapText}× around the equator${moon ? `, ${percentOf(moon.percent)} of the way to the Moon${back ? ' and back' : ''}` : ''}.`,
    `${number(locale, total)} км. Экватор: ${lapText}×${moon ? `, до Луны${back ? ' и обратно' : ''} пройдено ${percentOf(moon.percent)}` : ''}.`)
}
function referenceLabel(locale: 'en' | 'ru', landmark: Landmark, total: number) {
  const done = percentOf(progressPercent(total, landmark.km))
  if (landmark.kind === 'lap') return `${landmark.laps}× · ${done}`
  return `${landmark.kind === 'moon' ? copy(locale, 'Moon', 'Луна') : copy(locale, 'Moon and back', 'Луна и обратно')} · ${done}`
}
// Decorative marks drawn in the plot's own coordinates; the text note under the chart is the accessible version.
function Landmarks({ crossings, reference, total, bounds, yMax, width, height, locale }: { crossings: ReturnType<typeof lapCrossings>; reference: Landmark | null; total: number; bounds: readonly [number, number]; yMax: number; width: number; height: number; locale: 'en' | 'ru' }) {
  const px = (epoch: number) => (epoch - bounds[0]) / (bounds[1] - bounds[0] || 1) * width
  const py = (value: number) => height - value / yMax * height
  const placed = crossings.map(row => ({ lap: row.lap, x: px(row.x), y: py(row.y) }))
  // Lap labels share one strip above the plot, so only their horizontal spacing matters; a dotted guide drops from each label to its notch.
  const shown = spreadLabels(placed.map(mark => ({ x: mark.x, y: 0 })), LAP_LABEL_DX, 1)
  return <g aria-hidden="true" pointerEvents="none" fill="var(--text-muted)" fontSize={12} data-sans>
    {reference && <>
      <line x1={0} x2={width} y1={py(reference.km)} y2={py(reference.km)} stroke="var(--text-muted)" strokeOpacity={0.45} strokeDasharray="2 4" />
      <text x={width} y={py(reference.km) - 5} textAnchor="end">{referenceLabel(locale, reference, total)}</text>
    </>}
    {placed.map((mark, index) => <g key={mark.lap}>
      <line x1={mark.x - 4} x2={mark.x + 4} y1={mark.y} y2={mark.y} stroke="var(--text)" strokeWidth={2} />
      {shown[index] && <>
        <line x1={mark.x} x2={mark.x} y1={-STRIP + 18} y2={mark.y} stroke="var(--text-muted)" strokeOpacity={0.5} strokeDasharray="1 3" />
        <text x={mark.x} y={-STRIP + 14} textAnchor={mark.x < 14 ? 'start' : mark.x > width - 14 ? 'end' : 'middle'}>{mark.lap}×</text>
      </>}
    </g>)}
  </g>
}

type ExactRangeProps = { from: string; to: string; bounds: readonly [number, number]; points: readonly { x: number; y: number }[]; locale: 'en' | 'ru'; active: boolean; onChange: (range: { from: string; to: string } | null) => void }
// The brush is the page's period control; typed dates live in the Overview filter panel.
function ExactRange({ from, to, bounds, points, locale, active, onChange }: ExactRangeProps) {
  const [draft, setDraft] = useState({ from, to })
  const clamp = (value: number) => Math.max(bounds[0], Math.min(bounds[1], value))
  const value: readonly [number, number] = [clamp(dayToEpoch(draft.from) ?? dayToEpoch(from)!), clamp(dayToEpoch(draft.to) ?? dayToEpoch(to)!)]
  const commit = (range: readonly [number, number]) => onChange({ from: epochToDay(range[0])!, to: epochToDay(range[1])! })
  const date = (epoch: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(epoch)
  return <div className="ov3-timeline-range">
    <ArcBrush bounds={bounds} value={value} points={points} step={DAY_MS} inset={{ left: PLOT_LEFT, right: PLOT_RIGHT }} fromLabel={copy(locale, 'Range start', 'Начало периода')} toLabel={copy(locale, 'Range end', 'Конец периода')} onChange={range => setDraft({ from: epochToDay(range[0])!, to: epochToDay(range[1])! })} onCommit={commit} />
    <div className="ov3-timeline-period"><span>{date(value[0])} – {date(value[1])}</span>{active && <Button variant="ghost" dense onClick={() => onChange(null)}>{copy(locale, 'Clear range', 'Сбросить период')}</Button>}</div>
  </div>
}
