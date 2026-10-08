'use client'

import { defineChart, ridgelineY } from '@tanstack/charts'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleLog } from 'd3-scale'
import { MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
import { MakerSwatch } from '../../../ui/category-mark'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { MAKER_PALETTE } from '../../charts/palettes'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { Below, copy, filterLabel, flights, types } from '../rankings/display'
import { PayloadAircraftReview } from '../manufacturers/aircraft-review'
import { ridgeProfile } from './helpers'
import './fleet.css'

export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  if (!scope || !all) return null
  const gate = scope.fleet
  if (gate.status === 'below') return <Below id="fleet" gate={gate} fix="aircraft" />
  const data = gate.value, baseline = all.fleet.status === 'ready' ? all.fleet.value : data
  const profiles = (source: typeof data) => source.familyRows.flatMap(row => ridgeProfile(row.minutes).map((point, i) => ({ ...point, family: row.family, category: row.key, maker: row.maker, flights: row.flights, key: `${row.key}:${i}` })))
  const rows = profiles(data), ghosts = profiles(baseline)
  const categories: string[] = []
  for (const body of ['narrow', 'wide']) {
    const members = baseline.familyRows.filter(row => row.body === body)
    if (members.length) { if (categories.length) categories.push('body-gap'); categories.push(...members.map(row => row.key)) }
  }
  const labels = new Map(baseline.familyRows.map(row => [row.key, `${row.family} · ${flights(locale, data.familyRows.find(current => current.key === row.key)?.flights ?? 0)}`]))
  const definition = defineChart({
    marks: [
      decorative(ridgelineY(ghosts, { x: 'x', y: 'category', height: 'height', key: 'key', fill: 'none', stroke: 'var(--mark-ghost)', strokeWidth: 1, overlap: 1.1 })),
      ...MAKER_SLOTS.map(maker => ridgelineY(rows.filter(row => row.maker === maker), { x: 'x', y: 'category', height: 'height', key: 'key', fill: `var(--cat-maker-${maker})`, fillOpacity: 0.18, stroke: `var(--cat-maker-${maker})`, strokeWidth: 2, overlap: 1.1 })),
    ],
    scales: { x: { scale: scaleLog().domain([30, 1020]), axis: { line: false, ticks: { values: [60, 120, 240, 480, 960], format: value => `${Number(value) / 60}${copy(locale, 'h', 'ч')}` } } }, y: { scale: scalePoint<string>().domain(categories).padding(0.8), axis: { line: false, ticks: { format: value => labels.get(String(value)) ?? '' } } } },
    margin: { left: 120, right: 12, top: 36, bottom: 30 },
  })
  const pick = (family: string) => { if (isCurrent()) actions.add('families', family) }
  const top = data.topFamily, topRow = data.familyRows.find(row => row.family === top?.family)
  const height = Math.max(200, categories.length * 42 + 66)
  return <div className="ov3-fleet" data-span={span}>
    <div className="ov3-fleet-heading">{topRow && <MakerSwatch maker={topRow.maker} />} <strong>{top?.family ?? '—'}</strong> {flights(locale, top?.flights ?? 0)}<p>{copy(locale, 'Most flown type', 'Самый частый тип')} · {types(locale, data.familyCount)}</p></div>
    <div className="ov3-body-split">{(['narrow', 'wide'] as const).map(body => <div key={body}><div className="ov3-body-bands">{data.bodies.filter(row => row.body === body).map(row => <button key={row.key} style={{ flexGrow: row.flights, background: `var(--cat-maker-${row.maker})` }} aria-label={`${copy(locale, body === 'narrow' ? 'Narrowbody' : 'Widebody', body === 'narrow' ? 'Узкофюзеляжные' : 'Широкофюзеляжные')} · ${row.maker} · ${flights(locale, row.flights)}`} onClick={() => { if (isCurrent()) { actions.add('bodies', body); actions.add('makers', row.maker) } }} />)}</div><p>{copy(locale, body === 'narrow' ? 'Narrowbody' : 'Widebody', body === 'narrow' ? 'Узкофюзеляжные' : 'Широкофюзеляжные')} {data.bodies.filter(row => row.body === body).reduce((sum, row) => sum + row.flights, 0)}</p></div>)}</div>
    <PayloadAircraftReview />
    <p className="ov3-chart-caption">{copy(locale, 'Flight length by type', 'Длительность по типам')}</p>
    <LazyChart height={height + 64} label={copy(locale, 'Flight length by type', 'Длительность по типам')}>{inView => <KuukiChart definition={definition} height={height} inView={inView} palette={MAKER_PALETTE} ariaLabel={copy(locale, 'Flight length by type', 'Длительность по типам')}
      onPick={point => pick(point.datum.family)} actions={point => [{ label: filterLabel(locale), run: () => pick(point.datum.family) }]}
      tip={points => <span>{points[0].datum.family} · {flights(locale, points[0].datum.flights)} · {Math.round(points[0].datum.x)} {copy(locale, 'min', 'мин')}</span>}
      table={{ caption: copy(locale, 'Flight length by type', 'Длительность по типам'), columns: [{ key: 'family', label: copy(locale, 'Type', 'Тип') }, { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true }, { key: 'minutes', label: copy(locale, 'Recorded minutes', 'Известное время, мин') }], rows: data.familyRows.map(row => ({ family: row.family, flights: row.flights, minutes: row.minutes.join(', ') || '—' })) }} />}</LazyChart>
    <div className="ov3-fleet-legend">{MAKER_SLOTS.filter(maker => data.familyRows.some(row => row.maker === maker)).map(maker => <span key={maker}><MakerSwatch maker={maker} /> {maker === 'other' ? copy(locale, 'Other', 'Другие') : maker === 'atr' ? 'ATR' : maker[0].toUpperCase() + maker.slice(1)}</span>)}</div>
  </div>
}
