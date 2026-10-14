'use client'

import type { ReactNode } from 'react'
import type { RecordRef } from '@kuuki/shared/overview/model'
import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { isEmptyFilter, routeKey } from '@kuuki/shared/overview/filter'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { dateInstant } from '@kuuki/shared/overview/records'
import { formatDateOnly, formatDuration } from '../../../../lib/format'
import { Disclosure } from '../../../ui/disclosure'
import { Button } from '../../../ui/button'
import { StageRows } from '../../charts/stage-rows'
import { LazyChart } from '../../charts/lazy-chart'
import { TableView } from '../../charts/table-view'
import { mapPin } from '../../iso/map'
import { ChapterCard } from '../../layout/chapter-card'
import { reducedMotion } from '../../layout/drag-motion'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import { useOpenFlight } from '../../store/open-flight'
import type { Span } from '../registry'
import { copy, flights, number, percent } from '../rankings/display'
import { RecordMapFigure, type Leg } from './figure'
import './records.css'

type Route = { origin: string; destination: string; km: number; flights: number }
const keyOf = (route: Pick<Route, 'origin' | 'destination'>) =>
  `${route.origin}-${route.destination}`
const arrow = (route: Pick<Route, 'origin' | 'destination'>) =>
  `${route.origin} → ${route.destination}`

