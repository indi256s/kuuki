'use client'

import { useId, useState } from 'react'
import { curveBumpX, line } from 'd3-shape'
import { Check } from '@keyline-icons/react'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { ArcDonut } from '../../charts/arc-donut'
import { ArcSlope } from '../../charts/arc-slope'
import { markerPath, slotCue, useComparisonSlots } from '../../charts/comparison-slots'
import { airlineColor } from '../../../../lib/airline'
import type { BumpRow } from '@kuuki/shared/overview/rankings'
import { airlineComparison } from './comparison'
import { KuukiChart } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { RankingBars } from './ranking-bars'
import { ChapterCard } from '../../layout/chapter-card'
import { useReading } from '../../layout/use-reading'
import { referenceLabels } from '../../labels'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, flights, percent, filterLabel, moreAirlines, number, visits } from './display'
import { AirportFigure, GateSignFigure } from './figure'
import { TravelPatterns } from './travel-patterns'
import './rankings.css'

type Category = 'airlines' | 'airports' | 'routes'
const LEGEND_TOP = 8,
  DONUT_SIZE = 240,
  // Whole-journal baseline: thin, round, sparse dots, apart from every slot's dash.
  BASELINE_DASH = '1 6'

/** The routes' undirected key, `DOH-NRT`, as the sign prints it: `DOH–NRT`. */
const signCode = (key: string) => key.replace('-', '–')

