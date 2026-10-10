'use client'

import type { SVGProps } from 'react'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { forms } from '../../copy'
import { useOverview } from '../../store/overview-context'
import { formatCount, type Locale } from '../../../../lib/format'
import { copy, filterLabel, flights, number, percent } from '../rankings/display'
import type { Span } from '../registry'
import { BAR_MARGIN } from '../crossings/bars'
import './routes.css'

type YearRow = { key: string; year: number; flights: number; newRoutes: number }

const HEIGHT = 220,
  BAND_MIN = 52,
  BAND_MAX = 72
// One band per year, like Crossings: it grows with the card up to BAND_MAX and stops at BAND_MIN (the host scrolls instead).
const bandsWidth = (years: number, available: number) =>
  Math.max(1, years) * Math.min(BAND_MAX, Math.max(BAND_MIN, available / Math.max(1, years)))

export const arrow = (key: string) => key.replace('-', ' ↔ ')

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

export function Section({ span }: { span: Span }) {
  const { scope, payload, locale, actions, isCurrent } = useOverview()
  if (!scope) return null
  const gate = scope.routes
  if (gate.status !== 'ready') return null
  const data = gate.value,
    home = scope.home?.iata ?? null
  const city = (code: string) => payload?.refs.airports[code]?.city ?? code
  const topName = data.top ? arrow(data.top.key) : null
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
    <div className="ov3-routes" data-span={span}>
      <p className="ov3-routes-headline">
        {headline(locale, data.profile, data.distinct, data.flights, topName)}
      </p>
      <div className="ov3-routes-tiles">
        <div className="ov3-routes-tile">
          <p>{copy(locale, 'Distinct routes', 'Разных маршрутов')}</p>
          <strong>{number(locale, data.distinct)}</strong>
          <small>{flights(locale, data.flights)}</small>
        </div>
        <div className="ov3-routes-tile">
          <p>{copy(locale, 'Repeat share', 'Доля повторов')}</p>
          <strong>{percent(data.repeatShare)}</strong>
          <small>
            {copy(
              locale,
              "flights on routes you've flown before",
              'перелётов по уже знакомым маршрутам',
            )}
          </small>
        </div>
        {data.top && topName && (
          <div className="ov3-routes-tile">
            <p>{copy(locale, 'Top route', 'Главный маршрут')}</p>
            <strong>{topName}</strong>
            <small>
              {data.top.key.split('-').map(city).join(' ↔ ')} · ×{number(locale, data.top.count)}
            </small>
          </div>
        )}
        {data.homeShare !== null && home && (
          <div className="ov3-routes-tile">
            <p>{copy(locale, 'Home share', 'Доля дома')}</p>
            <strong>{percent(data.homeShare)}</strong>
            <small>{copy(locale, `from or to ${home}`, `из ${home} или в ${home}`)}</small>
          </div>
        )}
      </div>
      <h3 className="ov3-chart-caption">{caption}</h3>
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
            fit={(available) => bandsWidth(data.byYear.length, available)}
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
