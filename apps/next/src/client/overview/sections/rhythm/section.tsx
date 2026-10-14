'use client'

import { useState } from 'react'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { formatCount, type CountForms } from '../../../../lib/format'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { StageColumns, type StageTick } from '../../charts/stage-columns'
import { LazyChart } from '../../charts/lazy-chart'
import type { ChartPoint } from '../../charts/kuuki-chart'
import { ChapterCard } from '../../layout/chapter-card'
import { useReading } from '../../layout/use-reading'
import { monthName } from '../../page/scope-title'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { TimelineContent } from '../timeline/section'
import { copy, filterLabel, flights, percent } from '../rankings/display'
import { DailyActivity, YearByMonth, type Metric } from './grids'
import { RhythmStamper } from './figure'
import { monthMarks, monthTotals, yearMarks } from './marks'
import './rhythm.css'

type View = 'history' | 'calendar' | 'timeline'
type Row = { key: string; flights: number; month: number; year: number }

const MONTHS: CountForms = {
  en: { one: '{count} month', other: '{count} months' },
  ru: {
    one: '{count} месяц',
    few: '{count} месяца',
    many: '{count} месяцев',
    other: '{count} месяца',
  },
}
const pad = (month: number) => String(month).padStart(2, '0')
const monthKey = (month: number) => `m${pad(month)}`
const yearKey = (year: number) => `y${year}`
// The stage's width on the sheet and on the desktop card; twelve columns fill it at these sizes, and more years squeeze the pitch.
const AVAILABLE = { sheet: 342, full: 636 }
const COLUMNS = { sheet: { barWidth: 20, pitch: 29 }, full: { barWidth: 40, pitch: 52 } }
// The least a year label (four mono digits) needs between two ticks.
const TICK_GAP = 34