export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, locale, actions, isCurrent, ownerKey } = useOverview()
  const [category, setCategory] = useState<Category>('airlines')
  const [hidden, setHidden] = useState<string[]>([])
  const [legendSeries, setLegendSeries] = useState<string | null>(null)
  const [linkedShare, setLinkedShare] = useState<string | null>(null)
  const [allShares, setAllShares] = useState(false)
  const legendId = useId()
  const rows = scope?.rankings.rankByYear[category] ?? []
  const entities = [...new Set(rows.map((row) => row.entity))]
  const comparison = scope && payload ? airlineComparison(payload, scope.filter) : null
  const comparisonKeys = comparison?.slice(0, 5).map((row) => row.key) ?? []
  // Slots follow the key, not its rank in the current cohort. Airlines keep their brand color and take only the dash and marker.
  const bumpSlots = useComparisonSlots({
    analysis: category === 'airlines' ? 'airlines-cues' : category,
    ownerId: ownerKey,
    visibleKeys: entities,
    seedOrder: all?.rankings[category].map((row) => row.key) ?? [],
  })
  const slopeSlots = useComparisonSlots({
    analysis: 'airlines-cues',
    ownerId: ownerKey,
    visibleKeys: comparisonKeys,
    seedOrder: all?.rankings.airlines.map((row) => row.key) ?? [],
  })
  // The top five of the shown view, the leader first: the chart's rows, the reading's keys and the figure button's cycle.
  const top = scope?.rankings[category].slice(0, 5) ?? []
  const keys = top.map((row) => row.key)
  const r = useReading(keys, keys[0] ?? null)
  const labels = referenceLabels(locale, payload?.refs)
  const name = (kind: Category, key: string) =>
    kind === 'airlines'
      ? labels.airline(key)
      : kind === 'airports'
        ? labels.airport(key)
        : key.replace('-', ' ↔ ')
  const addFilter = (kind: Category, key: string) => {
    if (isCurrent()) actions.add(kind, key)
  }
  const scoped = !!scope && !isEmptyFilter(scope.filter)
  const state =
    !scope || !all || !payload
      ? 'loading'
      : scope.figures.flights === 0 && scoped
        ? 'empty'
        : 'ready'
  if (!scope || !all || !payload || state === 'empty') {
    return (
      <ChapterCard
        state={state}
        figure={
          category === 'airports' ? (
            <AirportFigure code="" />
          ) : (
            <GateSignFigure code="" picked={false} />
          )
        }
        hero={{ value: '', caption: null }}
        chart={{ caption: '', plot: null, layout: 'content' }}
        empty={{
          title: copy(locale, 'Nothing left to rank', 'Ранжировать нечего'),
          line: '',
          action: (
            <Button
              dense
              variant="secondary"
              onClick={() => {
                if (isCurrent()) actions.clear()
              }}
            >
              {copy(locale, 'Clear filter', 'Сбросить фильтр')}
            </Button>
          ),
        }}
      />
    )
  }
  const years = [...new Set(rows.map((row) => String(row.year)))]
  const baseline = all.rankings.rankByYear[category].filter((row) =>
    years.includes(String(row.year)),
  )
  const applied = (kind: Category, key: string) => scope.filter[kind]?.includes(key) ?? false
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
  // Airlines wear their own brand color (neutral when unknown); airports and routes have none and take the slot's comparison color.
  const seriesCue = (entity: string) => {
    const cue = slotCue(bumpSlots.get(entity) ?? 0)
    return category === 'airlines' ? { ...cue, color: airlineColor(entity) } : cue
  }
  const shares = scope.rankings.airlines
  const legendRows = allShares ? shares : shares.slice(0, LEGEND_TOP)
  const shareTotal = shares.reduce((sum, row) => sum + row.count, 0)
  const sharePoints = shares.map((datum) => ({
    key: datum.key,
    datum,
    label: `${name('airlines', datum.key)} · ${flights(locale, datum.count)} · ${percent(datum.count / shareTotal)}`,
  }))
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
  // The reading: the leader until a row is picked. Its figure code, hero value and caption all come from the same row.
  const leader = scope.rankings.leaders[category]
  const reading = top.find((row) => row.key === r.reading) ?? top[0] ?? null
  const rank = reading ? top.findIndex((row) => row.count === reading.count) + 1 : 0
  const tied = top.length > 1 && top[1].count === top[0].count ? top[1] : null
  const readingName = reading ? name(category, reading.key) : ''
  const share = reading && leader.total ? percent(reading.count / leader.total) : ''
  const counted = (count: number) =>
    category === 'airports' ? visits(locale, count) : flights(locale, count)
  const unit = (count: number) => counted(count).replace(/^[\d\s.,  ]+/u, '')
  const ordinal = (n: number) =>
    locale === 'ru'
      ? `${n}-${{ airlines: 'я', airports: 'й', routes: 'й' }[category]}`
      : (['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`)
  const nounOne = {
    airlines: copy(locale, 'airline', 'авиакомпания'),
    airports: copy(locale, 'airport', 'аэропорт'),
    routes: copy(locale, 'route', 'маршрут'),
  }[category]
  const ofWhat =
    category === 'airports'
      ? copy(locale, 'of airport visits', 'посещений аэропортов')
      : category === 'airlines'
        ? copy(locale, 'of flights with an airline', 'перелётов с указанной авиакомпанией')
        : copy(locale, 'of your flights', 'ваших перелётов')
  const fact = tied
    ? copy(
        locale,
        `tied with ${name(category, tied.key)}`,
        `${name(category, tied.key)} — столько же`,
      )
    : category === 'airports' && scope.home?.iata === reading?.key
      ? copy(locale, 'your home airport', 'ваш домашний аэропорт')
      : `${share} ${ofWhat}`
  const caption = !reading
    ? ''
    : r.isHeadline
      ? `${readingName} · ${fact}`
      : `${ordinal(rank)} ${nounOne} · ${readingName} · ${share} ${ofWhat}`
  const code = !reading ? '' : category === 'routes' ? signCode(reading.key) : reading.key
  const shortName = !reading
    ? ''
    : category === 'airlines'
      ? readingName
      : category === 'airports'
        ? reading.key
        : readingName

  const chartCaption = {
    airlines: copy(locale, 'Top airlines', 'Топ авиакомпаний'),
    airports: copy(locale, 'Top airports', 'Топ аэропортов'),
    routes: copy(locale, 'Top routes', 'Топ маршрутов'),
  }[category]
  const stagePoints = top.map((row) => ({
    key: row.key,
    datum: row,
    label: `${name(category, row.key)}, ${counted(row.count)}`,
  }))
  const appliedKeys = keys.filter((key) => filter[category]?.includes(key))
  const runner = top[1]
  const gap = runner ? top[0].count - runner.count : null
  const gapUnit = gap === null ? '' : counted(gap)
  const leaderGap = !runner
    ? null
    : gap === 0
      ? copy(
          locale,
          `${name(category, top[0].key)} and ${name(category, runner.key)} are tied.`,
          `${name(category, top[0].key)} и ${name(category, runner.key)} делят первое место.`,
        )
      : copy(
          locale,
          `${name(category, top[0].key)} leads ${name(category, runner.key)} by ${gapUnit}.`,
          `${name(category, top[0].key)} опережает ${name(category, runner.key)}: разница — ${gapUnit}.`,
        )

  const bump = (
    <div className="ov3-rankings" data-span={span}>
      <LazyChart height={314} label={copy(locale, 'Rank by year', 'Рейтинг по годам')}>
        {(inView) => (
          <KuukiChart
            key={category}
            points={points}
            height={270}
            inView={inView}
            ariaLabel={copy(locale, 'Rank by year', 'Рейтинг по годам')}
            onPick={(point) => addFilter(category, point.datum.entity)}
            applied={(point) => applied(category, point.datum.entity)}
            actions={(point) => [
              { label: filterLabel(locale), run: () => addFilter(category, point.datum.entity) },
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
                  <g aria-hidden="true" pointerEvents="none" fill="var(--text-muted)" fontSize={12}>
                    {[1, 2, 3, 4, 5].map((rank) => (
                      <text key={rank} x={18} y={yOf(rank)} dy=".32em" textAnchor="end">
                        {rank}
                      </text>
                    ))}
                    {years.map((year) => (
                      <text key={year} x={xOf(Number(year), width)} y={245} textAnchor="middle">
                        {year}
                      </text>
                    ))}
                    {scoped
                      ? entities.map((entity) => (
                          <path
                            key={entity}
                            d={trace(baseline.filter((row) => row.entity === entity)) ?? ''}
                            fill="none"
                            stroke="var(--mark-ghost)"
                            strokeWidth={1}
                            strokeDasharray={BASELINE_DASH}
                            strokeLinecap="round"
                          />
                        ))
                      : null}
                  </g>
                  {shown.map((entity) => {
                    const cue = seriesCue(entity)
                    return (
                      <g
                        key={entity}
                        data-bump-series={entity}
                        data-active={highlighted === entity || undefined}
                      >
                        <path
                          d={trace(rows.filter((row) => row.entity === entity)) ?? ''}
                          fill="none"
                          stroke={cue.color}
                          strokeWidth={2}
                          strokeDasharray={cue.dash}
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
                              <path
                                d={markerPath(cue.marker, 4.5)}
                                transform={`translate(${xOf(point.datum.year, width)},${yOf(point.datum.rank)})`}
                                fill={cue.color}
                                fillRule="evenodd"
                                stroke="var(--surface)"
                                strokeWidth={1}
                              />
                            </g>
                          ))}
                      </g>
                    )
                  })}
                </g>
              )
            }}
          </KuukiChart>
        )}
      </LazyChart>
      {/* These toggle lines in this chart only, unlike the names above, which filter the page. */}
      <div
        className="ov3-bump-dashes"
        role="group"
        aria-label={copy(locale, 'Series visibility', 'Видимость рядов')}
      >
        {entities.map((entity) => {
          const cue = seriesCue(entity)
          return (
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
              <svg width="28" height="12" aria-hidden="true">
                <line
                  x1="0"
                  x2="28"
                  y1="6"
                  y2="6"
                  stroke={cue.color}
                  strokeWidth={2}
                  strokeDasharray={cue.dash}
                />
                <path
                  d={markerPath(cue.marker, 4.5)}
                  transform="translate(14,6)"
                  fill={cue.color}
                  fillRule="evenodd"
                  stroke="var(--surface)"
                  strokeWidth={1}
                />
              </svg>
              {name(category, entity)}
            </button>
          )
        })}
        {scoped && baseline.length > 0 && (
          <span>
            <svg width="28" height="12" aria-hidden="true">
              <line
                x1="0"
                x2="28"
                y1="6"
                y2="6"
                stroke="var(--mark-ghost)"
                strokeWidth={1}
                strokeDasharray={BASELINE_DASH}
                strokeLinecap="round"
              />
            </svg>
            {copy(locale, 'Whole journal', 'Вся история')}
          </span>
        )}
        {hidden.length > 0 && (
          <button type="button" onClick={() => setHidden([])}>
            {copy(locale, 'Show all', 'Показать все')}
          </button>
        )}
      </div>
      {shown.length === 0 && (
        <p role="status">{copy(locale, 'No series shown', 'Все ряды скрыты')}</p>
      )}
    </div>
  )
  const sharesBlock = (
    <div className="ov3-rankings" data-span={span}>
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
                    onPick={(point) => addFilter('airlines', point.datum.key)}
                    applied={(point) => applied('airlines', point.datum.key)}
                    actions={(point) => [
                      {
                        label: filterLabel(locale),
                        run: () => addFilter('airlines', point.datum.key),
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
                        mark={(point) => {
                          // Sector and legend row light up together; neither filters until picked.
                          const props = mark(point)
                          return {
                            ...props,
                            onPointerEnter: (event) => {
                              props.onPointerEnter?.(event)
                              setLinkedShare(point.key)
                            },
                            onPointerLeave: (event) => {
                              props.onPointerLeave?.(event)
                              setLinkedShare(null)
                            },
                            onFocus: (event) => {
                              props.onFocus?.(event)
                              setLinkedShare(point.key)
                            },
                            onBlur: () => setLinkedShare(null),
                          }
                        }}
                        highlightKey={linkedShare}
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
                {legendRows.map((row) => {
                  const active = applied('airlines', row.key)
                  return (
                    <button
                      type="button"
                      key={row.key}
                      aria-pressed={active}
                      data-linked={linkedShare === row.key || undefined}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== 'touch') setLinkedShare(row.key)
                      }}
                      onPointerLeave={() => setLinkedShare(null)}
                      onFocus={() => setLinkedShare(row.key)}
                      onBlur={() => setLinkedShare(null)}
                      onClick={() =>
                        active && isCurrent()
                          ? actions.remove('airlines', row.key)
                          : addFilter('airlines', row.key)
                      }
                    >
                      <i aria-hidden="true" style={{ background: airlineColor(row.key) }} />
                      <span>
                        {name('airlines', row.key)}
                        {active ? (
                          <Check
                            className="ov3-share-check"
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <strong>
                        {number(locale, row.count)} · {percent(row.count / shareTotal)}
                      </strong>
                    </button>
                  )
                })}
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
                  onPick={(point) => addFilter('airlines', point.datum.key)}
                  applied={(point) => applied('airlines', point.datum.key)}
                  actions={(point) => [
                    {
                      label: filterLabel(locale),
                      run: () => addFilter('airlines', point.datum.key),
                    },
                  ]}
                  tip={(selected) => <span>{selected[0].label}</span>}
                  table={{
                    caption: copy(locale, 'All airline comparisons', 'Сравнение всех авиакомпаний'),
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
                      rows={comparisonPoints.map((point) => {
                        const cue = slotCue(slopeSlots.get(point.key) ?? 0)
                        return {
                          point,
                          label: point.key,
                          start: point.datum.start,
                          end: point.datum.end,
                          color: airlineColor(point.key),
                          dash: cue.dash,
                          marker: cue.marker,
                        }
                      })}
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
    </div>
  )

  return (
    <ChapterCard
      state="ready"
      figure={
        category === 'airports' ? (
          <AirportFigure code={code} />
        ) : (
          <GateSignFigure
            code={code}
            picked={r.picked}
            note={reading ? `#${rank} ×${number(locale, reading.count)}` : ''}
          />
        )
      }
      figureButton={
        keys.length > 1
          ? {
              label: copy(locale, 'Show next in the ranking', 'Показать следующую строку рейтинга'),
              onPress: r.next,
            }
          : undefined
      }
      hero={{
        value: reading ? number(locale, reading.count) : '—',
        unit: reading ? unit(reading.count) : undefined,
        caption,
        only:
          r.isHeadline || !reading || applied(category, reading.key)
            ? null
            : {
                label: copy(locale, `Only ${shortName}`, `Только ${shortName}`),
                onPress: () => addFilter(category, reading.key),
              },
      }}
      rollValue={r.picked}
      chart={{
        layout: 'content',
        caption: chartCaption,
        toggle: (
          <SegmentedControl
            dense
            value={category}
            onChange={(value) => {
              setCategory(value)
              setHidden([])
              setLegendSeries(null)
            }}
            label={copy(locale, 'Rank by', 'Рейтинг по')}
            options={
              [
                { value: 'airlines', label: copy(locale, 'Airlines', 'Компании') },
                { value: 'airports', label: copy(locale, 'Airports', 'Аэропорты') },
                { value: 'routes', label: copy(locale, 'Routes', 'Маршруты') },
              ] as const
            }
          />
        ),
        table: {
          caption: chartCaption,
          columns: [
            { key: 'name', label: copy(locale, 'Name', 'Название') },
            {
              key: 'flights',
              label:
                category === 'airports'
                  ? copy(locale, 'Airport visits', 'Посещения аэропортов')
                  : copy(locale, 'Flights', 'Перелёты'),
              numeric: true,
            },
          ],
          rows: top.map((row) => ({ name: name(category, row.key), flights: row.count })),
        },
        plot: (
          <div>
            {span === 'full' && leaderGap && <p className="ov3-ranking-gap">{leaderGap}</p>}
            <LazyChart
              height={stagePoints.length * (span === 'full' ? 72 : 24)}
              label={chartCaption}
            >
              {(inView) => (
                <RankingBars
                  key={category}
                  points={stagePoints}
                  value={(point) => point.datum.count}
                  format={(point) => number(locale, point.datum.count)}
                  name={(point) => name(category, point.key)}
                  mono={category !== 'airlines'}
                  span={span}
                  selectedKey={r.reading}
                  appliedKeys={appliedKeys}
                  inView={inView}
                  ariaLabel={chartCaption}
                  onPick={(point) => r.pick(point.key)}
                  actions={(point) => [
                    { label: filterLabel(locale), run: () => addFilter(category, point.key) },
                  ]}
                  tip={(selected) => <span>{selected[0].label}</span>}
                />
              )}
            </LazyChart>
          </div>
        ),
      }}
      details={{
        heading: copy(locale, 'Travel patterns', 'Привычки в путешествиях'),
        extra: (
          <TravelPatterns
            patterns={scope.rankings.patterns}
            baseline={all.rankings.patterns}
            filtered={scoped}
          />
        ),
        more: [
          { summary: copy(locale, 'Rank by year', 'Рейтинг по годам'), content: bump },
          { summary: shareCaption, content: sharesBlock },
        ],
      }}
    />
  )
}
