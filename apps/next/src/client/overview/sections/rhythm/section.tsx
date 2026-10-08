'use client'

import { useState } from 'react'
import { overviewSeries } from '@kuuki/shared/overview/series'
import { DAY_MS, dayToEpoch, epochToDay, periodDays } from '@kuuki/shared/overview/range'
import { SegmentedControl } from '../../../ui/segmented-control'
import { MonthRange } from '../../../ui/month-range'
import { DateRangePicker } from '../../../ui/date-range-picker'
import { KuukiChart } from '../../charts/kuuki-chart'
import { ArcLine } from '../../charts/arc-line'
import { ArcBrush } from '../../charts/arc-brush'
import { ArcActivityHeatmap, activityPoints } from '../../charts/arc-activity-heatmap'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import { useOpenFlight } from '../../store/open-flight'
import type { Span } from '../registry'
import { Below, copy, filterLabel, number, flights } from '../rankings/display'
import { heatBucket, monthStart } from './helpers'
import './rhythm.css'

type Metric = 'flights' | 'distanceKm' | 'durationMinutes'
export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, aggregate, ownerKey, locale, actions, isCurrent } = useOverview()
  const openFlight = useOpenFlight()
  const [metric, setMetric] = useState<Metric>('flights')
  const [cumulativeMetric, setCumulativeMetric] = useState<'km' | 'flights'>('km')
  const [showAll, setShowAll] = useState(false)
  const [activityYear, setActivityYear] = useState<number | null>(null)
  if (!scope || !all || !payload) return null
  const gate = scope.rhythm
  if (gate.status === 'below') return <Below id="rhythm" gate={gate} />
  const data = gate.value, baseline = all.rhythm.status === 'ready' ? all.rhythm.value : data
  const years = showAll ? baseline.years : baseline.years.slice(0, 6)
  const today = payload.generatedAt.slice(0, 7)
  const rows = data.cells.filter(row => years.includes(row.year)), ghosts = baseline.cells.filter(row => years.includes(row.year))
  const monthName = (month: number, short = false) => new Intl.DateTimeFormat(locale, { month: short ? 'short' : 'long', timeZone: 'UTC' }).format(monthStart(`2000-${String(month).padStart(2, '0')}`))
  const pickMonth = (key: string) => { if (isCurrent()) actions.setPeriod({ from: key, to: key }) }
  const pickDay = (day: string) => { if (isCurrent()) actions.setPeriod({ from: day, to: day }) }
  const max = baseline.max[metric], gridHeight = years.length * 36 + 48
  const gridPoints = rows.filter(row => row.key <= today).map(row => ({ key: row.key, datum: row, label: `${row.key} · ${number(locale, metric === 'durationMinutes' ? row[metric] / 60 : row[metric])}` }))
  const cellX = (month: number) => 40 + (month - 1) * 46
  const cellY = (year: number) => 8 + years.indexOf(year) * 36
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
  const yMax = Math.max(1, ...ghostPoints.map(point => point.y), ...linePoints.map(point => point.y))
  const setRange = (next: { from: string; to: string } | null) => { if (isCurrent()) actions.setPeriod(next) }
  const pickLine = (date: string) => series.dailyAvailable ? pickDay(date) : pickMonth(date.slice(0, 7))
  const gridCaption = copy(locale, 'Flights by month', 'Перелёты по месяцам')
  const odoCaption = valueKey === 'km' ? copy(locale, 'Cumulative distance', 'Накопленное расстояние') : copy(locale, 'Cumulative flights', 'Накопленные перелёты')
  const unit = valueKey === 'km' ? copy(locale, 'km', 'км') : copy(locale, 'flights', 'перелётов')
  const selectedYear = activityYear !== null && baseline.years.includes(activityYear) ? activityYear : baseline.years[0]
  const days = activityPoints(selectedYear, series.daily, locale)
  const dailyCaption = copy(locale, 'Completed flights by day', 'Завершённые перелёты по дням')
  return <div className="ov3-rhythm" data-span={span}><SegmentedControl value={metric} onChange={setMetric} label={copy(locale, 'Rhythm metric', 'Показатель ритма')} options={[{ value: 'flights', label: copy(locale, 'Flights', 'Перелёты') }, { value: 'distanceKm', label: copy(locale, 'Distance', 'Расстояние') }, { value: 'durationMinutes', label: copy(locale, 'Hours', 'Часы') }]} />
    <LazyChart height={gridHeight + 64} label={gridCaption}>{inView => <KuukiChart points={gridPoints} height={gridHeight} inView={inView} ariaLabel={gridCaption} onPick={point => pickMonth(point.key)} actions={point => [{ label: filterLabel(locale), run: () => pickMonth(point.key) }]} tip={points => <span>{points[0].label}</span>} table={{ caption: gridCaption, columns: [{ key: 'key', label: copy(locale, 'Month', 'Месяц') }, { key: 'value', label: copy(locale, 'Value', 'Значение'), numeric: true }], rows: rows.map(row => ({ key: row.key, value: metric === 'durationMinutes' ? row[metric] / 60 : row[metric] })) }}>{mark => <>
      {ghosts.map(row => <rect key={`ghost:${row.key}`} x={cellX(row.month) + 1} y={cellY(row.year) + 3} width={44} height={30} rx={6} fill="none" stroke="var(--mark-ghost)" />)}
      {rows.map(row => { const point = gridPoints.find(point => point.key === row.key), future = row.key > today
        return <g key={row.key} {...point && mark(point)}><rect x={cellX(row.month) + 1} y={cellY(row.year) + 3} width={44} height={30} rx={6} fill={future ? 'none' : `var(--heat-${heatBucket(row[metric], max)})`} stroke={future ? 'var(--mark-ghost)' : 'none'} strokeDasharray={future ? '3 3' : undefined} /><text x={cellX(row.month) + 23} y={cellY(row.year) + 23} textAnchor="middle" fill={future ? 'var(--mark-ghost)' : 'var(--text)'} fontSize={12} data-sans>{future ? '–' : number(locale, metric === 'durationMinutes' ? row[metric] / 60 : row[metric])}</text></g>
      })}
      {years.map(year => <text key={year} x={0} y={cellY(year) + 23} fill="var(--text-muted)" fontSize={12} data-sans>{year}</text>)}
      {Array.from({ length: 12 }, (_, index) => <text key={index} x={cellX(index + 1) + 23} y={gridHeight - 7} textAnchor="middle" fill="var(--text-muted)" fontSize={12} data-sans>{monthName(index + 1, true)}</text>)}
    </>}</KuukiChart>}</LazyChart>
    <div className="ov3-heat-year-totals">{scope.figures.byYear.filter(row => years.includes(row.year)).map(row => <span key={row.key}>{row.year}: {flights(locale, row.flights)}</span>)}</div>
    <p className="ov3-chart-caption">{copy(locale, 'Share of the maximum month', 'Доля от максимума за месяц')}: {number(locale, metric === 'durationMinutes' ? max / 60 : max)}</p><div className="ov3-heat-legend">{[0, 1, 2, 3, 4].map(bucket => <span key={bucket}><i style={{ background: `var(--heat-${bucket})` }} />{bucket === 0 ? '0' : `${bucket * 25}%`}</span>)}</div>
    {baseline.years.length > 6 && <button className="ov3-rhythm-more" onClick={() => setShowAll(!showAll)}>{showAll ? copy(locale, 'Show latest 6 years', 'Последние 6 лет') : `${copy(locale, 'Show all years', 'Все годы')}, ${baseline.years.at(-1)}–${baseline.years[6]}`}</button>}
    <div className="ov3-rhythm-stats"><p><strong>{data.busiestMonthOfYear ? monthName(data.busiestMonthOfYear.month) : '—'}</strong>{copy(locale, 'Busiest month', 'Самый активный месяц')}</p><p><strong>{data.longestGap ? `${data.longestGap.months} ${copy(locale, 'mo', 'мес.')}` : '—'}</strong>{copy(locale, 'Longest gap', 'Самый длинный перерыв')}{data.longestGap ? ` · ${data.longestGap.from}–${data.longestGap.to}` : ''}</p></div>
    {series.dailyAvailable && <SegmentedControl value={cumulativeMetric} onChange={setCumulativeMetric} label={copy(locale, 'Cumulative metric', 'Накопленный показатель')} options={[{ value: 'km', label: copy(locale, 'Distance', 'Расстояние') }, { value: 'flights', label: copy(locale, 'Flights', 'Перелёты') }]} />}
    <h3 className="ov3-chart-caption">{odoCaption} · {unit}</h3><div className="ov3-odometer"><LazyChart height={244} label={odoCaption}>{inView => <KuukiChart points={linePoints} height={180} inView={inView} ariaLabel={odoCaption} onPick={point => pickLine(point.datum.date)} actions={point => [{ label: filterLabel(locale), run: () => pickLine(point.datum.date) }, ...(!aggregate && ownerKey !== 'dev' && point.datum.flightId !== null ? [{ label: copy(locale, 'Open flight', 'Открыть перелёт'), run: () => openFlight(point.datum.flightId!) }] : [])]} tip={points => <span>{points[0].label} {unit}</span>} table={{ caption: odoCaption, columns: [{ key: 'date', label: copy(locale, 'Date', 'Дата') }, { key: 'value', label: unit, numeric: true }], rows: dated.map(row => ({ date: row.date, value: row[valueKey] })) }}>{mark => <>
      <g transform="translate(55,16)"><ArcLine points={linePoints} ghost={ghostPoints} xDomain={bounds} yDomain={[0, yMax]} height={134} width={533} stepAfter area mark={mark} /></g>
      {[0, .5, 1].map(ratio => <text key={ratio} x={48} y={150 - ratio * 134} textAnchor="end" fill="var(--text-muted)" fontSize={12} data-sans>{number(locale, yMax * ratio)}</text>)}
      {[bounds[0], bounds[1]].map((epoch, index) => <text key={index} x={index ? 588 : 55} y={173} textAnchor={index ? 'end' : 'start'} fill="var(--text-muted)" fontSize={12} data-sans>{new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(epoch)}</text>)}
    </>}</KuukiChart>}</LazyChart></div>
    {series.dailyAvailable ? <ExactRange key={`${ownerKey}|${JSON.stringify(filter)}|${bounds.join()}`} from={rangeDays.from} to={rangeDays.to} bounds={bounds} points={ghostPoints} locale={locale} onChange={setRange} /> : <>
      <p>{copy(locale, 'Daily detail is unavailable in this older monthly summary.', 'В старой месячной сводке нет данных по дням.')}</p>
      <MonthRange from={period.from.slice(0, 7)} to={period.to.slice(0, 7)} min={min} max={maxMonth} onChange={setRange} onClear={() => setRange(null)} locale={locale} />
    </>}
    <h3 className="ov3-chart-caption">{dailyCaption}</h3>
    {series.dailyAvailable ? <>
      <label className="ov3-activity-year">{copy(locale, 'Calendar year', 'Год календаря')}<select value={selectedYear} onChange={event => setActivityYear(Number(event.target.value))}>{baseline.years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <div className="ov3-activity-scroll"><LazyChart height={224} label={dailyCaption}>{inView => <KuukiChart points={days} height={160} viewBox="0 0 900 160" inView={inView} ariaLabel={`${dailyCaption} · ${selectedYear}`} onPick={point => pickDay(point.key)} actions={point => [{ label: filterLabel(locale), run: () => pickDay(point.key) }]} tip={points => <span>{points[0].label} · {copy(locale, 'completed flights', 'завершённых перелётов')}</span>} table={{ caption: dailyCaption, columns: [{ key: 'date', label: copy(locale, 'Date', 'Дата') }, { key: 'count', label: copy(locale, 'Completed flights', 'Завершённые перелёты'), numeric: true }], rows: days.map(point => point.datum) }}>{mark => <ArcActivityHeatmap points={days} locale={locale} mark={mark} />}</KuukiChart>}</LazyChart></div>
    </> : <p>{copy(locale, 'Daily activity is unavailable in this older monthly summary.', 'В старой месячной сводке нет дневной активности.')}</p>}
  </div>
}

