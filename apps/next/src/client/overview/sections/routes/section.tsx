'use client'

import type { ReactNode, SVGProps } from 'react'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { routeArrow } from '@kuuki/shared/overview/filter'
import type { RankRow } from '@kuuki/shared/overview/rankings'
import type { Routes } from '@kuuki/shared/overview/routes'
import { Button } from '../../../ui/button'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { StageRows } from '../../charts/stage-rows'
import { forms } from '../../copy'
import { ChapterCard } from '../../layout/chapter-card'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import { formatCount, type Locale } from '../../../../lib/format'
import { copy, filterLabel, flights, number, percent } from '../rankings/display'
import type { Span } from '../registry'
import { BAR_MARGIN, barsWidth } from '../crossings/bars'
import { PassCardFigure } from './figure'
import './routes.css'

type YearRow = { key: string; year: number; flights: number; newRoutes: number }

const HEIGHT = 220,
  BAND_MIN = 52,
  BAND_MAX = 72
// One band per year, like Crossings, with wider bands.

function headline(
  locale: Locale,
  profile: 'commuter' | 'explorer' | 'mixed',
  distinct: number,
  total: number,
  top: string | null,
) {
  const routes = formatCount(locale, distinct, forms.routes)
  if (profile === 'commuter')
    return top
      ? copy(locale, `Commuter — ${top} on repeat`, `Челнок — ${top} по кругу`)
      : copy(locale, 'Commuter — the same few routes', 'Челнок — всё те же маршруты')
  if (profile === 'explorer')
    return copy(
      locale,
      `Explorer — ${routes} in ${flights(locale, total)}`,
      `Исследователь — ${routes} за ${flights(locale, total)}`,
    )
  return copy(
    locale,
    `Mixed — ${routes} in ${flights(locale, total)}`,
    `Вперемешку — ${routes} за ${flights(locale, total)}`,
  )
}