function columnsFor(count: number, span: Span) {
  if (count <= 12) return COLUMNS[span]
  const pitch = Math.max(6, Math.floor(AVAILABLE[span] / (count - 0.31)))
  return { barWidth: Math.max(4, Math.round(pitch * 0.69)), pitch }
}
const ordinal = (locale: 'en' | 'ru', n: number) =>
  locale === 'ru'
    ? `${n}-й`
    : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, locale, actions, isCurrent } = useOverview()
  const [chosenView, setView] = useState<View | null>(null)
  const [metric, setMetric] = useState<Metric>('flights')
  const [showAll, setShowAll] = useState(false)
  const [activityYear, setActivityYear] = useState<number | null>(null)
  const data = scope?.rhythm.status === 'ready' ? scope.rhythm.value : null
  const hasHistory = span === 'full' && (data?.years.length ?? 0) > 1
  const view =
    chosenView === 'history' && !hasHistory
      ? 'calendar'
      : (chosenView ?? (hasHistory ? 'history' : 'calendar'))
  const calendar = view === 'calendar'
  const history = view === 'history'
  const historyYears = showAll ? data?.years : data?.years.slice(0, 6)
  const cap = (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)

  // History reads dated months; seasonality combines calendar months; Years reads yearly totals.
  const rows: Row[] = !data
    ? []
    : history
      ? data.cells.filter(
          (row) =>
            historyYears?.includes(row.year) && row.key <= (payload?.generatedAt.slice(0, 7) ?? ''),
        )
      : calendar
        ? monthTotals(data).map((count, index) => ({
            key: monthKey(index + 1),
            flights: count,
            month: index + 1,
            year: 0,
          }))
        : (scope?.figures.byYear ?? []).map((row) => ({
            key: yearKey(row.year),
            flights: row.flights,
            month: 0,
            year: row.year,
          }))
  const filled = rows.filter((row) => row.flights > 0)
  // The busiest month is the rhythm's own; the busiest year is the latest of any tie.
  const busiest = calendar
    ? data?.busiestMonthOfYear
      ? monthKey(data.busiestMonthOfYear.month)
      : null
    : (filled.reduce<Row | null>(
        (best, row) =>
          !best ||
          row.flights > best.flights ||
          (row.flights === best.flights && row.key > best.key)
            ? row
            : best,
        null,
      )?.key ?? null)
  const r = useReading(
    (history ? rows : filled).map((row) => row.key),
    busiest,
  )
  const at = rows.findIndex((row) => row.key === r.reading)
  const reading = at < 0 ? null : rows[at]
  const total = rows.reduce((sum, row) => sum + row.flights, 0)
  const marks = calendar
    ? monthMarks(
        rows.map((row) => row.flights),
        locale,
      )
    : history
      ? rows.map((row) => ({
          band: `${pad(row.month)}/${String(row.year).slice(-2)}`,
          print: `${pad(row.month)}/${String(row.year).slice(-2)}`,
          flights: flights(locale, row.flights).toLocaleUpperCase(locale),
        }))
      : yearMarks(rows, locale)

  const yearsApplied = filter.period && 'years' in filter.period ? filter.period.years : []
  const applied = (row: Row) =>
    history
      ? !!filter.period &&
        'from' in filter.period &&
        filter.period.from === row.key &&
        filter.period.to === row.key
      : calendar
        ? (filter.months ?? []).includes(row.month)
        : yearsApplied.length === 1 && yearsApplied[0] === row.year
  const only = (row: Row) => {
    if (!isCurrent()) return
    if (history) actions.setPeriod({ from: row.key, to: row.key })
    else if (calendar) actions.add('months', row.month)
    else actions.setPeriod({ years: [row.year] })
  }
  const nameOf = (row: Row) =>
    history
      ? `${monthName(locale, row.month)} ${row.year}`
      : calendar
        ? monthName(locale, row.month)
        : String(row.year)

  const gate = scope && SECTION_GATES.rhythm.gate(scope)
  const missing = gate?.status === 'below' ? gate : null
  const state = !scope || !all || !payload ? 'loading' : data ? 'ready' : 'empty'

  const gap = data?.longestGap ?? null
  const rank = reading ? 1 + rows.filter((row) => row.flights > reading.flights).length : 0
  const share = total > 0 && reading ? percent(reading.flights / total) : ''
  let caption = ''
  if (reading && r.isHeadline) {
    caption = calendar
      ? gap
        ? copy(
            locale,
            `Busiest month · longest gap ${formatCount('en', gap.months, MONTHS)}`,
            `Самый активный месяц · самый долгий перерыв — ${formatCount('ru', gap.months, MONTHS)}`,
          )
        : copy(locale, 'Busiest month', 'Самый активный месяц')
      : copy(
          locale,
          `Busiest year · ${share} of your flights`,
          `Самый активный год · ${share} перелётов`,
        )
  } else if (reading) {
    caption = calendar
      ? copy(
          locale,
          `${ordinal('en', rank)} busiest month · ${share} of your flights`,
          `${ordinal('ru', rank)} по загруженности месяц · ${share} перелётов`,
        )
      : copy(
          locale,
          `${ordinal('en', rank)} busiest year · ${share} of your flights`,
          `${ordinal('ru', rank)} по загруженности год · ${share} перелётов`,
        )
  }

  if (history && reading) {
    caption = r.isHeadline
      ? copy(
          locale,
          'Busiest shown month · by flights',
          'Самый активный месяц на графике · по перелётам',
        )
      : copy(locale, `${share} of shown flights`, `${share} перелётов на графике`)
  }

  const chartCaption = history
    ? copy(locale, 'Year by month', 'Год по месяцам')
    : calendar
      ? copy(locale, 'Flights by month · all years', 'Перелёты по месяцам · все годы')
      : copy(locale, 'Flights by year', 'Перелёты по годам')
  const points: ChartPoint<Row>[] = rows.map((row) => ({
    key: row.key,
    datum: row,
    label: `${nameOf(row)} · ${flights(locale, row.flights)}`,
  }))
  const narrow = new Intl.DateTimeFormat(locale, { month: 'narrow', timeZone: 'UTC' })
  const layout = columnsFor(rows.length, span)
  const every = calendar ? 1 : Math.max(1, Math.ceil(TICK_GAP / layout.pitch))
  const ticks: StageTick[] = rows.flatMap((row, index) =>
    (rows.length - 1 - index) % every === 0
      ? [
          {
            index,
            text: calendar ? narrow.format(Date.UTC(2001, row.month - 1, 1)) : String(row.year),
          },
        ]
      : [],
  )
  const appliedKeys = rows.filter(applied).map((row) => row.key)

  const busiestMonth = data?.busiestMonthOfYear ?? null
  const columns = data
    ? [
        {
          value: busiestMonth ? monthName(locale, busiestMonth.month) : '—',
          label: copy(locale, 'Busiest month', 'Самый активный месяц'),
        },
        {
          value: gap ? `${gap.months} ${copy(locale, 'mo', 'мес.')}` : '—',
          label: `${copy(locale, 'Longest gap', 'Самый длинный перерыв')}${gap ? ` · ${gap.from}–${gap.to}` : ''}`,
        },
      ]
    : []

  return (
    <ChapterCard
      state={state}
      figure={
        <RhythmStamper marks={marks} at={reading ? at : null} picked={r.picked} wrap={calendar} />
      }
      figureButton={
        filled.length > 1
          ? {
              label:
                calendar || history
                  ? copy(locale, 'Show next month', 'Показать следующий месяц')
                  : copy(locale, 'Show next year', 'Показать следующий год'),
              onPress: r.next,
            }
          : undefined
      }
      hero={{
        value: reading ? (calendar || history ? cap(nameOf(reading)) : nameOf(reading)) : '—',
        unit: reading ? flights(locale, reading.flights) : undefined,
        caption,
        only:
          !r.isHeadline && reading && !applied(reading)
            ? {
                label: copy(locale, `Only ${nameOf(reading)}`, `Только ${nameOf(reading)}`),
                onPress: () => only(reading),
              }
            : null,
      }}
      rollValue={r.picked}
      chart={{
        layout: 'content',
        table: history
          ? undefined
          : {
              caption: chartCaption,
              columns: [
                {
                  key: 'label',
                  label: calendar ? copy(locale, 'Month', 'Месяц') : copy(locale, 'Year', 'Год'),
                },
                { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
              ],
              rows: rows.map((row) => ({ label: nameOf(row), flights: row.flights })),
            },
        caption: chartCaption,
        toggle: (
          <SegmentedControl
            dense
            value={view}
            onChange={setView}
            label={copy(locale, 'Rhythm view', 'Вид ритма')}
            options={[
              ...(hasHistory
                ? [{ value: 'history' as const, label: copy(locale, 'History', 'История') }]
                : []),
              { value: 'calendar', label: copy(locale, 'Seasonality', 'Сезонность') },
              { value: 'timeline', label: copy(locale, 'Years', 'Годы') },
            ]}
          />
        ),
        plot: history ? (
          <YearByMonth
            metric={metric}
            setMetric={setMetric}
            showAll={showAll}
            setShowAll={setShowAll}
            reading={{ key: r.reading, pick: r.pick }}
          />
        ) : (
          <LazyChart height={span === 'full' ? 206 : 176} label={chartCaption}>
            {(inView) => (
              <StageColumns
                span={span}
                points={points}
                value={(point) => point.datum.flights}
                selectedKey={r.reading}
                appliedKeys={appliedKeys}
                ticks={ticks}
                tallest
                inView={inView}
                ariaLabel={chartCaption}
                barWidth={layout.barWidth}
                pitch={layout.pitch}
                onPick={(point) => {
                  if (point.datum.flights > 0) r.pick(point.key)
                }}
                actions={(point) => [{ label: filterLabel(locale), run: () => only(point.datum) }]}
                tip={(items) => <span>{items[0].label}</span>}
              />
            )}
          </LazyChart>
        ),
      }}
      details={{
        heading: copy(locale, 'Peaks and gaps', 'Пики и перерывы'),
        columns,
        more: [
          ...(calendar
            ? []
            : [
                {
                  summary: copy(locale, 'Distance over time', 'Расстояние со временем'),
                  content: <TimelineContent span={span} />,
                },
              ]),
          ...(!hasHistory
            ? [
                {
                  summary: copy(locale, 'Year by month', 'Год по месяцам'),
                  content: (
                    <YearByMonth
                      metric={metric}
                      setMetric={setMetric}
                      showAll={showAll}
                      setShowAll={setShowAll}
                    />
                  ),
                },
              ]
            : []),
          {
            summary: copy(locale, 'Daily activity', 'Дневная активность'),
            content: (
              <DailyActivity activityYear={activityYear} setActivityYear={setActivityYear} />
            ),
          },
        ],
      }}
      empty={{
        title: copy(locale, 'Too few months for a rhythm', 'Слишком мало месяцев для ритма'),
        line: missing
          ? copy(
              locale,
              `Months with flights ${missing.have} of ${missing.need} required`,
              `Месяцев с перелётами ${missing.have} из ${missing.need} нужных`,
            )
          : '',
        action: (
          <Button
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