export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, locale, aggregate, ownerKey, actions, bus, isCurrent } =
    useOverview()
  const openFlight = useOpenFlight()
  const gate = scope?.records
  const data = gate?.status === 'ready' ? gate.value : null
  const lead = data?.longest ?? null
  // The five longest routes, the headline first. A journal whose route list is empty still has its one longest flight.
  const routes: Route[] = data?.longest5.length
    ? data.longest5
    : lead
      ? [{ origin: lead.origin, destination: lead.destination, km: lead.value, flights: 1 }]
      : []
  const keys = routes.map(keyOf)
  const r = useReading(keys, keys[0] ?? null)
  const airports = payload?.refs.airports
  const legs = new Map<string, Leg>(
    routes.map((route) => {
      const from = airports?.[route.origin],
        to = airports?.[route.destination]
      return [
        keyOf(route),
        {
          key: keyOf(route),
          from: mapPin(route.origin, from),
          to: mapPin(route.destination, to),
          equator: from?.lat != null && to?.lat != null && from.lat * to.lat < 0,
        },
      ]
    }),
  )
  const reading = routes.find((route) => keyOf(route) === r.reading) ?? routes[0] ?? null
  const kmText = (route: Route) => number(locale, Math.round(route.km))
  const filterRoute = (route: Pick<Route, 'origin' | 'destination'>) => {
    if (isCurrent()) actions.add('routes', routeKey(route.origin, route.destination))
  }

  const state = !scope || !payload ? 'loading' : data ? 'ready' : 'empty'
  const gated = scope ? SECTION_GATES.records.gate(scope) : null
  if (state !== 'ready' || !data || !payload) {
    return (
      <ChapterCard
        state={state === 'loading' ? 'loading' : 'empty'}
        figure={<RecordMapFigure legs={legs} reading={null} picked={false} />}
        hero={{ value: '', caption: null }}
        chart={{ caption: '', plot: null }}
        empty={{
          title: copy(locale, 'Records', 'Рекорды'),
          line:
            gated?.status === 'below'
              ? copy(
                  locale,
                  `${number(locale, gated.have)} of ${flights(locale, gated.need)} required`,
                  `Перелётов ${number(locale, gated.have)} из ${number(locale, gated.need)} нужных`,
                )
              : copy(locale, 'Distance unknown', 'Расстояние неизвестно'),
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

  const short = data.shortest,
    busy = data.busiestYear
  const lifetime = all?.records.status === 'ready' ? all.records.value : null
  const filtered = !isEmptyFilter(filter)
  const meaningfulRange = short && lead && short.value > 0 && short.value < lead.value
  const places = (record: Pick<RecordRef, 'origin' | 'destination'>) =>
    [record.origin, record.destination]
      .map((iata) => airports?.[iata]?.city || airports?.[iata]?.name || iata)
      .join(' → ')
  const baseline =
    all && lifetime?.shortest && lifetime.longest ? (
      <p>
        {copy(
          locale,
          `Whole journal: ${number(locale, lifetime.shortest.value)}–${number(locale, lifetime.longest.value)} km across ${flights(locale, all.figures.flights)}.`,
          `Весь журнал: ${number(locale, lifetime.shortest.value)}–${number(locale, lifetime.longest.value)} км · ${flights(locale, all.figures.flights)}.`,
        )}
      </p>
    ) : null
  const open = (record: { flightId: number | null; origin: string; destination: string }) => {
    if (!aggregate && ownerKey !== 'dev' && record.flightId !== null && isCurrent()) {
      bus.setFocusRoute(routeKey(record.origin, record.destination))
      openFlight(record.flightId)
    }
  }
  const affordance = (
    record: { flightId: number | null; origin: string; destination: string } | null,
  ) =>
    record && !aggregate && ownerKey !== 'dev' && record.flightId !== null ? (
      <Button dense variant="secondary" onClick={() => open(record)}>
        {copy(locale, 'Open flight', 'Открыть перелёт')} ↗
      </Button>
    ) : null
  const route = (record: Pick<RecordRef, 'origin' | 'destination'> | null) =>
    record ? arrow(record) : '—'
  const filterRecord = (record: Pick<RecordRef, 'origin' | 'destination'> | null) => {
    if (record) filterRoute(record)
  }
  const monthName = (month: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(`2000-${String(month).padStart(2, '0')}-01T00:00:00Z`),
    )
  // A bare flight number says nothing; show it only with its carrier (or when it already carries letters).
  const leadFlight = lead?.flightNumber
    ? /^[A-Za-z]/.test(lead.flightNumber)
      ? lead.flightNumber
      : lead.airline
        ? `${lead.airline} ${lead.flightNumber}`
        : null
    : null
  const rows = [
    {
      record: copy(locale, 'Longest flight', 'Самый длинный перелёт'),
      route: route(lead),
      value: lead ? `${number(locale, lead.value)} ${copy(locale, 'km', 'км')}` : '—',
    },
    {
      record: copy(locale, 'Shortest flight', 'Самый короткий перелёт'),
      route: route(short),
      value: short ? `${number(locale, short.value)} ${copy(locale, 'km', 'км')}` : '—',
    },
    {
      record: copy(locale, 'Busiest year', 'Самый активный год'),
      route: busy ? String(busy.year) : '—',
      value: busy ? flights(locale, busy.flights) : '—',
    },
  ]

  const rank = reading ? keys.indexOf(keyOf(reading)) : -1
  const ordinal = (n: number) =>
    locale === 'ru' ? `${n}-й` : (['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`)
  const caption: ReactNode = !reading
    ? copy(locale, 'Distance unknown', 'Расстояние неизвестно')
    : r.isHeadline
      ? copy(
          locale,
          `Longest flight · ${arrow(reading)} · ${percent(reading.km / EARTH_CIRCUMFERENCE_KM)} of the equator`,
          `Самый длинный перелёт · ${arrow(reading)} · ${percent(reading.km / EARTH_CIRCUMFERENCE_KM)} длины экватора`,
        )
      : copy(
          locale,
          `${ordinal(rank + 1)} longest · ${arrow(reading)} · ${flights(locale, reading.flights)}`,
          `${ordinal(rank + 1)} по длине · ${arrow(reading)} · ${flights(locale, reading.flights)}`,
        )
  const chartCaption = copy(locale, 'Longest routes · km', 'Самые длинные маршруты · км')
  const points = routes.map((row) => ({
    key: keyOf(row),
    datum: row,
    label: `${arrow(row)}, ${kmText(row)} ${copy(locale, 'km', 'км')}, ${flights(locale, row.flights)}`,
  }))
  const appliedKeys = routes
    .filter((row) => filter.routes?.includes(routeKey(row.origin, row.destination)))
    .map(keyOf)
  const cabinet = (
    <div className="ov3-records" data-span={span}>
      <div className="ov3-record-small-grid">
        <div className="ov3-record-inset">
          <p>{copy(locale, 'Shortest flight', 'Самый короткий перелёт')}</p>
          <strong>
            {short ? `${number(locale, short.value)} ${copy(locale, 'km', 'км')}` : '—'}
          </strong>
          <p className="ov3-record-route">{route(short)}</p>
          {short && <p>{places(short)}</p>}
          {meaningfulRange ? (
            <>
              <p>{copy(locale, 'Your distance range', 'Ваш диапазон расстояний')}</p>
              <div className="ov3-record-range" aria-hidden="true" />
              <div className="ov3-record-range-labels">
                <span>
                  {copy(locale, 'Shortest', 'Самый короткий')}
                  <b>
                    {number(locale, short.value)} {copy(locale, 'km', 'км')}
                  </b>
                </span>
                <span>
                  {copy(locale, 'Longest', 'Самый длинный')}
                  <b>
                    {number(locale, lead.value)} {copy(locale, 'km', 'км')}
                  </b>
                </span>
              </div>
              <p>
                {copy(
                  locale,
                  `Longest is about ${number(locale, Math.round((lead.value / short.value) * 10) / 10)}× the shortest · airport-to-airport`,
                  `Самый длинный примерно в ${number(locale, Math.round((lead.value / short.value) * 10) / 10)} раза длиннее короткого · между аэропортами`,
                )}
              </p>
            </>
          ) : (
            <p>
              {copy(
                locale,
                'No distance range in this selection.',
                'В этой выборке нет диапазона расстояний.',
              )}
            </p>
          )}
          {short && (
            <Disclosure summary={copy(locale, 'Flight evidence', 'Данные перелёта')}>
              <p>
                {places(short)}
                {short.date && dateInstant(short.date) !== null
                  ? ` · ${formatDateOnly(locale, short.date, 'medium')}`
                  : ''}
              </p>
              <p>
                {copy(
                  locale,
                  'Great-circle distance, not the flown path.',
                  'Расстояние по большой окружности, а не пройденный путь.',
                )}
              </p>
              {filtered && baseline}
              <div className="ov3-record-actions">
                {affordance(short)}
                <Button dense variant="secondary" onClick={() => filterRecord(short)}>
                  {copy(locale, 'Filter Overview', 'Фильтровать обзор')}
                </Button>
              </div>
            </Disclosure>
          )}
        </div>
        <div className="ov3-record-inset">
          <p>{copy(locale, 'Busiest year', 'Самый активный год')}</p>
          <strong>{busy?.year ?? '—'}</strong>
          <p>{busy ? flights(locale, busy.flights) : '—'}</p>
          {busy && busy.months.filter((month) => month.flights > 0).length >= 2 && (
            <>
              <div
                className="ov3-record-months"
                role="img"
                aria-label={busy.months
                  .map((month) => `${monthName(month.month)}: ${flights(locale, month.flights)}`)
                  .join('; ')}
              >
                {busy.months.map((month) => (
                  <span className="ov3-record-month" key={month.key}>
                    <b>{month.flights || '—'}</b>
                    <i
                      style={{
                        height: `${month.flights === 0 ? 2 : (month.flights / Math.max(1, ...busy.months.map((row) => row.flights))) * 48}px`,
                        background:
                          month.flights === 0
                            ? 'var(--zero)'
                            : month.month === busy.peakMonth
                              ? 'var(--mark-peak)'
                              : 'var(--mark-rest)',
                      }}
                    />
                  </span>
                ))}
              </div>
              <div className="ov3-record-range-labels">
                <span>{monthName(1)}</span>
                <span>{monthName(12)}</span>
              </div>
              <p>
                {copy(locale, 'Peak', 'Пик')}: {monthName(busy.peakMonth)},{' '}
                {flights(locale, busy.months[busy.peakMonth - 1].flights)}
              </p>
            </>
          )}
          {busy && (
            <Disclosure summary={copy(locale, 'Year evidence', 'Данные года')}>
              <p>
                {copy(
                  locale,
                  `${monthName(busy.peakMonth)} accounts for ${busy.months[busy.peakMonth - 1].flights} of ${busy.flights} flights in ${busy.year}.`,
                  `${monthName(busy.peakMonth)}: ${busy.months[busy.peakMonth - 1].flights} из ${busy.flights} перелётов за ${busy.year} год.`,
                )}
              </p>
              {filtered && all && (
                <p>
                  {copy(
                    locale,
                    `Whole journal: ${flights(locale, all.figures.flights)}. Busiest year: ${lifetime?.busiestYear ? `${lifetime.busiestYear.year} · ${flights(locale, lifetime.busiestYear.flights)}` : '—'}.`,
                    `Весь журнал: ${flights(locale, all.figures.flights)}. Самый активный год: ${lifetime?.busiestYear ? `${lifetime.busiestYear.year} · ${flights(locale, lifetime.busiestYear.flights)}` : '—'}.`,
                  )}
                </p>
              )}
              <TableView
                table={{
                  caption: copy(locale, 'Monthly flights', 'Перелёты по месяцам'),
                  columns: [
                    { key: 'month', label: copy(locale, 'Month', 'Месяц') },
                    { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
                  ],
                  rows: busy.months.map((month) => ({
                    month: monthName(month.month),
                    flights: month.flights,
                  })),
                }}
              />
              <Button
                dense
                variant="secondary"
                onClick={() => {
                  if (isCurrent()) actions.setPeriod({ years: [busy.year] })
                }}
              >
                {copy(locale, 'Filter Overview', 'Фильтровать обзор')}
              </Button>
            </Disclosure>
          )}
        </div>
      </div>
      {!lead && (data.longestDuration || data.shortestDuration) && (
        <Disclosure summary={copy(locale, 'Duration evidence', 'Данные длительности')}>
          {[
            {
              label: copy(locale, 'Longest time in the air', 'Самый долгий перелёт'),
              record: data.longestDuration,
            },
            {
              label: copy(locale, 'Shortest time in the air', 'Самый быстрый перелёт'),
              record: data.shortestDuration,
            },
          ].map(
            ({ label, record }) =>
              record && (
                <div className="ov3-record-inset" key={label}>
                  <p>{label}</p>
                  <strong>{formatDuration(locale, record.value)}</strong>
                  <p className="ov3-record-route">{arrow(record)}</p>
                  <p>{places(record)}</p>
                  <div className="ov3-record-actions">
                    {affordance(record)}
                    <Button dense variant="secondary" onClick={() => filterRecord(record)}>
                      {copy(locale, 'Filter Overview', 'Фильтровать обзор')}
                    </Button>
                  </div>
                </div>
              ),
          )}
        </Disclosure>
      )}
      <TableView
        table={{
          caption: copy(locale, 'Records', 'Рекорды'),
          columns: [
            { key: 'record', label: copy(locale, 'Record', 'Рекорд') },
            { key: 'route', label: copy(locale, 'Route', 'Маршрут') },
            { key: 'value', label: copy(locale, 'Value', 'Значение') },
          ],
          rows,
        }}
      />
    </div>
  )
  const witnesses = lead ? (
    <div className="ov3-records" data-span={span}>
      <div className="ov3-record-inset ov3-record-lead">
        <p>{copy(locale, 'Longest flight', 'Самый длинный перелёт')}</p>
        <p className="ov3-record-route">{route(lead)}</p>
        <div className="ov3-record-actions">
          {affordance(lead)}
          <Button dense variant="secondary" onClick={() => filterRecord(lead)}>
            {copy(locale, 'Filter Overview', 'Фильтровать обзор')}
          </Button>
        </div>
        {filtered && baseline}
        <p>
          {[
            payload.refs.airports[lead.origin]?.city ?? lead.origin,
            payload.refs.airports[lead.destination]?.city ?? lead.destination,
          ].join(' → ')}
        </p>
        <strong>
          {number(locale, lead.value)} <small>{copy(locale, 'km', 'км')}</small>
        </strong>
        <p>
          {[
            leadFlight,
            lead.date && dateInstant(lead.date) !== null
              ? formatDateOnly(locale, lead.date, 'medium')
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="ov3-record-stats">
          <span>
            {copy(locale, 'In the air', 'В воздухе')}
            <strong>
              {lead.durationMinutes === null
                ? '—'
                : `${lead.durationApproximate ? '≈ ' : ''}${formatDuration(locale, lead.durationMinutes)}`}
            </strong>
          </span>
          {lead.speedKmh !== null && (
            <span>
              {copy(locale, 'Straight-line speed', 'Скорость по прямой')}
              <strong>
                {number(locale, Math.round(lead.speedKmh))} {copy(locale, 'km/h', 'км/ч')}
              </strong>
            </span>
          )}
          <span>
            {copy(locale, 'Clock shift', 'Сдвиг часов')}
            <strong>
              {lead.clockShiftMinutes === null
                ? '—'
                : `${lead.clockShiftMinutes > 0 ? '+' : ''}${number(locale, lead.clockShiftMinutes / 60)} ${copy(locale, 'h', 'ч')}`}
            </strong>
          </span>
        </div>
        <div className="ov3-record-track">
          <i style={{ width: percent(Math.min(1, lead.equatorShare)) }} />
          {lead.previousBestKm !== null && (
            <b style={{ left: percent(lead.previousBestKm / 40075) }} />
          )}
        </div>
        <p>
          {percent(lead.equatorShare)}{' '}
          {copy(locale, 'of the way round the equator', 'длины экватора')}
        </p>
      </div>
    </div>
  ) : null

  return (
    <ChapterCard
      state="ready"
      figure={
        <RecordMapFigure legs={legs} reading={r.reading} picked={r.picked && !reducedMotion()} />
      }
      figureButton={
        routes.length > 1
          ? {
              label: copy(locale, 'Show next longest route', 'Показать следующий по длине маршрут'),
              onPress: r.next,
            }
          : undefined
      }
      hero={{
        value: reading ? kmText(reading) : '—',
        unit: reading ? copy(locale, 'km', 'км') : undefined,
        caption,
        only:
          !reading ||
          r.isHeadline ||
          filter.routes?.includes(routeKey(reading.origin, reading.destination))
            ? null
            : {
                label: copy(locale, `Only ${arrow(reading)}`, `Только ${arrow(reading)}`),
                onPress: () => filterRoute(reading),
              },
      }}
      rollValue={r.picked}
      chart={{
        table: routes.length
          ? {
              caption: chartCaption,
              columns: [
                { key: 'route', label: copy(locale, 'Route', 'Маршрут') },
                {
                  key: 'km',
                  label: copy(locale, 'Distance, km', 'Расстояние, км'),
                  numeric: true,
                },
                { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
              ],
              rows: routes.map((row) => ({
                route: arrow(row),
                km: kmText(row),
                flights: row.flights,
              })),
            }
          : undefined,
        caption: reading ? chartCaption : '',
        plot:
          routes.length > 1 ? (
            <LazyChart height={points.length * 24} label={chartCaption}>
              {(inView) => (
                <StageRows
                  points={points}
                  value={(point) => point.datum.km}
                  format={(point) => kmText(point.datum)}
                  name={(point) => arrow(point.datum)}
                  mono
                  span={span}
                  selectedKey={r.reading}
                  appliedKeys={appliedKeys}
                  inView={inView}
                  ariaLabel={chartCaption}
                  onPick={(point) => r.pick(point.key)}
                  actions={(point) => [
                    {
                      label: copy(locale, 'Filter Overview', 'Фильтровать обзор'),
                      run: () => filterRoute(point.datum),
                    },
                  ]}
                  tip={(selected) => <span>{selected[0].label}</span>}
                />
              )}
            </LazyChart>
          ) : null,
      }}
      details={{
        heading: copy(locale, 'Record cabinet', 'Витрина рекордов'),
        more: witnesses
          ? [
              {
                summary: copy(locale, 'Flight details', 'Данные перелёта'),
                content: witnesses,
              },
            ]
          : undefined,
        extra: cabinet,
      }}
    />
  )
}