function YearBars({
  rows,
  width,
  mark,
}: {
  rows: readonly YearRow[]
  width: number
  mark: (row: YearRow) => SVGProps<SVGGElement>
}) {
  const plot = HEIGHT - BAR_MARGIN.top - BAR_MARGIN.bottom,
    max = Math.max(1, ...rows.map((row) => row.flights)),
    base = HEIGHT - BAR_MARGIN.bottom,
    column = width / Math.max(1, rows.length),
    bar = column * 0.34
  return (
    <g>
      {rows.map((row, i) => {
        const left = i * column + column * 0.15,
          series = [
            { value: row.flights, fill: 'var(--mark-1)', x: left },
            { value: row.newRoutes, fill: 'var(--mark-2)', x: left + bar + column * 0.02 },
          ]
        const body = (
          <>
            <rect x={i * column} y={0} width={column} height={HEIGHT} fill="transparent" />
            {series.map(({ value, fill, x }) => {
              const h = (value / max) * plot
              return (
                <g key={fill}>
                  {value > 0 && (
                    <rect x={x} y={base - h} width={bar} height={h} rx={3} fill={fill} />
                  )}
                  <text
                    x={x + bar / 2}
                    y={base - h - 8}
                    textAnchor="middle"
                    fontSize={12}
                    fill="var(--text)"
                    aria-hidden="true"
                  >
                    {row.flights === 0 ? '' : value}
                  </text>
                </g>
              )
            })}
          </>
        )
        return (
          <g key={row.key}>
            <g {...mark(row)}>{body}</g>
            <text
              x={i * column + column / 2}
              y={HEIGHT - BAR_MARGIN.bottom + 20}
              textAnchor="middle"
              fontSize={12}
              fill="var(--text-muted)"
              aria-hidden="true"
            >
              {row.year}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** The unit beside a count ("routes", "flights"), in the plural form the count takes. */
const unitOf = (locale: Locale, n: number, set: typeof forms.routes) =>
  formatCount(locale, n, set).replace(number(locale, n), '').trim()

const PROFILE = {
  commuter: { en: 'Commuter', ru: 'Челнок' },
  explorer: { en: 'Explorer', ru: 'Исследователь' },
  mixed: { en: 'Mixed', ru: 'Вперемешку' },
} as const
const DRY = {
  commuter: {
    en: 'Commuter: the boarding pass could be laminated.',
    ru: 'Челнок: посадочный можно ламинировать.',
  },
  explorer: {
    en: 'Explorer: the map is not a loyalty scheme.',
    ru: 'Исследователь: карта — не программа лояльности.',
  },
  mixed: { en: 'Mixed: neither loyal nor lost.', ru: 'Вперемешку: ни верности, ни потерянности.' },
} as const

function Code({ children }: { children: string }) {
  return <span className="ov3-routes-code">{children}</span>
}

/** The per-year chart: flights and new routes by year. A year pick sets the page's period, as it always did. */
function YearChart({ data }: { data: Routes }) {
  const { locale, actions, isCurrent } = useOverview()
  const points: ChartPoint<YearRow>[] = data.byYear
    .filter((row) => row.flights > 0)
    .map((row) => ({
      key: row.key,
      datum: row,
      label: `${row.year} · ${flights(locale, row.flights)} · ${copy(locale, 'new routes', 'новых маршрутов')} ${number(locale, row.newRoutes)}`,
    }))
  const pick = (year: number) => {
    if (isCurrent()) actions.setPeriod({ years: [year] })
  }
  const pointOf = new Map(points.map((point) => [point.datum.key, point]))
  const caption = copy(
    locale,
    'Flights and new routes per year',
    'Перелёты и новые маршруты по годам',
  )
  return (
    <div className="ov3-routes-years">
      <p className="ov3-routes-legend" aria-hidden="true">
        <span>
          <i />
          {copy(locale, 'Flights', 'Перелёты')}
        </span>
        <span>
          <i />
          {copy(locale, 'New routes', 'Новые маршруты')}
        </span>
      </p>
      <LazyChart height={HEIGHT + 64} label={caption}>
        {(inView) => (
          <KuukiChart
            points={points}
            height={HEIGHT}
            fit={(available) => barsWidth(data.byYear.length, available, BAND_MIN, BAND_MAX)}
            inView={inView}
            ariaLabel={caption}
            onPick={(point) => pick(point.datum.year)}
            actions={(point) => [{ label: filterLabel(locale), run: () => pick(point.datum.year) }]}
            tip={(items) => <span>{items[0].label}</span>}
            table={{
              caption,
              columns: [
                { key: 'year', label: copy(locale, 'Year', 'Год') },
                { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
                {
                  key: 'newRoutes',
                  label: copy(locale, 'New routes', 'Новые маршруты'),
                  numeric: true,
                },
              ],
              rows: data.byYear,
            }}
          >
            {(mark, { width }) => (
              <YearBars
                rows={data.byYear}
                width={width}
                mark={(row) => {
                  const point = pointOf.get(row.key)
                  return point ? mark(point) : {}
                }}
              />
            )}
          </KuukiChart>
        )}
      </LazyChart>
    </div>
  )
}

export function Section({ span }: { span: Span }) {
  const { scope, filter, locale, actions, isCurrent } = useOverview()
  const gate = scope ? SECTION_GATES.routes.gate(scope) : null
  const data = scope?.routes.status === 'ready' ? scope.routes.value : null
  const rows: RankRow[] = scope ? scope.rankings.routes.slice(0, 5) : []
  const keys = rows.map((row) => row.key)
  const r = useReading(keys, keys[0] ?? null)
  const state = !scope ? 'loading' : gate?.status === 'below' || !data ? 'empty' : 'ready'
  const reading = r.reading
  const row = rows.find((candidate) => candidate.key === reading)
  const arrow = reading ? routeArrow(reading) : ''
  const caption = copy(locale, 'Most-flown routes', 'Самые частые маршруты')
  const add = (key: string) => {
    if (isCurrent()) actions.add('routes', key)
  }

  let hero: { value: string; unit?: string; caption: ReactNode } = { value: '', caption: null }
  if (data && row) {
    if (r.isHeadline) {
      const repeats = copy(
        locale,
        `${percent(data.repeatShare)} on repeat routes`,
        `${percent(data.repeatShare)} — на повторяющихся маршрутах`,
      )
      hero = {
        value: number(locale, data.distinct),
        unit: unitOf(locale, data.distinct, forms.routes),
        caption: (
          <>
            {repeats}
            {data.top ? (
              <>
                {' · '}
                <Code>{routeArrow(data.top.key)}</Code> ×{number(locale, data.top.count)}
              </>
            ) : null}
            {'. '}
            {copy(locale, DRY[data.profile].en, DRY[data.profile].ru)}
          </>
        ),
      }
    } else {
      const place = rows.indexOf(row) + 1
      hero = {
        value: number(locale, row.count),
        unit: unitOf(locale, row.count, forms.flights),
        caption: (
          <>
            <Code>{arrow}</Code>
            {copy(
              locale,
              ` · ${percent(row.count / data.flights)} of flights, number ${place} on the board.`,
              ` · ${percent(row.count / data.flights)} перелётов, ${place}-е место в списке.`,
            )}
          </>
        ),
      }
    }
  }

  const points: ChartPoint<RankRow>[] = rows.map((datum) => ({
    key: datum.key,
    datum,
    label: `${routeArrow(datum.key)}, ${flights(locale, datum.count)}`,
  }))
  const home = scope?.home?.iata ?? null
  const columns = data
    ? [
        {
          value: copy(locale, PROFILE[data.profile].en, PROFILE[data.profile].ru),
          label: copy(locale, 'Profile', 'Профиль'),
        },
        ...(data.homeShare !== null && home
          ? [
              {
                value: percent(data.homeShare),
                label: copy(locale, `Home share, ${home}`, `Доля дома, ${home}`),
              },
            ]
          : []),
      ]
    : []
  return (
    <ChapterCard
      state={state}
      figure={
        <PassCardFigure
          share={state === 'ready' && data ? data.repeatShare : 0}
          route={state === 'ready' ? arrow : ''}
          picked={r.picked}
        />
      }
      figureButton={{
        label: copy(locale, 'Show next route', 'Показать следующий маршрут'),
        onPress: r.next,
      }}
      hero={{
        ...hero,
        only:
          !r.isHeadline && reading && !filter.routes?.includes(reading)
            ? {
                label: copy(locale, `Only ${arrow}`, `Только ${arrow}`),
                onPress: () => add(reading),
              }
            : null,
      }}
      rollValue={r.picked}
      chart={{
        table: {
          caption,
          columns: [
            { key: 'route', label: copy(locale, 'Route', 'Маршрут') },
            { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
          ],
          rows: rows.map((datum) => ({
            route: routeArrow(datum.key),
            flights: datum.count,
          })),
        },
        caption,
        plot: (
          <LazyChart height={rows.length * 24} label={caption}>
            {(inView) => (
              <StageRows
                points={points}
                span={span}
                value={(point) => point.datum.count}
                selectedKey={reading}
                appliedKeys={filter.routes}
                mono
                name={(point) => routeArrow(point.datum.key)}
                inView={inView}
                ariaLabel={caption}
                onPick={(point) => r.pick(point.datum.key)}
                actions={(point) => [
                  { label: filterLabel(locale), run: () => add(point.datum.key) },
                ]}
                tip={(items) => <span>{items[0].label}</span>}
              />
            )}
          </LazyChart>
        ),
      }}
      details={
        data
          ? {
              heading: copy(locale, 'Route habits', 'Привычки по маршрутам'),
              columns,
              coverage: headline(
                locale,
                data.profile,
                data.distinct,
                data.flights,
                data.top ? routeArrow(data.top.key) : null,
              ),
              more: [
                {
                  summary: copy(
                    locale,
                    'Flights and new routes per year',
                    'Перелёты и новые маршруты по годам',
                  ),
                  content: <YearChart data={data} />,
                },
              ],
            }
          : undefined
      }
      empty={{
        title:
          gate?.status === 'below'
            ? copy(
                locale,
                `Routes need ${number(locale, gate.need)} flights`,
                `Для маршрутов нужно ${flights(locale, gate.need)}`,
              )
            : copy(locale, 'No routes yet', 'Маршрутов пока нет'),
        line:
          gate?.status === 'below'
            ? copy(
                locale,
                `This filter leaves ${flights(locale, gate.have)}. Too few to call it a network.`,
                `Фильтр оставляет ${flights(locale, gate.have)}. Для сети маловато.`,
              )
            : copy(
                locale,
                'This filter leaves no route to draw. The network is a blank page.',
                'Фильтр не оставил ни одного маршрута. Сеть пока чистый лист.',
              ),
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
