'use client'

import { useMemo } from 'react'
import type { RecordRef } from '@kuuki/shared/overview/model'
import { routeKey } from '@kuuki/shared/overview/filter'
import { dateInstant } from '@kuuki/shared/overview/records'
import { formatDateOnly, formatDuration } from '../../../../lib/format'
import { TableView } from '../../charts/table-view'
import { useOverview } from '../../store/overview-context'
import { useOpenFlight } from '../../store/open-flight'
import type { Span } from '../registry'
import { copy, flights, number, percent } from '../rankings/display'
import { IsoFigure } from '../../iso/iso-figure'
import { foldedMap, mapPin } from '../../iso/map'
import { hhmm } from '../clock/departure'
import './records.css'
import '../../iso/map.css'

/** Derived degrees read as a fact at one decimal; more digits only look like noise. */
const tenth = (value: number) => Math.round(value * 10) / 10

export function Section({ span }: { span: Span }) {
  const { scope, payload, locale, aggregate, ownerKey, actions, bus, isCurrent } = useOverview()
  const openFlight = useOpenFlight()
  const longest = scope?.records.status === 'ready' ? scope.records.value.longest : null
  const origin = longest ? payload?.refs.airports[longest.origin] : undefined
  const destination = longest ? payload?.refs.airports[longest.destination] : undefined
  const equator =
    origin?.lat != null && destination?.lat != null && origin.lat * destination.lat < 0
  const mapFigure = useMemo(
    () =>
      longest
        ? foldedMap(
            mapPin(longest.origin, origin),
            mapPin(longest.destination, destination),
            0.95,
            equator,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `longest` and the refs are rebuilt every render; the route and its coordinates are the key.
    [
      longest?.origin,
      longest?.destination,
      origin?.lat,
      origin?.lon,
      destination?.lat,
      destination?.lon,
      equator,
    ],
  )
  if (!scope || !payload) return null
  const gate = scope.records
  if (gate.status !== 'ready') return null
  const data = gate.value,
    lead = data.longest,
    short = data.shortest,
    north = data.northernmost,
    early = data.earliestDeparture,
    busy = data.busiestYear
  const route = (record: Pick<RecordRef, 'origin' | 'destination'> | null) =>
    record ? `${record.origin} → ${record.destination}` : '—'
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
        aria-label={`${copy(locale, 'Open flight', 'Открыть перелёт')} · ${route(record)}`}
        onClick={() => open(record)}
      >
        ↗
      </button>
    ) : null
  const filter = (record: Pick<RecordRef, 'origin' | 'destination'> | null) => {
    if (record && isCurrent()) actions.add('routes', routeKey(record.origin, record.destination))
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
  return (
    <div className="ov3-records" data-span={span}>
      <div className="ov3-record-cabinet">
        <div className="ov3-record-lead ov3-record-inset">
          <p>{copy(locale, 'Longest flight', 'Самый длинный перелёт')}</p>
          {affordance(lead)}
          <button className="ov3-record-route" onClick={() => filter(lead)}>
            {route(lead)}
          </button>
          <p>
            {lead
              ? [
                  payload.refs.airports[lead.origin]?.city ?? lead.origin,
                  payload.refs.airports[lead.destination]?.city ?? lead.destination,
                ].join(' → ')
              : '—'}
          </p>
          <strong className="ov3-record-value">
            {lead ? number(locale, lead.value) : '—'} <small>{copy(locale, 'km', 'км')}</small>
          </strong>
          <p>
            {[
              leadFlight,
              lead?.date && dateInstant(lead.date) !== null
                ? formatDateOnly(locale, lead.date, 'medium')
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {lead && (
            <>
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
                    {copy(locale, 'Average ground speed', 'Средняя путевая скорость')}
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
              {mapFigure && (
                <div className="ov3-record-map">
                  <IsoFigure figure={mapFigure} className="iso-map" />
                </div>
              )}
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
            </>
          )}
        </div>
        <div className="ov3-record-small-grid">
          <div className="ov3-record-inset">
            <p>{copy(locale, 'Shortest flight', 'Самый короткий перелёт')}</p>
            {affordance(short)}
            <strong>
              {short ? `${number(locale, short.value)} ${copy(locale, 'km', 'км')}` : '—'}
            </strong>
            <button className="ov3-record-route" onClick={() => filter(short)}>
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
                <button className="ov3-record-route" onClick={() => filter(early)}>
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
                    background:
                      month.month === busy.peakMonth ? 'var(--mark-1)' : 'var(--mark-rest)',
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
}
