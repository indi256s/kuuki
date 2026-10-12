'use client'

import { useState } from 'react'
import { overviewSeries } from '@kuuki/shared/overview/series'
import { matches } from '@kuuki/shared/overview/filter'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import { SegmentedControl } from '../../../ui/segmented-control'
import { KuukiChart } from '../../charts/kuuki-chart'
import {
  ArcActivityHeatmap,
  activityPoints,
  calendarColumns,
  calendarHeight,
  calendarWidth,
  heatIsWeak,
} from '../../charts/arc-activity-heatmap'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, filterLabel, number, flights } from '../rankings/display'
import { TimelineContent } from '../timeline/section'
import { HEAT_MISSING, heatBucket, measuredMonths, monthStart } from './helpers'
import { HeatKey, type HeatKeyEntry } from './heat-key'
import { CalendarSheetFigure } from './figure'
import './rhythm.css'

type Metric = 'flights' | 'distanceKm' | 'durationMinutes'
// Month grid in CSS pixels: 12 month bands after a year gutter. Bands grow with the card up to BAND_MAX; below BAND_MIN the card scrolls.
const GUTTER = 36,
  BAND_MIN = 24,
  BAND_MAX = 76,
  CELL_GAP = 2
const bandOf = (available: number) =>
  Math.min(BAND_MAX, Math.max(BAND_MIN, (available - GUTTER) / 12))
