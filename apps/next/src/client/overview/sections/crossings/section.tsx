'use client'

import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { Below, copy, filterLabel, number } from '../rankings/display'
import { CrossingBars, barsWidth, type ShiftYear } from './bars'
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
  const ghosts = baseline.shiftByYear
  const points: ChartPoint<ShiftYear>[] = data.shiftByYear.filter(row => row.flights > 0 && ghosts.some(base => base.year === row.year)).map(row => ({ key: row.key, datum: row, label: `${row.year} · +${number(locale, row.forward)} / −${number(locale, row.back)} ${copy(locale, 'h', 'ч')}` }))
  const rows = ghosts.map(base => data.shiftByYear.find(row => row.year === base.year) ?? { ...base, forward: 0, back: 0, flights: 0 })
  const pick = (year: number) => { if (isCurrent()) actions.setPeriod({ years: [year] }) }
  const route = (record: typeof data.lastEquator) => record ? `${record.origin} → ${record.destination}` : copy(locale, 'No crossing recorded', 'Пересечений пока нет')
  const hit = data.offsets.filter(row => row.hit).length
  const caption = copy(locale, 'Clock change per year · hours', 'Сдвиг часов по годам · часы')
  return <div className="ov3-crossings" data-span={span}><div className="ov3-crossing-tiles">
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Clocks shifted', 'Сдвиг часов')}</p><div className="ov3-crossing-figure"><strong>{number(locale, data.clockShiftHours)} {copy(locale, 'h', 'ч')}</strong><div className="ov3-shift-split" aria-hidden="true"><i style={{ flexGrow: data.forwardHours }} /><i style={{ flexGrow: data.backHours }} /></div></div><small>{number(locale, data.forwardHours)} {copy(locale, 'h forward', 'ч вперёд')} · {number(locale, data.backHours)} {copy(locale, 'h back', 'ч назад')}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Time zones', 'Часовые пояса')}</p><div className="ov3-crossing-figure"><strong>{hit}</strong><div className="ov3-offset-ticks" aria-hidden="true">{data.offsets.map(row => <i key={row.key} style={{ background: row.hit ? 'var(--mark-1)' : 'var(--mark-ghost)' }} />)}</div></div><small>{hit} {copy(locale, 'of 24 hourly UTC offsets', 'из 24 часовых смещений UTC')}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Equator', 'Экватор')}</p><div className="ov3-crossing-figure"><strong>{data.equator}</strong><CrossingDots count={data.equator} /></div><small>{route(data.lastEquator)}</small></div>
    <div className="ov3-crossing-tile"><p>{copy(locale, 'Arctic Circle', 'Полярный круг')}</p><div className="ov3-crossing-figure"><strong>{data.arcticCircle}</strong><CrossingDots count={data.arcticCircle} /></div><small>{route(data.lastArctic)}</small></div>
  </div><h3 className="ov3-chart-caption">{caption}</h3><LazyChart height={284} label={caption}>{inView => <KuukiChart points={points} height={220} fit={available => barsWidth(ghosts.length, available)} inView={inView} ariaLabel={caption} onPick={point => pick(point.datum.year)} actions={point => [{ label: filterLabel(locale), run: () => pick(point.datum.year) }]} tip={points => <span>{points[0].label}</span>} table={{ caption, columns: [{ key: 'year', label: copy(locale, 'Year', 'Год') }, { key: 'forward', label: copy(locale, 'Forward', 'Вперёд'), numeric: true }, { key: 'back', label: copy(locale, 'Back', 'Назад'), numeric: true }, { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true }], rows: rows.map(row => ({ year: row.year, forward: row.flights ? row.forward : '–', back: row.flights ? row.back : '–', flights: row.flights })) }}>{(mark, { width }) => <CrossingBars points={points} ghosts={ghosts} width={width} height={220} format={value => number(locale, value)} mark={mark} />}</KuukiChart>}</LazyChart></div>
}
