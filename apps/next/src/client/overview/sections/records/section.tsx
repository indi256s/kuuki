'use client'

import type { ReactNode } from 'react'
import type { RecordRef } from '@kuuki/shared/overview/model'
import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { routeKey } from '@kuuki/shared/overview/filter'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { dateInstant } from '@kuuki/shared/overview/records'
import { formatDateOnly, formatDuration } from '../../../../lib/format'
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
import { copy, filterLabel, flights, number, percent } from '../rankings/display'
import { hhmm } from '../clock/departure'
import { RecordMapFigure, type Leg } from './figure'
import './records.css'

/** Derived degrees read as a fact at one decimal; more digits only look like noise. */
const tenth = (value: number) => Math.round(value * 10) / 10

type Route = { origin: string; destination: string; km: number; flights: number }
const keyOf = (route: Pick<Route, 'origin' | 'destination'>) =>
  `${route.origin}-${route.destination}`
const arrow = (route: Pick<Route, 'origin' | 'destination'>) =>
  `${route.origin} → ${route.destination}`

export function Section({ span }: { span: Span }) {
  const { scope, payload, filter, locale, aggregate, ownerKey, actions, bus, isCurrent } =
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

  const state = !scope || !payload ? 'loading' : data && reading ? 'ready' : 'empty'
  const gated = scope ? SECTION_GATES.records.gate(scope) : null
  if (state !== 'ready' || !data || !reading || !payload) {
    return (
      <ChapterCard
        state={state === 'loading' ? 'loading' : 'empty'}
        figure={<RecordMapFigure legs={legs} reading={null} picked={false} />}
        hero={{ value: '', caption: null }}
        chart={{ caption: '', plot: null }}
        empty={{
          title: copy(locale, 'No records to show', 'Рекордов не видно'),
          line:
            gated?.status === 'below'
              ? copy(
                  locale,
                  `Records start at ${flights(locale, gated.need)}, and this filter leaves ${flights(locale, gated.have)}. The cabinet stays locked.`,
                  `Порог для рекордов — ${flights(locale, gated.need)}, а фильтр оставил ${flights(locale, gated.have)}. Витрина закрыта.`,
                )
              : copy(
                  locale,
                  'No flight in this filter has a known distance. Hard to set a record without a ruler.',
                  'Ни у одного перелёта в выборке нет известного расстояния. Без линейки рекорд не ставится.',
                ),
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
    north = data.northernmost,
    early = data.earliestDeparture,
    busy = data.busiestYear
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
      <button
        className="ov3-record-open"
        aria-label={`${copy(locale, 'Open flight', 'Открыть перелёт')} · ${arrow(record)}`}
        onClick={() => open(record)}
      >
        ↗
      </button>
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
      record: copy(locale, 'Furthest north', 'Самая северная точка'),
      route: north?.iata ?? '—',
      value: north ? `${number(locale, tenth(north.lat))}°` : '—',
    },
    {
      record: copy(locale, 'Earliest departure', 'Самый ранний вылет'),
      route: route(early),
      value: early ? hhmm(early.depMinute) : '—',
    },
    {
      record: copy(locale, 'Busiest year', 'Самый активный год'),
      route: busy ? String(busy.year) : '—',
      value: busy ? flights(locale, busy.flights) : '—',
    },
  ]

  const rank = keys.indexOf(keyOf(reading))
  const ordinal = (n: number) =>
    locale === 'ru' ? `${n}-й` : (['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`)
  const caption: ReactNode = r.isHeadline
    ? copy(
        locale,
        `Longest flight · ${arrow(reading)}. ${percent(reading.km / EARTH_CIRCUMFERENCE_KM)} of the way round the equator, in one sitting.`,
        `Самый длинный перелёт · ${arrow(reading)}. ${percent(reading.km / EARTH_CIRCUMFERENCE_KM)} длины экватора за один присест.`,
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
          {affordance(short)}
          <strong>
            {short ? `${number(locale, short.value)} ${copy(locale, 'km', 'км')}` : '—'}
          </strong>
          <button className="ov3-record-route" onClick={() => filterRecord(short)}>
            {route(short)}
          </button>
          <div className="ov3-record-track">
            <b style={{ left: percent(short?.shareOfLongest ?? 0) }} />
          </div>
          <p>
            {short && short.shareOfLongest > 0
              ? `1/${Math.round(1 / short.shareOfLongest)} ${copy(locale, 'of your longest', 'самого длинного')}`
              : '—'}
          </p>
        </div>
        <div className="ov3-record-inset">
          <p>{copy(locale, 'Furthest north', 'Самая северная точка')}</p>
          {affordance(north?.flight ?? null)}
          <strong>
            {north ? `${number(locale, tenth(north.lat))}° ${copy(locale, 'N', 'с. ш.')}` : '—'}
          </strong>
          <button
            className="ov3-record-route"
            onClick={() => {
              if (north && isCurrent()) actions.add('airports', north.iata)
            }}
          >
            {north?.iata ?? '—'}
          </button>
          <div className="ov3-record-track ov3-record-arctic">
            <b style={{ left: percent(Math.max(0, Math.min(1, (north?.lat ?? 0) / 90))) }} />
          </div>
          <p>
            {north && north.lat >= 66.56
              ? `${number(locale, tenth(north.lat - 66.56))}° ${copy(locale, 'inside the Arctic Circle', 'за полярным кругом')}`
              : copy(locale, 'Arctic Circle at 66.56°', 'Полярный круг: 66,56°')}
          </p>
        </div>
        <div className="ov3-record-inset">
          <p>{copy(locale, 'Earliest departure', 'Самый ранний вылет')}</p>
          {early ? (
            <>
              {affordance(early)}
              <strong>{hhmm(early.depMinute)}</strong>
              <button className="ov3-record-route" onClick={() => filterRecord(early)}>
                {route(early)}
              </button>
              <div className="ov3-record-track ov3-record-night">
                <b style={{ left: percent(early.depMinute / 1440) }} />
              </div>
              <p>00:00–24:00</p>
            </>
          ) : (
            <>
              <p>{copy(locale, 'No departure times recorded', 'Время вылета не указано')}</p>
              <a className="ov3-record-link" href="/journal">
                {copy(locale, 'Add times →', 'Указать время →')}
              </a>
            </>
          )}
        </div>
        <div className="ov3-record-inset">
          <p>{copy(locale, 'Busiest year', 'Самый активный год')}</p>
          <strong>{busy?.year ?? '—'}</strong>
          <button
            className="ov3-record-route"
            onClick={() => {
              if (busy && isCurrent()) actions.setPeriod({ years: [busy.year] })
            }}
          >
            {busy ? flights(locale, busy.flights) : '—'}
          </button>
          <div className="ov3-record-months" aria-hidden="true">
            {busy?.months.map((month) => (
              <i
                key={month.key}
                style={{
                  height: `${Math.max(2, (month.flights / Math.max(1, ...busy.months.map((row) => row.flights))) * 48)}px`,
                  background: month.month === busy.peakMonth ? 'var(--mark-1)' : 'var(--mark-rest)',
                }}
              />
            ))}
          </div>
          <p>
            {busy
              ? `${copy(locale, 'Peak', 'Пик')}: ${monthName(busy.peakMonth)}, ${flights(locale, busy.months[busy.peakMonth - 1].flights)}`
              : '—'}
          </p>
        </div>
      </div>
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
        {affordance(lead)}
        <button className="ov3-record-route" onClick={() => filterRecord(lead)}>
          {route(lead)}
        </button>
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
      figureButton={{
        label: copy(locale, 'Show next longest route', 'Показать следующий по длине маршрут'),
        onPress: r.next,
      }}
      hero={{
        value: kmText(reading),
        unit: copy(locale, 'km', 'км'),
        caption,
        only:
          r.isHeadline || filter.routes?.includes(routeKey(reading.origin, reading.destination))
            ? null
            : {
                label: copy(locale, `Only ${arrow(reading)}`, `Только ${arrow(reading)}`),
                onPress: () => filterRoute(reading),
              },
      }}
      rollValue={r.picked}
      chart={{
        table: {
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
        },
        caption: chartCaption,
        plot: (
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
                  { label: filterLabel(locale), run: () => filterRoute(point.datum) },
                ]}
                tip={(selected) => <span>{selected[0].label}</span>}
              />
            )}
          </LazyChart>
        ),
      }}
      details={{
        heading: copy(locale, 'Record cabinet', 'Витрина рекордов'),
        more: witnesses
          ? [
              {
                summary: copy(locale, 'Witnesses and provenance', 'Свидетели и происхождение'),
                content: witnesses,
              },
            ]
          : undefined,
        extra: cabinet,
      }}
    />
  )
}
