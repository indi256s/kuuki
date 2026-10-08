'use client'

import { useEffect, useRef, useState } from 'react'
import { type MakerKey } from '@kuuki/data/aircraft-makers'
import type { Makers } from '@kuuki/shared/overview/makers'
import { MakerSwatch } from '../../../ui/category-mark'
import { Disclosure } from '../../../ui/disclosure'
import { SegmentedControl } from '../../../ui/segmented-control'
import { ArcWaffle } from '../../charts/arc-waffle'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { MAKER_PALETTE } from '../../charts/palettes'
import { useMakerMetric, useOpenFlight, type MakerMetric } from '../../store/open-flight'
import { useOverview } from '../../store/overview-context'
import { formatDateOnly, formatDuration } from '../../../../lib/format'
import type { Span } from '../registry'
import { Below, copy, filterLabel, flights, number, percent } from '../rankings/display'
import { PayloadAircraftReview } from './aircraft-review'
import { percentCells, waffleLayout } from './helpers'
import './manufacturers.css'

export const makerName = (key: MakerKey, locale: 'en' | 'ru') => key === 'other' ? copy(locale, 'Other', 'Другие') : key === 'unknown' ? copy(locale, 'Unknown', 'Неизвестно') : key === 'atr' ? 'ATR' : key[0].toUpperCase() + key.slice(1)
const valueOf = (row: { flights: number; minutes: number; km: number }, metric: MakerMetric) => metric === 'hours' ? row.minutes / 60 : row[metric]
type WaffleCell = { key: string; maker: MakerKey; x: number; y: number; flight?: Makers['flights'][number] }
export function Section({ span }: { span: Span }) {
  const { scope, all, aggregate, locale, actions, isCurrent, ownerKey } = useOverview()
  const [metric, setMetric] = useMakerMetric()
  const openFlight = useOpenFlight()
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(230)
  useEffect(() => {
    const element = host.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setWidth(Math.max(7, entries[0].contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [scope?.makers.status])
  if (!scope || !all) return null
  const gate = scope.makers
  if (gate.status === 'below') return <Below id="manufacturers" gate={gate} fix="aircraft" />
  const data = gate.value, baseline = all.makers.status === 'ready' ? all.makers.value : data
  const layout = metric === 'flights' ? waffleLayout(baseline.totals.flights / (aggregate ? 5 : 1), width) : waffleLayout(100, width)
  const unit = metric === 'flights' ? layout.unit * (aggregate ? 5 : 1) : 1
  const columns = metric === 'flights' ? layout.columns : 10
  const makeCells = (source: Makers): WaffleCell[] => {
    const counts = metric === 'flights' ? source.rows.map(row => ({ key: row.key, cells: Math.ceil(row.flights / unit) })) : percentCells(source.rows.map(row => ({ key: row.key, value: valueOf(row, metric) })))
    let index = 0
    return counts.flatMap(row => {
      const members = !aggregate && metric === 'flights' && unit === 1 ? source.flights.filter(flight => flight.maker === row.key) : []
      return Array.from({ length: row.cells }, (_, i) => { const position = index++; return { key: `${row.key}:${i}`, maker: row.key, x: position % columns, y: Math.floor(position / columns), flight: members[i] } })
    })
  }
  const ghosts = makeCells(baseline)
  const selectedFlights = new Set(data.flights.map(flight => flight.flightId))
  const rows = metric === 'flights' && unit === 1 && !aggregate
    ? ghosts.filter(row => row.flight && selectedFlights.has(row.flight.flightId)) : makeCells(data)
  const rowCount = Math.max(1, Math.ceil(Math.max(rows.length, ghosts.length) / columns))
  const points: ChartPoint<WaffleCell>[] = rows.map(row => ({ key: row.key, datum: row, label: `${makerName(row.maker, locale)}${row.flight ? ` · ${row.flight.origin} → ${row.flight.destination} · ${formatDateOnly(locale, row.flight.date, 'medium')}` : ''}` }))
  const cells = [
    ...ghosts.map(row => ({ ...row, key: `ghost:${row.key}`, ghost: true, fill: 'none' })),
    ...points.map(point => ({ ...point.datum, group: point.datum.maker, fill: `var(--cat-maker-${point.datum.maker})`, point })),
  ]
  const chartHeight = Math.max(100, rowCount * (layout.cell + layout.gap))
  const pick = (maker: MakerKey) => { if (isCurrent()) actions.add('makers', maker) }
  const total = valueOf(data.totals, metric)
  const displayValue = (row: Makers['rows'][number]) => `${number(locale, valueOf(row, metric))}${metric === 'hours' ? copy(locale, ' h', ' ч') : metric === 'km' ? copy(locale, ' km', ' км') : ''}`
  const caption = metric === 'flights' ? `${copy(locale, '1 cell =', '1 ячейка =')} ${flights(locale, unit)}` : `${copy(locale, '1 cell = 1% of', '1 ячейка = 1% от')} ${number(locale, total)} ${metric === 'hours' ? copy(locale, 'h', 'ч') : copy(locale, 'km', 'км')}`
  const leader = data.rows.reduce((best, row) => valueOf(row, metric) > valueOf(best, metric) ? row : best, data.rows[0])
  return <div className="ov3-manufacturers" data-span={span}>
    <div className="ov3-maker-heading"><div><strong>{percent(total ? valueOf(leader, metric) / total : 0)} <MakerSwatch maker={leader.key} /> {makerName(leader.key, locale)}</strong><p>{flights(locale, leader.flights)} {copy(locale, 'of', 'из')} {number(locale, data.totals.flights)}</p></div>
      <SegmentedControl value={metric} onChange={setMetric} label={copy(locale, 'Manufacturer metric', 'Показатель производителей')} options={[{ value: 'flights', label: copy(locale, 'Flights', 'Перелёты') }, { value: 'hours', label: copy(locale, 'Hours', 'Часы') }, { value: 'km', label: copy(locale, 'Km', 'Км') }]} /></div>
    <p>{data.totals.minutesApproximate && metric === 'hours' ? '≈ ' : ''}{caption}</p>
    <div ref={host}><LazyChart height={Math.max(160, rowCount * (layout.cell + layout.gap) + 64)} label={copy(locale, 'Flights by manufacturer', 'Перелёты по производителям')}>{inView => <KuukiChart points={points} height={chartHeight} viewBox={`0 0 ${Math.max(1, columns * (layout.cell + layout.gap))} ${chartHeight}`} inView={inView} palette={MAKER_PALETTE} ariaLabel={copy(locale, 'Flights by manufacturer', 'Перелёты по производителям')}
      onPick={point => pick(point.datum.maker)} actions={point => [{ label: filterLabel(locale), run: () => pick(point.datum.maker) }, ...(!aggregate && ownerKey !== 'dev' && point.datum.flight ? [{ label: copy(locale, 'Open flight', 'Открыть перелёт'), run: () => openFlight(point.datum.flight!.flightId) }] : [])]}
      tip={points => { const row = points[0].datum, flight = row.flight; return <div>{makerName(row.maker, locale)} · {displayValue(data.rows.find(item => item.key === row.maker)!)}{flight && <><p>{flight.origin} → {flight.destination} · {formatDateOnly(locale, flight.date, 'medium')}</p><p>{flight.aircraft ?? '—'} · {flight.durationMinutes === null ? '—' : formatDuration(locale, flight.durationMinutes)}</p></>}<p>{copy(locale, 'Click to filter by', 'Фильтр по производителю')}: {makerName(row.maker, locale)}</p></div> }}
      table={{ caption: copy(locale, 'Manufacturers', 'Производители'), columns: [{ key: 'name', label: copy(locale, 'Manufacturer', 'Производитель') }, { key: 'value', label: copy(locale, 'Value', 'Значение'), numeric: true }, { key: 'share', label: '%' }], rows: data.rows.map(row => ({ name: makerName(row.key, locale), value: displayValue(row), share: percent(total ? valueOf(row, metric) / total : 0) })) }}>{mark => <ArcWaffle cells={cells} cellSize={layout.cell} gap={layout.gap} mark={mark} />}</KuukiChart>}</LazyChart></div>
    <div className="ov3-maker-legend">{data.rows.map(row => <div key={row.key}><button onClick={() => pick(row.key)}><MakerSwatch maker={row.key} /> {makerName(row.key, locale)} <strong>{displayValue(row)}</strong> · {percent(total ? valueOf(row, metric) / total : 0)}</button>{row.key === 'other' && data.other.length > 0 && <Disclosure summary={copy(locale, 'Other families', 'Другие семейства')}>{data.other.map(family => <button key={family.key} onClick={() => { if (isCurrent()) actions.add('families', family.family) }}>{family.family} · {displayValue({ ...family, key: 'other' })}</button>)}</Disclosure>}</div>)}</div>
    <PayloadAircraftReview />
  </div>
}
