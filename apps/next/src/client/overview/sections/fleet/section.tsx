'use client'

import type { CSSProperties } from 'react'
import { MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
import { MakerSwatch } from '../../../ui/category-mark'
import { ArcRidgeline, type ArcRidgeRow } from '../../charts/arc-ridgeline'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
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
  type Family = typeof data.familyRows[number]
  type Sample = Family & { x: number }
  const ghostOf = new Map(baseline.familyRows.map(row => [row.key, ridgeProfile(row.minutes)]))
  const live = new Map(data.familyRows.filter(row => ghostOf.has(row.key)).map(row => [row.key, { row, profile: ridgeProfile(row.minutes) }]))
  // One chart point per precomputed ridge sample, keyed family:index, so hover, keys and touch report the actual rounded minute.
  const sampleOf = new Map([...live.values()].map(({ row, profile }) => [row.key, profile.map((sample, i): { x: number; point: ChartPoint<Sample> } => ({
    x: sample.x,
    point: { key: `${row.key}:${i}`, datum: { ...row, x: sample.x }, label: `${row.family} · ${flights(locale, row.flights)} · ${Math.round(sample.x)} ${copy(locale, 'min', 'мин')}` },
  }))]))
  // Keyboard steps one family at a time, at the sample nearest its median, labelled with that typical length; hover still reads every sample.
  const stops = [...live.values()].map(({ row }) => {
    const samples = sampleOf.get(row.key) ?? [], sorted = [...row.minutes].filter(value => value > 0).sort((a, b) => a - b)
    const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : null
    const stop = median === null ? samples[0] : samples.reduce((best, sample) => Math.abs(sample.x - median) < Math.abs(best.x - median) ? sample : best)
    if (stop && median !== null) stop.point = { ...stop.point, label: `${row.family} · ${flights(locale, row.flights)} · ${copy(locale, 'typically', 'обычно')} ${Math.round(median)} ${copy(locale, 'min', 'мин')}` }
    return stop?.point.key
  }).filter((key): key is string => !!key)
  const points = [...sampleOf.values()].flatMap(samples => samples.map(sample => sample.point))
  const ridges: ArcRidgeRow<Sample>[] = []
  for (const body of ['narrow', 'wide']) {
    baseline.familyRows.filter(row => row.body === body).forEach((row, i) => {
      const now = live.get(row.key)
      ridges.push({ key: row.key, label: `${row.family} · ${flights(locale, now?.row.flights ?? 0)}`, profile: now?.profile ?? [], ghost: ghostOf.get(row.key), color: `var(--cat-maker-${row.maker})`, gapBefore: i === 0 && ridges.length > 0, samplePoints: sampleOf.get(row.key) })
    })
  }
  const pick = (family: string) => { if (isCurrent()) actions.add('families', family) }
  const top = data.topFamily, topRow = data.familyRows.find(row => row.family === top?.family)
  const slots = ridges.reduce((count, row, i) => count + (row.gapBefore && i > 0 ? 2 : 1), 0)
  const height = Math.max(200, slots * 42 + 66)
  return <div className="ov3-fleet" data-span={span}>
    <div className="ov3-fleet-heading">{topRow && <MakerSwatch maker={topRow.maker} />} <strong>{top?.family ?? '—'}</strong>{top && <> · {flights(locale, top.flights)}</>}<p>{copy(locale, 'Most flown type', 'Самый частый тип')} · {types(locale, data.familyCount)}</p></div>
    <div className="ov3-body-split">{(['narrow', 'wide'] as const).map(body => { const rows = data.bodies.filter(row => row.body === body), total = rows.reduce((sum, row) => sum + row.flights, 0); return <div key={body} style={{ '--n': total } as CSSProperties}><div className="ov3-body-bands">{rows.map(row => <button key={row.key} style={{ flexGrow: row.flights, background: `var(--cat-maker-${row.maker})` }} aria-label={`${copy(locale, body === 'narrow' ? 'Narrowbody' : 'Widebody', body === 'narrow' ? 'Узкофюзеляжные' : 'Широкофюзеляжные')} · ${row.maker} · ${flights(locale, row.flights)}`} onClick={() => { if (isCurrent()) { actions.add('bodies', body); actions.add('makers', row.maker) } }} />)}</div><p>{copy(locale, body === 'narrow' ? 'Narrowbody' : 'Widebody', body === 'narrow' ? 'Узкофюзеляжные' : 'Широкофюзеляжные')} {total}</p></div> })}</div>
    <PayloadAircraftReview />
    <h3 className="ov3-chart-caption">{copy(locale, 'Flight length by type', 'Длительность по типам')}</h3>
    <LazyChart height={height + 64} label={copy(locale, 'Flight length by type', 'Длительность по типам')}>{inView => <KuukiChart points={points} height={height} inView={inView} palette={MAKER_PALETTE} ariaLabel={copy(locale, 'Flight length by type', 'Длительность по типам')} keyStops={stops}
      onPick={point => pick(point.datum.family)} actions={point => [{ label: filterLabel(locale), run: () => pick(point.datum.family) }]}
      tip={points => <span>{points[0].datum.family} · {flights(locale, points[0].datum.flights)} · {Math.round(points[0].datum.x)} {copy(locale, 'min', 'мин')}</span>}
      table={{ caption: copy(locale, 'Flight length by type', 'Длительность по типам'), columns: [{ key: 'family', label: copy(locale, 'Type', 'Тип') }, { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true }, { key: 'minutes', label: copy(locale, 'Recorded minutes', 'Известное время, мин') }], rows: data.familyRows.map(row => ({ family: row.family, flights: row.flights, minutes: row.minutes.join(', ') || '—' })) }}>{(mark, { width }) => <ArcRidgeline rows={ridges} mark={mark} width={width} height={height} formatTick={minutes => `${minutes / 60}${copy(locale, 'h', 'ч')}`} />}</KuukiChart>}</LazyChart>
    <div className="ov3-fleet-legend">{MAKER_SLOTS.filter(maker => data.familyRows.some(row => row.maker === maker)).map(maker => <span key={maker}><MakerSwatch maker={maker} /> {maker === 'other' ? copy(locale, 'Other', 'Другие') : maker === 'atr' ? 'ATR' : maker[0].toUpperCase() + maker.slice(1)}</span>)}</div>
  </div>
}
