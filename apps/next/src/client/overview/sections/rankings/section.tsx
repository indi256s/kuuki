'use client'

import { useId, useState } from 'react'
import { curveBumpX, line } from 'd3-shape'
import { matches } from '@kuuki/shared/overview/filter'
import { allianceAt } from '@kuuki/data/alliance-membership'
import { AllianceMark } from '../../../ui/category-mark'
import { SegmentedControl } from '../../../ui/segmented-control'
import { Disclosure } from '../../../ui/disclosure'
import { ArcDonut } from '../../charts/arc-donut'
import { ArcSlope } from '../../charts/arc-slope'
import { airlineColor } from '../../../../lib/airline'
import type { BumpRow } from '@kuuki/shared/overview/rankings'
import { airlineComparison } from './comparison'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { referenceLabels } from '../../labels'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, flights, percent, filterLabel, moreAirlines, number } from './display'
import { BoardSheetFigure } from './figure'
import './rankings.css'

type Category = 'airlines' | 'airports' | 'routes'
const LEGEND_TOP = 8,
  DONUT_SIZE = 240
export function Section({ span }: { span: Span }) {
  const { scope, all, payload, locale, actions, isCurrent } = useOverview()
  const [category, setCategory] = useState<Category>('airlines')
  const [hidden, setHidden] = useState<string[]>([])
  const [legendSeries, setLegendSeries] = useState<string | null>(null)
  const [allShares, setAllShares] = useState(false)
  const legendId = useId()
  if (!scope || !all || !payload) return null
  const labels = referenceLabels(locale)
  const name = (kind: Category, key: string) =>
    kind === 'airlines'
      ? labels.airline(key)
      : kind === 'airports'
        ? labels.airport(key)
        : key.replace('-', ' → ')
  const pick = (kind: Category, key: string) => {
    if (isCurrent()) actions.add(kind, key)
  }
  const rows = scope.rankings.rankByYear[category]
  const years = [...new Set(rows.map((row) => String(row.year)))]
  const baseline = all.rankings.rankByYear[category].filter((row) =>
    years.includes(String(row.year)),
  )
  const entities = [...new Set(rows.map((row) => row.entity))]
  const palette = [
    'var(--mark-1)',
    'var(--mark-2)',
    'var(--mark-3)',
    'var(--mark-4)',
    'var(--mark-ghost)',
  ]
  const dashes = ['', '', '6 4', '', '1 4']
  const shown = entities.filter((entity) => !hidden.includes(entity))
  const highlighted = legendSeries && shown.includes(legendSeries) ? legendSeries : null
  const points = rows
    .filter((row) => shown.includes(row.entity))
    .map((datum) => ({
      key: datum.key,
      datum,
      label: `${name(category, datum.entity)} · ${datum.year} · #${datum.rank} · ${flights(locale, datum.count)}`,
    }))
  const xOf = (year: number, width: number) =>
    years.length === 1
      ? (30 + width - 20) / 2
      : 30 + ((years.indexOf(String(year)) + 0.2) * (width - 50)) / (years.length - 1 + 0.4)
  const yOf = (rank: number) => 20 + ((rank - 0.5) / 5) * 200
  const tracer = (width: number) =>
    line<BumpRow>()
      .x((row) => xOf(row.year, width))
      .y((row) => yOf(row.rank))
      .curve(curveBumpX)
  const airlineSlot = (key: string) =>
    Math.max(
      0,
      all.rankings.airlines.findIndex((row) => row.key === key),
    ) % palette.length
  // Airlines wear their own colour; airports and routes have none, so they keep the rank palette.
  const seriesColor = (entity: string) =>
    category === 'airlines' ? airlineColor(entity) : palette[entities.indexOf(entity)]
  const shares = scope.rankings.airlines
  const legendRows = allShares ? shares : shares.slice(0, LEGEND_TOP)
  const shareTotal = shares.reduce((sum, row) => sum + row.count, 0)
  const sharePoints = shares.map((datum) => ({
    key: datum.key,
    datum,
    label: `${name('airlines', datum.key)} · ${flights(locale, datum.count)} · ${percent(datum.count / shareTotal)}`,
  }))
  const comparison = airlineComparison(payload, scope.filter)
  const comparisonPoints =
    comparison?.slice(0, 5).map((datum) => ({
      key: datum.key,
      datum,
      label: `${name('airlines', datum.key)} · ${number(locale, datum.start)} → ${number(locale, datum.end)}`,
    })) ?? []
  const shareCaption = copy(locale, 'Airline shares', 'Доли авиакомпаний')
  const comparisonCaption = copy(
    locale,
    'Airlines · previous and selected period · top 5',
    'Авиакомпании · прошлый и выбранный период · топ-5',
  )
  const pairPick = (id: 'makers' | 'haul' | 'daytime', side: 'left' | 'right') => {
    if (!isCurrent()) return
    if (id === 'makers') actions.add('makers', side === 'left' ? 'airbus' : 'boeing')
    else if (id === 'haul') {
      actions.add('haul', side === 'left' ? 'short' : 'long')
      if (side === 'left') actions.add('haul', 'medium')
    } else {
      actions.add('departureBands', side === 'left' ? 'morning' : 'night')
      if (side === 'left') {
        actions.add('departureBands', 'afternoon')
        actions.add('departureBands', 'evening')
      }
    }
  }
  const daytime = scope.rankings.versus.find((pair) => pair.id === 'daytime')!
  const pairEmpty = {
    makers: copy(locale, 'No Airbus or Boeing flights', 'Перелётов на Airbus и Boeing нет'),
    haul: copy(locale, 'No distances recorded', 'Расстояния не указаны'),
    daytime: copy(locale, 'No departure times recorded', 'Время вылета не указано'),
  }
  const pairNames = {
    makers: ['Airbus', 'Boeing'],
    haul: [
      copy(locale, 'Short & medium haul', 'Ближние и средние'),
      copy(locale, 'Long haul', 'Дальние'),
    ],
    daytime: [copy(locale, 'Daytime', 'Дневные'), copy(locale, 'Red-eye', 'Ночные')],
  }
  return (
    <div className="ov3-rankings" data-span={span}>
      <BoardSheetFigure />
      <p className="ov3-fine-hint">
        {copy(
          locale,
          'Click any name to filter the page',
          'Нажмите на название, чтобы отфильтровать страницу',
        )}
      </p>
      <div className="ov3-leaders">
        {(['airlines', 'airports', 'routes'] as const).map((kind) => {
          const leader = scope.rankings.leaders[kind],
            first = leader.top[0]
          const context = first && kind === 'airports' ? payload.refs.airports[first.key] : null
          const airlineDate =
            first && kind === 'airlines'
              ? payload.rows
                  .filter(
                    (row) =>
                      row.airline === first.key &&
                      row.state !== 'upcoming' &&
                      matches(row, scope.filter, payload.refs),
                  )
                  .map((row) => row.date)
                  .sort()
                  .at(-1)
              : null
          const alliance = first && airlineDate ? allianceAt(first.key, airlineDate) : null
          return (
            <div className="ov3-leader" key={kind}>
              <p>
                {copy(
                  locale,
                  kind === 'airlines'
                    ? 'Top airline'
                    : kind === 'airports'
                      ? 'Top airport'
                      : 'Top route',
                  kind === 'airlines'
                    ? 'Главная авиакомпания'
                    : kind === 'airports'
                      ? 'Главный аэропорт'
                      : 'Главный маршрут',
                )}
              </p>
              {first ? (
                <>
                  <button className="ov3-leader-lockup" onClick={() => pick(kind, first.key)}>
                    <span className="ov3-leader-badge">{kind === 'routes' ? '↔' : first.key}</span>
                    <span className="ov3-leader-name">
                      {name(kind, first.key)}
                      <small>
                        {alliance ? <AllianceMark alliance={alliance} decorative /> : null}
                        {alliance
                          ? { star: 'Star Alliance', oneworld: 'oneworld', skyteam: 'SkyTeam' }[
                              alliance
                            ]
                          : context?.country
                            ? labels.country(context.country)
                            : kind === 'routes'
                              ? first.key
                                  .split('-')
                                  .map((code) => payload.refs.airports[code]?.city ?? code)
                                  .join(' → ')
                              : ''}
                        {kind === 'airports' && scope.home?.iata === first.key
                          ? copy(locale, ' · home airport', ' · домашний аэропорт')
                          : ''}
                      </small>
                    </span>
                    <strong>
                      {first.count}
                      <small>{copy(locale, 'flights', 'перелёты')}</small>
                    </strong>
                  </button>
                  <div className="ov3-leader-strip" aria-hidden="true">
                    <i style={{ width: percent(leader.topShare) }} />
                    <i style={{ width: percent(leader.top5Share - leader.topShare) }} />
                  </div>
                  <p className="ov3-leader-legend">
                    <span>
                      <i aria-hidden="true" />
                      {percent(leader.topShare)}{' '}
                      {copy(
                        locale,
                        kind === 'airports' ? 'of airport visits' : 'of your flights',
                        kind === 'airports' ? 'посещений аэропортов' : 'ваших перелётов',
                      )}
                    </span>
                    <span>
                      <i aria-hidden="true" />
                      {copy(locale, 'Top 5', 'Топ-5')}: {percent(leader.top5Share)}
                    </span>
                  </p>
                  {leader.top.slice(1).map((row, i) => (
                    <button
                      className="ov3-rank-row"
                      key={row.key}
                      onClick={() => pick(kind, row.key)}
                    >
                      <span>{i + 2}</span>
                      <span>{name(kind, row.key)}</span>
                      <span>{row.count}</span>
                    </button>
                  ))}
                </>
              ) : (
                <p>—</p>
              )}
            </div>
          )
        })}
      </div>
      {/* The leaders answer "who"; the analyses below are for digging, so each opens on request instead of lengthening every visit. */}
      <Disclosure
        summary={copy(locale, 'Rank by year and head to head', 'Рейтинг по годам и противостояния')}
      >
        <div className="ov3-rankings-bottom">
          <div>
            <h3 className="ov3-chart-caption">
              {copy(locale, 'Rank by year', 'Рейтинг по годам')}
            </h3>
            <SegmentedControl
              value={category}
              onChange={(value) => {
                setCategory(value)
                setHidden([])
                setLegendSeries(null)
              }}
              label={copy(locale, 'Rank by', 'Рейтинг по')}
              options={
                [
                  { value: 'airlines', label: copy(locale, 'Airlines', 'Авиакомпании') },
                  { value: 'airports', label: copy(locale, 'Airports', 'Аэропорты') },
                  { value: 'routes', label: copy(locale, 'Routes', 'Маршруты') },
                ] as const
              }
            />
            <LazyChart height={314} label={copy(locale, 'Rank by year', 'Рейтинг по годам')}>
              {(inView) => (
                <KuukiChart
                  key={category}
                  points={points}
                  height={270}
                  inView={inView}
                  ariaLabel={copy(locale, 'Rank by year', 'Рейтинг по годам')}
                  onPick={(point) => pick(category, point.datum.entity)}
                  actions={(point) => [
                    { label: filterLabel(locale), run: () => pick(category, point.datum.entity) },
                  ]}
                  tip={(selected) => <span>{selected[0].label}</span>}
                  table={{
                    caption: copy(locale, 'Rank by year', 'Рейтинг по годам'),
                    columns: [
                      { key: 'entity', label: copy(locale, 'Name', 'Название') },
                      { key: 'year', label: copy(locale, 'Year', 'Год') },
                      { key: 'rank', label: copy(locale, 'Rank', 'Место') },
                      { key: 'count', label: copy(locale, 'Flights', 'Перелёты') },
                    ],
                    rows: rows.map((row) => ({ ...row, entity: name(category, row.entity) })),
                  }}
                >
                  {(mark, { width }) => {
                    const trace = tracer(width)
                    return (
                      <g data-bump-highlight={highlighted ?? undefined}>
                        <g
                          aria-hidden="true"
                          pointerEvents="none"
                          fill="var(--text-muted)"
                          fontSize={12}
                        >
                          {[1, 2, 3, 4, 5].map((rank) => (
                            <text key={rank} x={18} y={yOf(rank)} dy=".32em" textAnchor="end">
                              {rank}
                            </text>
                          ))}
                          {years.map((year) => (
                            <text
                              key={year}
                              x={xOf(Number(year), width)}
                              y={245}
                              textAnchor="middle"
                            >
                              {year}
                            </text>
                          ))}
                          {entities.map((entity) => (
                            <path
                              key={entity}
                              d={trace(baseline.filter((row) => row.entity === entity)) ?? ''}
                              fill="none"
                              stroke="var(--mark-ghost)"
                              strokeWidth={1}
                            />
                          ))}
                        </g>
                        {shown.map((entity) => (
                          <g
                            key={entity}
                            data-bump-series={entity}
                            style={{
                              opacity:
                                highlighted !== null && highlighted !== entity ? 0.22 : undefined,
                            }}
                          >
                            <path
                              d={trace(rows.filter((row) => row.entity === entity)) ?? ''}
                              fill="none"
                              stroke={seriesColor(entity)}
                              strokeWidth={entities.indexOf(entity) === 0 ? 2.5 : 2}
                              strokeDasharray={dashes[entities.indexOf(entity)]}
                              pointerEvents="none"
                              aria-hidden="true"
                            />
                            {points
                              .filter((point) => point.datum.entity === entity)
                              .map((point) => (
                                <g key={point.key} {...mark(point)}>
                                  <circle
                                    cx={xOf(point.datum.year, width)}
                                    cy={yOf(point.datum.rank)}
                                    r={22}
                                    fill="transparent"
                                  />
                                  <circle
                                    cx={xOf(point.datum.year, width)}
                                    cy={yOf(point.datum.rank)}
                                    r={4}
                                    fill={seriesColor(entity)}
                                  />
                                </g>
                              ))}
                          </g>
                        ))}
                      </g>
                    )
                  }}
                </KuukiChart>
              )}
            </LazyChart>
            {/* These toggle lines in this chart only, unlike the names above, which filter the page. */}
            <p className="ov3-bump-hint">
              {copy(locale, 'Show or hide lines', 'Показать или скрыть линии')}
            </p>
            <div
              className="ov3-bump-dashes"
              role="group"
              aria-label={copy(locale, 'Series visibility', 'Видимость рядов')}
            >
              {entities.map((entity, i) => (
                <button
                  key={entity}
                  type="button"
                  aria-pressed={!hidden.includes(entity)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setLegendSeries(entity)
                  }}
                  onPointerLeave={() => setLegendSeries(null)}
                  onFocus={() => setLegendSeries(entity)}
                  onBlur={() => setLegendSeries(null)}
                  onClick={() =>
                    setHidden((current) =>
                      current.includes(entity)
                        ? current.filter((key) => key !== entity)
                        : [...current, entity],
                    )
                  }
                >
                  <svg width="24" height="10" aria-hidden="true">
                    <line
                      x1="0"
                      x2="24"
                      y1="5"
                      y2="5"
                      stroke={seriesColor(entity)}
                      strokeWidth={i === 0 ? 2.5 : 2}
                      strokeDasharray={dashes[i]}
                      strokeLinecap={i === 4 ? 'round' : undefined}
                    />
                  </svg>
                  {name(category, entity)}
                </button>
              ))}
            </div>
            {shown.length === 0 && (
              <p role="status">{copy(locale, 'No series shown', 'Все ряды скрыты')}</p>
            )}
          </div>
          <div>
            <h3 className="ov3-chart-caption">{copy(locale, 'Head to head', 'Лицом к лицу')}</h3>
            {scope.rankings.versus.map((pair) =>
              pair.left.count + pair.right.count === 0 ? (
                <p key={pair.id}>{pairEmpty[pair.id]}</p>
              ) : (
                <div className="ov3-score" key={pair.id}>
                  <button onClick={() => pairPick(pair.id, 'left')}>{pairNames[pair.id][0]}</button>
                  <strong>
                    {pair.left.count} : {pair.right.count}
                  </strong>
                  <button onClick={() => pairPick(pair.id, 'right')}>
                    {pairNames[pair.id][1]}
                  </button>
                </div>
              ),
            )}
            {daytime.left.count + daytime.right.count > 0 && daytime.excluded > 0 && (
              <p>
                {copy(locale, 'Daytime v red-eye leaves out', 'Дневные и ночные: не учтено')}{' '}
                {flights(locale, daytime.excluded)} {copy(locale, 'without times', 'без времени')}
              </p>
            )}
          </div>
        </div>
      </Disclosure>
      <Disclosure
        summary={
          comparison
            ? copy(
                locale,
                'Airline shares and change since the previous period',
                'Доли авиакомпаний и сравнение с прошлым периодом',
              )
            : shareCaption
        }
      >
        <div
          className="ov3-rankings-bottom ov3-rankings-shares"
          data-single={comparison ? undefined : 'true'}
        >
          <div>
            <h3 className="ov3-chart-caption">{shareCaption}</h3>
            <div className="ov3-shares">
              <div className="ov3-share-donut">
                <LazyChart height={284} label={shareCaption}>
                  {(inView) => (
                    <KuukiChart
                      points={sharePoints}
                      height={DONUT_SIZE}
                      fit={() => DONUT_SIZE}
                      inView={inView}
                      ariaLabel={shareCaption}
                      onPick={(point) => pick('airlines', point.datum.key)}
                      actions={(point) => [
                        {
                          label: filterLabel(locale),
                          run: () => pick('airlines', point.datum.key),
                        },
                      ]}
                      tip={(selected) => <span>{selected[0].label}</span>}
                      table={{
                        caption: shareCaption,
                        columns: [
                          { key: 'airline', label: copy(locale, 'Airline', 'Авиакомпания') },
                          {
                            key: 'count',
                            label: copy(locale, 'Flights', 'Перелёты'),
                            numeric: true,
                          },
                          { key: 'share', label: copy(locale, 'Share', 'Доля'), numeric: true },
                        ],
                        rows: shares.map((row) => ({
                          airline: name('airlines', row.key),
                          count: row.count,
                          share: percent(row.count / shareTotal),
                        })),
                      }}
                    >
                      {(mark, { width, height }) => (
                        <ArcDonut
                          width={width}
                          height={height}
                          rows={sharePoints.map((point) => ({
                            point,
                            value: point.datum.count,
                            color: airlineColor(point.key),
                          }))}
                          mark={mark}
                          totalLabel={copy(locale, 'Flights', 'Перелёты')}
                          formatValue={(value) => number(locale, value)}
                        />
                      )}
                    </KuukiChart>
                  )}
                </LazyChart>
              </div>
              <div className="ov3-share-key">
                <div className="ov3-share-legend" id={legendId}>
                  {legendRows.map((row) => (
                    <button type="button" key={row.key} onClick={() => pick('airlines', row.key)}>
                      <i aria-hidden="true" style={{ background: airlineColor(row.key) }} />
                      <span>{name('airlines', row.key)}</span>
                      <strong>
                        {number(locale, row.count)} · {percent(row.count / shareTotal)}
                      </strong>
                    </button>
                  ))}
                </div>
                {shares.length > LEGEND_TOP && (
                  <button
                    type="button"
                    className="ov3-share-more"
                    aria-expanded={allShares}
                    aria-controls={legendId}
                    onClick={() => setAllShares((open) => !open)}
                  >
                    {allShares
                      ? copy(locale, 'Show fewer', 'Показать меньше')
                      : moreAirlines(locale, shares.length - LEGEND_TOP)}
                  </button>
                )}
              </div>
            </div>
            {scope.figures.flights > shareTotal && (
              <p>
                {copy(locale, 'Airline not recorded', 'Авиакомпания не указана')}:{' '}
                {flights(locale, scope.figures.flights - shareTotal)}
              </p>
            )}
            {!comparison && (
              <p className="ov3-share-note" role="status">
                {copy(
                  locale,
                  'Select a continuous period with available detail to compare with the previous period.',
                  'Выберите непрерывный период с доступными данными для сравнения с прошлым периодом.',
                )}
              </p>
            )}
          </div>
          {comparison && (
            <div>
              <h3 className="ov3-chart-caption">{comparisonCaption}</h3>
              <LazyChart height={304} label={comparisonCaption}>
                {(inView) => (
                  <KuukiChart
                    points={comparisonPoints}
                    height={260}
                    inView={inView}
                    ariaLabel={comparisonCaption}
                    onPick={(point) => pick('airlines', point.datum.key)}
                    actions={(point) => [
                      { label: filterLabel(locale), run: () => pick('airlines', point.datum.key) },
                    ]}
                    tip={(selected) => <span>{selected[0].label}</span>}
                    table={{
                      caption: copy(
                        locale,
                        'All airline comparisons',
                        'Сравнение всех авиакомпаний',
                      ),
                      columns: [
                        { key: 'airline', label: copy(locale, 'Airline', 'Авиакомпания') },
                        {
                          key: 'start',
                          label: copy(locale, 'Previous period', 'Прошлый период'),
                          numeric: true,
                        },
                        {
                          key: 'end',
                          label: copy(locale, 'Selected period', 'Выбранный период'),
                          numeric: true,
                        },
                      ],
                      rows: comparison.map((row) => ({
                        ...row,
                        airline: name('airlines', row.key),
                      })),
                    }}
                  >
                    {(mark, { width }) => (
                      <ArcSlope
                        width={width}
                        rows={comparisonPoints.map((point) => ({
                          point,
                          label: point.key,
                          start: point.datum.start,
                          end: point.datum.end,
                          color: airlineColor(point.key),
                          dash: dashes[airlineSlot(point.key)],
                        }))}
                        mark={mark}
                        maxValue={Math.max(
                          0,
                          ...comparisonPoints.flatMap((point) => [
                            point.datum.start,
                            point.datum.end,
                          ]),
                        )}
                        startLabel={copy(locale, 'Previous period', 'Прошлый период')}
                        endLabel={copy(locale, 'Selected period', 'Выбранный период')}
                        formatValue={(value) => number(locale, value)}
                        highlightKey={scope.filter.airlines?.[0]}
                      />
                    )}
                  </KuukiChart>
                )}
              </LazyChart>
              {comparison.length === 0 && (
                <p>
                  {copy(
                    locale,
                    'No recorded airlines in either period.',
                    'Ни в одном периоде нет указанных авиакомпаний.',
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  )
}
