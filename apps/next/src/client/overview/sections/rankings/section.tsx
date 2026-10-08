'use client'

import { useState } from 'react'
import { defineChart, lineY, dot } from '@tanstack/charts'
import { d3Curve } from '@tanstack/charts/d3/shape'
import { decorative } from '@tanstack/charts/mark/decorative'
import { interactiveColorLegend } from '@tanstack/charts/legend'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { curveBumpX } from 'd3-shape'
import { matches } from '@kuuki/shared/overview/filter'
import { allianceAt } from '@kuuki/data/alliance-membership'
import { AllianceMark } from '../../../ui/category-mark'
import { SegmentedControl } from '../../../ui/segmented-control'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { referenceLabels } from '../../labels'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, flights, percent, filterLabel } from './display'
import './rankings.css'

type Category = 'airlines' | 'airports' | 'routes'
export function Section({ span }: { span: Span }) {
  const { scope, all, payload, locale, actions, isCurrent } = useOverview()
  const [category, setCategory] = useState<Category>('airlines')
  const [hidden, setHidden] = useState<string[]>([])
  if (!scope || !all || !payload) return null
  const labels = referenceLabels(locale)
  const name = (kind: Category, key: string) => kind === 'airlines' ? labels.airline(key) : kind === 'airports' ? labels.airport(key) : key.replace('-', ' → ')
  const pick = (kind: Category, key: string) => { if (isCurrent()) actions.add(kind, key) }
  const rows = scope.rankings.rankByYear[category]
  const years = [...new Set(rows.map(row => String(row.year)))]
  const baseline = all.rankings.rankByYear[category].filter(row => years.includes(String(row.year)))
  const entities = [...new Set(rows.map(row => row.entity))]
  const palette = ['var(--mark-1)', 'var(--mark-2)', 'var(--mark-3)', 'var(--mark-4)', 'var(--mark-ghost)']
  const dashes = ['', '', '6 4', '', '1 4']
  const shown = entities.filter(entity => !hidden.includes(entity))
  const dim = [{ when: (context: { focus: { primary: unknown }; matches: (channel: 'series') => boolean }) => !!context.focus.primary && !context.matches('series'), style: { strokeOpacity: 0.22 } }]
  const definition = defineChart({
    marks: [
      ...entities.map(entity => decorative(lineY(baseline.filter(row => row.entity === entity), { x: row => String(row.year), y: 'rank', stroke: 'var(--mark-ghost)', strokeWidth: 1, curve: d3Curve(curveBumpX) }))),
      ...shown.map(entity => lineY(rows.filter(row => row.entity === entity), { x: row => String(row.year), y: 'rank', z: 'entity', color: 'entity', key: 'key', curve: d3Curve(curveBumpX), strokeWidth: entities.indexOf(entity) === 0 ? 2.5 : 2, strokeDasharray: dashes[entities.indexOf(entity)], states: dim })),
      dot(rows.filter(row => shown.includes(row.entity)), { x: row => String(row.year), y: 'rank', color: 'entity', z: 'entity', key: 'key', r: 4 }),
    ],
    scales: { x: { scale: scalePoint<string>().domain(years).padding(0.2), axis: { line: false } }, y: { scale: scaleLinear().domain([0.5, 5.5]), reverse: true, axis: { line: false, ticks: { values: [1, 2, 3, 4, 5] } } } },
    color: { domain: entities, range: palette, legend: interactiveColorLegend({ visible: { value: shown, onChange: next => setHidden(entities.filter(entity => !next.includes(entity))) }, format: value => name(category, String(value)), itemAriaLabel: value => name(category, String(value)), ariaLabel: copy(locale, 'Series visibility', 'Видимость рядов'), emptyLabel: copy(locale, 'No series shown', 'Все ряды скрыты'), hover: 'series' }) },
    margin: { left: 30, right: 20, top: 20, bottom: 50 },
  })
  const pairPick = (id: 'makers' | 'haul' | 'daytime', side: 'left' | 'right') => {
    if (!isCurrent()) return
    if (id === 'makers') actions.add('makers', side === 'left' ? 'airbus' : 'boeing')
    else if (id === 'haul') { actions.add('haul', side === 'left' ? 'short' : 'long'); if (side === 'left') actions.add('haul', 'medium') }
    else { actions.add('departureBands', side === 'left' ? 'morning' : 'night'); if (side === 'left') { actions.add('departureBands', 'afternoon'); actions.add('departureBands', 'evening') } }
  }
  const pairNames = { makers: ['Airbus', 'Boeing'], haul: [copy(locale, 'Short & medium haul', 'Ближние и средние'), copy(locale, 'Long haul', 'Дальние')], daytime: [copy(locale, 'Daytime', 'Дневные'), copy(locale, 'Red-eye', 'Ночные')] }
  return <div className="ov3-rankings" data-span={span}>
    <p className="ov3-fine-hint">{copy(locale, 'Click any name to filter the page', 'Нажмите на название, чтобы отфильтровать страницу')}</p>
    <div className="ov3-leaders">{(['airlines', 'airports', 'routes'] as const).map(kind => {
      const leader = scope.rankings.leaders[kind], first = leader.top[0]
      const context = first && kind === 'airports' ? payload.refs.airports[first.key] : null
      const airlineDate = first && kind === 'airlines' ? payload.rows.filter(row => row.airline === first.key && row.state !== 'upcoming' && matches(row, scope.filter, payload.refs)).map(row => row.date).sort().at(-1) : null
      const alliance = first && airlineDate ? allianceAt(first.key, airlineDate) : null
      return <div className="ov3-leader" key={kind}><p>{copy(locale, kind === 'airlines' ? 'Top airline' : kind === 'airports' ? 'Top airport' : 'Top route', kind === 'airlines' ? 'Главная авиакомпания' : kind === 'airports' ? 'Главный аэропорт' : 'Главный маршрут')}</p>
        {first ? <><button className="ov3-leader-lockup" onClick={() => pick(kind, first.key)}><span className="ov3-leader-badge">{kind === 'routes' ? '↔' : first.key}</span><span className="ov3-leader-name">{name(kind, first.key)}<small>{alliance ? <AllianceMark alliance={alliance} /> : null}{alliance ? ({ star: 'Star Alliance', oneworld: 'oneworld', skyteam: 'SkyTeam' }[alliance]) : (context?.country ? labels.country(context.country) : kind === 'routes' ? first.key.split('-').map(code => payload.refs.airports[code]?.city ?? code).join(' → ') : '')}{kind === 'airports' && scope.home?.iata === first.key ? copy(locale, ' · home airport', ' · домашний аэропорт') : ''}</small></span><strong>{first.count}<small>{copy(locale, 'flights', 'перелёты')}</small></strong></button>
          <div className="ov3-leader-strip" aria-hidden="true"><i style={{ width: percent(leader.topShare) }} /><i style={{ width: percent(leader.top5Share - leader.topShare) }} /></div>
          <p className="ov3-leader-legend"><span><i aria-hidden="true" />{percent(leader.topShare)} {copy(locale, kind === 'airports' ? 'of airport visits' : 'of your flights', kind === 'airports' ? 'посещений аэропортов' : 'ваших перелётов')}</span><span><i aria-hidden="true" />{copy(locale, 'Top 5', 'Топ-5')}: {percent(leader.top5Share)}</span></p>
          {leader.top.slice(1).map((row, i) => <button className="ov3-rank-row" key={row.key} onClick={() => pick(kind, row.key)}><span>{i + 2}</span><span>{name(kind, row.key)}</span><span>{row.count}</span></button>)}</> : <p>—</p>}</div>
    })}</div>
    <div className="ov3-rankings-bottom"><div><p className="ov3-chart-caption">{copy(locale, 'Rank by year', 'Рейтинг по годам')}</p>
      <SegmentedControl value={category} onChange={value => { setCategory(value); setHidden([]) }} label={copy(locale, 'Rank by', 'Рейтинг по')} options={([{ value: 'airlines', label: copy(locale, 'Airlines', 'Авиакомпании') }, { value: 'airports', label: copy(locale, 'Airports', 'Аэропорты') }, { value: 'routes', label: copy(locale, 'Routes', 'Маршруты') }] as const)} />
      <LazyChart height={310} label={copy(locale, 'Rank by year', 'Рейтинг по годам')}>{inView => <KuukiChart key={category} definition={definition} height={270} inView={inView} ariaLabel={copy(locale, 'Rank by year', 'Рейтинг по годам')} onPick={point => pick(category, point.datum.entity)} actions={point => [{ label: filterLabel(locale), run: () => pick(category, point.datum.entity) }]} tip={points => <span>{name(category, points[0].datum.entity)} · {points[0].datum.year} · #{points[0].datum.rank} · {flights(locale, points[0].datum.count)}</span>} table={{ caption: copy(locale, 'Rank by year', 'Рейтинг по годам'), columns: [{ key: 'entity', label: copy(locale, 'Name', 'Название') }, { key: 'year', label: copy(locale, 'Year', 'Год') }, { key: 'rank', label: copy(locale, 'Rank', 'Место') }, { key: 'count', label: copy(locale, 'Flights', 'Перелёты') }], rows: rows.map(row => ({ ...row, entity: name(category, row.entity) })) }} />}</LazyChart>
      <div className="ov3-bump-dashes" aria-hidden="true">{entities.map((entity, i) => <span key={entity}><svg width="24" height="10"><line x1="0" x2="24" y1="5" y2="5" stroke={palette[i]} strokeWidth={i === 0 ? 2.5 : 2} strokeDasharray={dashes[i]} strokeLinecap={i === 4 ? 'round' : undefined} /></svg>{name(category, entity)}</span>)}</div>
    </div><div><p className="ov3-chart-caption">{copy(locale, 'Head to head', 'Лицом к лицу')}</p>{scope.rankings.versus.map(pair => <div className="ov3-score" key={pair.id}><button onClick={() => pairPick(pair.id, 'left')}>{pairNames[pair.id][0]}</button><strong>{pair.left.count} : {pair.right.count}</strong><button onClick={() => pairPick(pair.id, 'right')}>{pairNames[pair.id][1]}</button></div>)}<p>{copy(locale, 'Daytime v red-eye leaves out', 'Дневные и ночные: не учтено')} {flights(locale, scope.rankings.versus.find(pair => pair.id === 'daytime')!.excluded)} {copy(locale, 'without times', 'без времени')}</p></div></div>
  </div>
}