function ExactRange({ from, to, bounds, points, locale, onChange }: { from: string; to: string; bounds: readonly [number, number]; points: readonly { x: number; y: number }[]; locale: 'en' | 'ru'; onChange: (range: { from: string; to: string } | null) => void }) {
  const [draft, setDraft] = useState({ from, to })
  const [error, setError] = useState<string>()
  const clamp = (value: number) => Math.max(bounds[0], Math.min(bounds[1], value))
  const value: readonly [number, number] = [clamp(dayToEpoch(draft.from) ?? dayToEpoch(from)!), clamp(dayToEpoch(draft.to) ?? dayToEpoch(to)!)]
  const commit = (range: readonly [number, number]) => onChange({ from: epochToDay(range[0])!, to: epochToDay(range[1])! })
  return <>
    <ArcBrush bounds={bounds} value={value} points={points} step={DAY_MS} fromLabel={copy(locale, 'Range start', 'Начало периода')} toLabel={copy(locale, 'Range end', 'Конец периода')} onChange={range => { setError(undefined); setDraft({ from: epochToDay(range[0])!, to: epochToDay(range[1])! }) }} onCommit={commit} />
    <DateRangePicker {...draft} locale={locale} error={error} onChange={next => { setDraft(next); setError(undefined) }} onApply={() => {
      const next = periodDays(draft)
      if (!next) setError(copy(locale, 'Enter a valid, ordered date range.', 'Укажите корректный диапазон дат.'))
      else onChange(next)
    }} onClear={() => onChange(null)} />
  </>
}