const gridWidth = (available: number) => GUTTER + 12 * bandOf(available)
type CalendarState = {
  metric: Metric
  setMetric: (metric: Metric) => void
  showAll: boolean
  setShowAll: (showAll: boolean) => void
  activityYear: number | null
  setActivityYear: (year: number) => void
}
function CalendarContent({
  metric,
  setMetric,
  showAll,
  setShowAll,
  activityYear,
  setActivityYear,
}: CalendarState) {
  const { scope, all, payload, filter, locale, actions, isCurrent } = useOverview()
  if (!scope || !all || !payload) return null
  const gate = scope.rhythm
  if (gate.status !== 'ready') return null
  const data = gate.value,
    baseline = all.rhythm.status === 'ready' ? all.rhythm.value : data
  const years = showAll ? baseline.years : baseline.years.slice(0, 6)
  const today = payload.generatedAt.slice(0, 7)
  const rows = data.cells.filter((row) => years.includes(row.year)),
    ghosts = baseline.cells.filter((row) => years.includes(row.year))
  const monthName = (month: number, style: 'long' | 'short' | 'narrow' = 'long') =>
    new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
      monthStart(`2000-${String(month).padStart(2, '0')}`),
    )
  const pickMonth = (key: string) => {
    if (isCurrent()) actions.setPeriod({ from: key, to: key })
  }
  const pickDay = (day: string) => {
    if (isCurrent()) actions.setPeriod({ from: day, to: day })
  }
  const max = baseline.max[metric],
    gridHeight = years.length * 36 + 48
  const noData = copy(locale, 'No data', 'Нет данных')
  // Totals read a missing distance or duration as 0; a month with flights but no measurement is unknown, not a zero.
  const measured =
    metric === 'flights'
      ? null
      : measuredMonths(
          payload.rows.filter(
            (row) =>
              (row.state === 'logged' || row.state === 'awaiting') &&
              matches(row, filter, payload.refs),
          ),
          metric,
        )
  const bucketOf = (row: (typeof rows)[number]) =>
    row.key > today || (measured && row.flights > 0 && !measured.has(row.key))
      ? HEAT_MISSING
      : heatBucket(row[metric], max)
  const valueOf = (row: (typeof rows)[number]) =>
    metric === 'durationMinutes' ? row[metric] / 60 : row[metric]
  const gridPoints = rows
    .filter((row) => row.key <= today)
    .map((row) => ({
      key: row.key,
      datum: row,
      label: `${row.key} · ${bucketOf(row) === HEAT_MISSING ? noData : number(locale, valueOf(row))}`,
    }))
  const pointOf = new Map(gridPoints.map((point) => [point.key, point]))
  const cellY = (year: number) => 8 + years.indexOf(year) * 36
  const series = overviewSeries(payload, filter)
  const gridCaption = copy(locale, 'Flights by month', 'Перелёты по месяцам')
  const selectedYear =
    activityYear !== null && baseline.years.includes(activityYear)
      ? activityYear
      : baseline.years[0]
  // Days are known from the first dated flight of the whole journal (not the filter) through today; outside that range the journal has no evidence either way.
  const dated = payload.rows
    .filter((row) => row.state !== 'upcoming' && dayToEpoch(row.date) !== null)
    .map((row) => row.date)
  const known = dated.length
    ? {
        from: dated.reduce((first, date) => (date < first ? date : first)),
        to: dated.reduce(
          (last, date) => (date > last ? date : last),
          payload.generatedAt.slice(0, 10),
        ),
      }
    : null
  const days = activityPoints(selectedYear, series.daily, locale, known),
    dayColumns = calendarColumns(days, locale)
  const dailyCaption = copy(locale, 'Completed flights by day', 'Завершённые перелёты по дням')
  const baseText =
    metric === 'flights'
      ? flights(locale, max)
      : metric === 'distanceKm'
        ? `${number(locale, max)} ${copy(locale, 'km', 'км')}`
        : `${number(locale, max / 60)} ${copy(locale, 'h', 'ч')}`
  const monthlyBase = `${
    metric === 'flights'
      ? copy(locale, 'Share of your busiest month', 'Доля от вашего самого активного месяца')
      : metric === 'distanceKm'
        ? copy(
            locale,
            'Share of your busiest month by distance',
            'Доля от вашего самого активного месяца по расстоянию',
          )
        : copy(
            locale,
            'Share of your busiest month by hours',
            'Доля от вашего самого активного месяца по часам',
          )
  }: ${baseText}`
  const monthlyKey: HeatKeyEntry[] = [
    { level: 0, label: '0' },
    ...([1, 2, 3, 4] as const).map((level) => ({ level, label: `≤${level * 25}%` })),
    ...(rows.some((row) => bucketOf(row) === HEAT_MISSING)
      ? [{ level: HEAT_MISSING, label: noData }]
      : []),
  ]
  const dailyKey: HeatKeyEntry[] = [
    ...([0, 1, 2, 3, 4] as const).map((level) => ({
      level,
      label: `${number(locale, level)}${level === 4 ? '+' : ''}`,
    })),
    ...(days.some((point) => point.datum.missing)
      ? [
          {
            level: HEAT_MISSING,
            label: `${noData} (${copy(locale, 'before the journal or after today', 'до начала журнала или после сегодняшнего дня')})`,
          },
        ]
      : []),
  ]
  return (
    <>
      <CalendarSheetFigure />
      <div className="ov3-rhythm-group">
        <div className="ov3-rhythm-stats">
          <p>
            <strong>
              {data.busiestMonthOfYear ? monthName(data.busiestMonthOfYear.month) : '—'}
            </strong>
            {copy(locale, 'Busiest month', 'Самый активный месяц')}
          </p>
          <p>
            <strong>
              {data.longestGap ? `${data.longestGap.months} ${copy(locale, 'mo', 'мес.')}` : '—'}
            </strong>
            {copy(locale, 'Longest gap', 'Самый длинный перерыв')}
            {data.longestGap ? ` · ${data.longestGap.from}–${data.longestGap.to}` : ''}
          </p>
        </div>
        <SegmentedControl
          value={metric}
          onChange={setMetric}
          label={copy(locale, 'Rhythm metric', 'Показатель ритма')}
          options={[
            { value: 'flights', label: copy(locale, 'Flights', 'Перелёты') },
            { value: 'distanceKm', label: copy(locale, 'Distance', 'Расстояние') },
            { value: 'durationMinutes', label: copy(locale, 'Hours', 'Часы') },
          ]}
        />
        <LazyChart height={gridHeight + 64} label={gridCaption}>
          {(inView) => (
            <KuukiChart
              points={gridPoints}
              height={gridHeight}
              fit={gridWidth}
              inView={inView}
              ariaLabel={gridCaption}
              onPick={(point) => pickMonth(point.key)}
              actions={(point) => [{ label: filterLabel(locale), run: () => pickMonth(point.key) }]}
              tip={(points) => <span>{points[0].label}</span>}
              table={{
                caption: gridCaption,
                columns: [
                  { key: 'key', label: copy(locale, 'Month', 'Месяц') },
                  { key: 'value', label: copy(locale, 'Value', 'Значение'), numeric: true },
                ],
                rows: rows.map((row) => ({
                  key: row.key,
                  value: bucketOf(row) === HEAT_MISSING ? noData : valueOf(row),
                })),
              }}
            >
              {(mark, { width }) => {
                const band = (width - GUTTER) / 12,
                  cellX = (month: number) => GUTTER + (month - 1) * band,
                  cellW = band - CELL_GAP,
                  narrow = band < 40
                return (
                  <>
                    {ghosts.map((row) => (
                      <rect
                        key={`ghost:${row.key}`}
                        x={cellX(row.month)}
                        y={cellY(row.year) + 3}
                        width={cellW}
                        height={30}
                        rx={6}
                        fill="none"
                        stroke="var(--mark-ghost)"
                      />
                    ))}
                    {rows.map((row) => {
                      // A future month, an unmeasured one, or a value the scale cannot place is missing: a dashed empty outline, never a zero.
                      const point = pointOf.get(row.key),
                        bucket = bucketOf(row),
                        text = bucket === HEAT_MISSING ? '–' : number(locale, valueOf(row))
                      return (
                        <g key={row.key} {...(point && mark(point))}>
                          <rect
                            x={cellX(row.month)}
                            y={cellY(row.year) + 3}
                            width={cellW}
                            height={30}
                            rx={6}
                            fill={bucket === HEAT_MISSING ? 'transparent' : `var(--heat-${bucket})`}
                            stroke={
                              bucket === HEAT_MISSING
                                ? 'var(--missing)'
                                : heatIsWeak(bucket)
                                  ? 'var(--heat-contour)'
                                  : 'none'
                            }
                            strokeDasharray={bucket === HEAT_MISSING ? '3 3' : undefined}
                          />
                          {
                            /* Values that cannot fit the band stay in the tooltip and table. */ cellW >=
                              text.length * 7 + 8 && (
                              <text
                                x={cellX(row.month) + cellW / 2}
                                y={cellY(row.year) + 23}
                                textAnchor="middle"
                                fill={
                                  bucket === HEAT_MISSING
                                    ? 'var(--text-muted)'
                                    : `var(--heat-${bucket}-text)`
                                }
                                fontSize={12}
                                data-sans
                              >
                                {text}
                              </text>
                            )
                          }
                        </g>
                      )
                    })}
                    {years.map((year) => (
                      <text
                        key={year}
                        x={0}
                        y={cellY(year) + 23}
                        fill="var(--text-muted)"
                        fontSize={12}
                        data-sans
                      >
                        {year}
                      </text>
                    ))}
                    {Array.from({ length: 12 }, (_, index) => (
                      <text
                        key={index}
                        x={cellX(index + 1) + cellW / 2}
                        y={gridHeight - 7}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize={12}
                        data-sans
                      >
                        {monthName(index + 1, narrow ? 'narrow' : 'short')}
                      </text>
                    ))}
                  </>
                )
              }}
            </KuukiChart>
          )}
        </LazyChart>
        <div className="ov3-heat-year-totals">
          {scope.figures.byYear
            .filter((row) => years.includes(row.year))
            .map((row) => (
              <span key={row.key}>
                {row.year}: {flights(locale, row.flights)}
              </span>
            ))}
        </div>
        <div className="ov3-rhythm-key">
          <p className="ov3-chart-caption">{monthlyBase}</p>
          <HeatKey entries={monthlyKey} />
        </div>
        {baseline.years.length > 6 && (
          <button className="ov3-rhythm-more" onClick={() => setShowAll(!showAll)}>
            {showAll
              ? copy(locale, 'Show latest 6 years', 'Последние 6 лет')
              : `${copy(locale, 'Show all years', 'Все годы')}, ${baseline.years.at(-1)}–${baseline.years[6]}`}
          </button>
        )}
      </div>
      <div className="ov3-rhythm-group">
        <h3 className="ov3-chart-caption">{dailyCaption}</h3>
        {series.dailyAvailable ? (
          <>
            <label className="ov3-activity-year">
              {copy(locale, 'Calendar year', 'Год календаря')}
              <select
                value={selectedYear}
                onChange={(event) => setActivityYear(Number(event.target.value))}
              >
                {baseline.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <LazyChart height={224} label={dailyCaption}>
              {(inView) => (
                <KuukiChart
                  points={days}
                  height={(width) => calendarHeight(dayColumns, width)}
                  fit={(available) => calendarWidth(dayColumns, available)}
                  scrollEnd
                  inView={inView}
                  ariaLabel={`${dailyCaption} · ${selectedYear}`}
                  onPick={(point) => pickDay(point.key)}
                  actions={(point) => [
                    { label: filterLabel(locale), run: () => pickDay(point.key) },
                  ]}
                  tip={(points) => (
                    <span>
                      {points[0].label}
                      {!points[0].datum.missing &&
                        ` · ${copy(locale, 'completed flights', 'завершённых перелётов')}`}
                    </span>
                  )}
                  table={{
                    caption: dailyCaption,
                    columns: [
                      { key: 'date', label: copy(locale, 'Date', 'Дата') },
                      {
                        key: 'count',
                        label: copy(locale, 'Completed flights', 'Завершённые перелёты'),
                        numeric: true,
                      },
                    ],
                    rows: days.map(({ datum }) => ({
                      date: datum.date,
                      count: datum.missing ? '—' : datum.count,
                    })),
                  }}
                >
                  {(mark, { width }) => (
                    <ArcActivityHeatmap points={days} locale={locale} width={width} mark={mark} />
                  )}
                </KuukiChart>
              )}
            </LazyChart>
            <div className="ov3-rhythm-key">
              <p className="ov3-chart-caption">
                {copy(locale, 'Completed flights per day', 'Завершённых перелётов в день')}
              </p>
              <HeatKey entries={dailyKey} />
            </div>
          </>
        ) : (
          <p>
            {copy(
              locale,
              'Daily activity is unavailable in this older monthly summary.',
              'В старой месячной сводке нет дневной активности.',
            )}
          </p>
        )}
      </div>
    </>
  )
}
export function Section({ span }: { span: Span }) {
  const { scope, locale } = useOverview()
  const [metric, setMetric] = useState<Metric>('flights')
  const [showAll, setShowAll] = useState(false)
  const [activityYear, setActivityYear] = useState<number | null>(null)
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar')
  if (!scope || scope.rhythm.status !== 'ready') return null
  return (
    <div className="ov3-rhythm" data-span={span}>
      <SegmentedControl
        value={view}
        onChange={setView}
        label={copy(locale, 'Rhythm view', 'Вид ритма')}
        options={[
          { value: 'calendar', label: copy(locale, 'Calendar', 'Календарь') },
          { value: 'timeline', label: copy(locale, 'Over time', 'Со временем') },
        ]}
      />
      {view === 'calendar' ? (
        <CalendarContent
          metric={metric}
          setMetric={setMetric}
          showAll={showAll}
          setShowAll={setShowAll}
          activityYear={activityYear}
          setActivityYear={setActivityYear}
        />
      ) : (
        <TimelineContent span={span} />
      )}
    </div>
  )
}
