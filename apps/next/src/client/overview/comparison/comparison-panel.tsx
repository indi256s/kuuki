'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { OverviewFilter, OverviewRow } from '@kuuki/shared/overview/model'
import { formatCount, formatDateOnly, formatDistanceKm, formatNumber, type CountForms, type Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { facetName, facetValueLabel, type FilterFacet } from '../filters/chip-label'
import { forms } from '../copy'
import { referenceLabels, type OverviewLabels } from '../labels'
import { scopeTitle } from '../page/scope-title'
import { useOpenFlight } from '../store/open-flight'
import { useOverview } from '../store/overview-context'
import { compareChapters, type ChapterComparison } from './compare-chapters'
import './comparison.css'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })
const C = {
  title: p('Compare chapters', 'Сравнение глав'),
  intro: p('Keep one selection, then explore another. The reference lasts until you clear it or leave this page.',
    'Оставьте одну выборку и изучите другую. Опорный срез останется, пока вы не сбросите его или не уйдёте со страницы.'),
  latest: p('Both selections use your latest journal. Adding or editing flights can change the reference figures.',
    'Обе выборки используют актуальный журнал. При добавлении или правке перелётов цифры опорного среза могут измениться.'),
  reference: p('Reference', 'Опорный срез'),
  current: p('Current', 'Текущий срез'),
  keep: p('Keep for comparison', 'Оставить для сравнения'),
  replace: p('Replace reference', 'Заменить опорный срез'),
  clear: p('Clear comparison', 'Сбросить сравнение'),
  kept: p('Reference kept', 'Опорный срез оставлен'),
  replaced: p('Reference replaced', 'Опорный срез заменён'),
  cleared: p('Comparison cleared', 'Сравнение сброшено'),
  view: p('View comparison', 'Показать сравнение'),
  nothingToKeep: p('This selection has no flights to keep.', 'В этой выборке нет перелётов, оставлять нечего.'),
  unavailable: p('Figures for this selection are not available yet.', 'Данные для этой выборки пока недоступны.'),
  allTime: p('All time', 'Всё время'),
  same: p('Choose another period or filter to see what changed.', 'Выберите другой период или фильтр, чтобы увидеть, что изменилось.'),
  referenceEmpty: p('The reference has no flights in your latest journal.', 'В опорном срезе по актуальному журналу нет перелётов.'),
  currentEmpty: p('No flights match the current selection, so every reference route is listed as only in the reference.',
    'Текущей выборке не соответствует ни один перелёт, поэтому все маршруты опорного среза указаны как встречающиеся только в нём.'),
  measure: p('Measure', 'Показатель'),
  change: p('Change', 'Изменение'),
  flights: p('Flights', 'Перелёты'),
  distancePer: p('Distance per flight', 'Расстояние на перелёт'),
  noDistance: p('No recorded distance', 'Расстояние не указано'),
  airports: p('Airports', 'Аэропорты'),
  airlineShare: p('Airline share of flights', 'Доля авиакомпаний в перелётах'),
  airlineNote: p('Largest share changes, in percentage points. Unrecorded airlines are included.', 'Наибольшие изменения долей в процентных пунктах. Перелёты без авиакомпании тоже учитываются.'),
  airline: p('Airline', 'Авиакомпания'),
  unknownAirline: p('Airline not recorded', 'Авиакомпания не указана'),
  pp: p('pp', 'п. п.'),
  touches: p('Airport visits', 'Посещения аэропортов'),
  touchNote: p('Each departure and arrival counts as one visit. Largest changes shown first.', 'Каждый вылет и прилёт считается одним посещением. Сначала показаны наибольшие изменения.'),
  routes: p('Routes', 'Маршруты'),
  added: p('New in current', 'Новые в текущем'),
  shared: p('In both', 'В обоих'),
  absent: p('Only in reference', 'Только в опорном'),
  none: p('None', 'Нет'),
  showAll: p('Show all {count}', 'Показать все {count}'),
  showFewer: p('Show fewer', 'Свернуть'),
  showFlights: p('Show flights', 'Показать перелёты'),
  hideFlights: p('Hide flights', 'Скрыть перелёты'),
  openFlight: p('Open flight', 'Открыть перелёт'),
  aggregate: p('Your journal is shown in summary form, so individual flights cannot be opened here.',
    'Журнал показан в сводном виде, поэтому отдельные перелёты здесь открыть нельзя.'),
  mapStatic: p('Both selections on one map. Replay pauses during comparison.',
    'Обе выборки на одной карте. Во время сравнения повтор приостановлен.'),
  legend: p('Route lines', 'Линии маршрутов'),
  unknownCell: p('—', '—'),
} as const
const text = (pair: Pair, locale: Locale) => pair[locale]

const distanceKnown: CountForms = {
  en: { one: 'Distance known for {known} of {count} flight', other: 'Distance known for {known} of {count} flights' },
  ru: { one: 'Расстояние известно для {known} из {count} перелёта', few: 'Расстояние известно для {known} из {count} перелётов',
    many: 'Расстояние известно для {known} из {count} перелётов', other: 'Расстояние известно для {known} из {count} перелётов' },
}
const GROUP_LIMIT = 5, FLIGHT_LIMIT = 6, AIRLINE_LIMIT = 5, AIRPORT_LIMIT = 4

type Status = ChapterComparison['routes'][number]['status']
const STATUS_COPY: Record<Status, Pair> = { added: C.added, shared: C.shared, absent: C.absent }
/** One line per status, drawn the same way on the map: solid, dash-dot, dashed. The pattern carries the meaning; colour only supports it. */
const LINE: Record<Status, { dash: string | undefined; color: string }> = {
  added: { dash: undefined, color: 'var(--mark-1)' },
  shared: { dash: '8 2 1 2', color: 'var(--mark-4)' },
  absent: { dash: '3 3', color: 'var(--info-fill)' },
}
export function RouteSwatch({ status }: { status: Status }) {
  return <svg className="cmp-swatch" width="28" height="8" viewBox="0 0 28 8" aria-hidden="true" focusable="false">
    <line x1="0" y1="4" x2="28" y2="4" strokeWidth="3" strokeDasharray={LINE[status].dash} style={{ stroke: LINE[status].color }} />
  </svg>
}

/** Comparison of the kept filter with the live one; null while nothing is kept or the journal has not loaded. */
export function useChapterComparison(): ChapterComparison | null {
  const { chapter, payload, filter } = useOverview()
  const held = chapter?.filter
  return useMemo(() => held && payload ? compareChapters(payload, held, filter) : null, [held, payload, filter])
}

const normal = (value: unknown): unknown => Array.isArray(value) ? value.map(normal).sort()
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0).map(([key, item]) => [key, normal(item)]))
    : value
const sameScope = (a: OverviewFilter, b: OverviewFilter) => JSON.stringify(normal(a)) === JSON.stringify(normal(b))

/** Every facet and value, in full: scopeTitle abbreviates after two values, which would hide filters here. */
function describeScope(filter: OverviewFilter, labels: OverviewLabels, locale: Locale): string {
  const parts: string[] = []
  for (const key of Object.keys(filter) as Array<keyof OverviewFilter>) {
    const selected = filter[key]
    if (!selected) continue
    if (key === 'period') {
      const period = scopeTitle({ period: filter.period }, labels, locale).slice(3)
      if (period) parts.push(period)
    } else if (Array.isArray(selected) && selected.length) {
      parts.push(`${facetName(key as FilterFacet, locale)}: ${selected.map(value => facetValueLabel(key as FilterFacet, value, labels, locale)).join(', ')}`)
    }
  }
  return parts.length ? parts.join(' · ') : text(C.allTime, locale)
}

const signed = (locale: Locale, value: number, digits = 0) =>
  new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: digits }).format(value)
const percent = (locale: Locale, share: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share)
const span = (locale: Locale, first: string | null, last: string | null) => first && last
  ? first === last ? formatDateOnly(locale, first) : `${formatDateOnly(locale, first)} – ${formatDateOnly(locale, last)}` : null

export function ComparisonControl() {
  const { chapter, scope, filter, locale, keepChapter, clearChapter } = useOverview()
  const [notice, setNotice] = useState('')
  const keepButton = useRef<HTMLButtonElement>(null)
  const flights = scope?.figures.flights ?? 0
  const reason = flights > 0 ? undefined : text(scope ? C.nothingToKeep : C.unavailable, locale)
  return <div className="cmp-control">
    <Button ref={keepButton} disabledReason={reason} onClick={() => {
      keepChapter()
      setNotice(`${text(chapter ? C.replaced : C.kept, locale)}: ${describeScope(filter, referenceLabels(locale), locale)}`)
    }}>{text(chapter ? C.replace : C.keep, locale)}</Button>
    {chapter && <>
      <Button variant="ghost" onClick={() => { clearChapter(); setNotice(text(C.cleared, locale)); keepButton.current?.focus() }}>{text(C.clear, locale)}</Button>
      <Button variant="ghost" className="cmp-jump" onClick={() => {
        const panel = document.getElementById('chapter-comparison')
        panel?.focus({ preventScroll: true }); panel?.scrollIntoView({ block: 'start', behavior: 'instant' })
      }}>{text(C.view, locale)}</Button>
    </>}
    <p role="status" className="cmp-notice">{notice}</p>
  </div>
}

/** Legend for the map: it replaces replay controls while a reference is kept. */
export function ComparisonGlobeLegend({ locale }: { locale: Locale }) {
  return <div className="cmp-legend">
    <p>{text(C.mapStatic, locale)}</p>
    <ul aria-label={text(C.legend, locale)}>
      {(['added', 'shared', 'absent'] as const).map(status => <li key={status}><RouteSwatch status={status} />{text(STATUS_COPY[status], locale)}</li>)}
    </ul>
  </div>
}

function FlightList({ ids, rows, locale }: { ids: number[]; rows: ReadonlyMap<number, OverviewRow>; locale: Locale }) {
  const open = useOpenFlight()
  const [all, setAll] = useState(false)
  const present = ids.filter(id => rows.has(id))
  const shown = all ? present : present.slice(0, FLIGHT_LIMIT)
  return <div className="cmp-flights">
    <ul>{shown.map(id => {
      const row = rows.get(id)!
      const label = [formatDateOnly(locale, row.date, 'short'), row.flightNumber].filter(Boolean).join(' · ')
      return <li key={id}><Button dense variant="ghost" static aria-label={`${text(C.openFlight, locale)}: ${label}`} onClick={() => open(id)}>{label}</Button></li>
    })}</ul>
    {present.length > FLIGHT_LIMIT && <Button dense variant="ghost" aria-expanded={all} onClick={() => setAll(!all)}>
      {all ? text(C.showFewer, locale) : text(C.showAll, locale).replace('{count}', formatNumber(locale, present.length))}</Button>}
  </div>
}

function RouteGroup({ status, routes, rows, aggregate, locale }: {
  status: Status; routes: ChapterComparison['routes']; rows: ReadonlyMap<number, OverviewRow>; aggregate: boolean; locale: Locale
}) {
  const { bus } = useOverview()
  const [all, setAll] = useState(false), [flightsOf, setFlightsOf] = useState<string | null>(null)
  const shown = all ? routes : routes.slice(0, GROUP_LIMIT)
  const headingId = useId()
  const count = (route: ChapterComparison['routes'][number]) => status === 'added' ? formatCount(locale, route.currentCount, forms.flights)
    : status === 'absent' ? formatCount(locale, route.heldCount, forms.flights)
      : `${text(C.reference, locale)} ${formatNumber(locale, route.heldCount)} · ${text(C.current, locale)} ${formatNumber(locale, route.currentCount)}`
  return <section className="cmp-group" aria-labelledby={headingId}>
    <h4 id={headingId}><RouteSwatch status={status} />{text(STATUS_COPY[status], locale)} <span>{formatNumber(locale, routes.length)}</span></h4>
    {routes.length === 0 ? <p className="cmp-muted">{text(C.none, locale)}</p> : <ul>
      {shown.map(route => {
        // Only a route that differs has supporting flights worth opening: the side that holds the difference.
        const ids = status === 'added' ? route.flightIds.current : status === 'absent' ? route.flightIds.held : []
        const expanded = flightsOf === route.key
        return <li key={route.key}>
          <div className="cmp-route-row">
            <button type="button" className="cmp-route" onPointerEnter={() => bus.setHoverRoute(route.key)} onPointerLeave={() => bus.setHoverRoute(null)}
              onFocus={() => bus.setFocusRoute(route.key)} onBlur={() => bus.setFocusRoute(null)} onClick={() => bus.setFocusRoute(route.key)}>
              <span className="cmp-code">{route.a}–{route.b}</span><span className="cmp-muted">{count(route)}</span>
            </button>
            {ids.length > 0 && <Button dense variant="ghost" static aria-expanded={expanded} onClick={() => setFlightsOf(expanded ? null : route.key)}>
              {text(expanded ? C.hideFlights : C.showFlights, locale)}</Button>}
          </div>
          {expanded && <FlightList ids={ids} rows={rows} locale={locale} />}
        </li>
      })}
    </ul>}
    {routes.length > GROUP_LIMIT && <Button dense variant="ghost" aria-expanded={all} onClick={() => setAll(!all)}>
      {all ? text(C.showFewer, locale) : text(C.showAll, locale).replace('{count}', formatNumber(locale, routes.length))}</Button>}
    {aggregate && status !== 'shared' && routes.length > 0 && <p className="cmp-muted">{text(C.aggregate, locale)}</p>}
  </section>
}

export function ComparisonPanel() {
  const { chapter, filter, payload, locale, aggregate, bus } = useOverview()
  const labels = useMemo(() => referenceLabels(locale), [locale])
  const comparison = useChapterComparison()
  const rows = useMemo(() => new Map((payload?.rows ?? []).map(row => [row.id, row])), [payload])
  const titleId = useId()
  // Clear linked map focus when the panel unmounts.
  useEffect(() => () => { bus.setHoverRoute(null); bus.setFocusRoute(null) }, [bus])
  if (!chapter || !comparison) return null
  const { held, current } = comparison
  const side = [
    { name: C.reference, filter: chapter.filter, summary: held },
    { name: C.current, filter, summary: current },
  ]
  const same = held.flights > 0 && sameScope(chapter.filter, filter)
  const dash = text(C.unknownCell, locale)
  const kmCell = (summary: typeof held) => summary.averageDistanceKm === null ? text(C.noDistance, locale)
    : formatDistanceKm(locale, Math.round(summary.averageDistanceKm))
  const knownCell = (summary: typeof held) => summary.flights > 0 && summary.averageDistanceKm !== null
    ? formatCount(locale, summary.flights, distanceKnown).replace('{known}', formatNumber(locale, summary.knownDistanceFlights)) : null
  const airportCount = (key: 'heldCount' | 'currentCount') => comparison.airports.filter(airport => airport[key] > 0).length
  const airlines = comparison.airlines.slice(0, AIRLINE_LIMIT)
  const unknownAirline = comparison.airlines.find(airline => airline.code === 'unknown')
  if (unknownAirline && !airlines.includes(unknownAirline)) airlines.push(unknownAirline)
  const bothSides = held.flights > 0 && current.flights > 0
  const group = (status: Status) => comparison.routes.filter(route => route.status === status)
  return <section id="chapter-comparison" className="cmp-panel" aria-labelledby={titleId} tabIndex={0}>
    <h2 id={titleId}>{text(C.title, locale)}</h2>
    <p className="cmp-muted">{text(C.intro, locale)}</p>
    <dl className="cmp-scopes">
      {side.map(item => <div key={item.name.en}>
        <dt>{text(item.name, locale)}</dt>
        <dd>{describeScope(item.filter, labels, locale)}
          {(payload?.mode !== 'aggregate' || payload.aggregateResolution === 'day') && span(locale, item.summary.firstDate, item.summary.lastDate) &&
            <span className="cmp-muted">{span(locale, item.summary.firstDate, item.summary.lastDate)}</span>}</dd>
      </div>)}
    </dl>
    {same ? <p className="cmp-instruction">{text(C.same, locale)}</p> : <>
      {held.flights === 0 && <p role="status" className="cmp-note">{text(C.referenceEmpty, locale)}</p>}
      {current.flights === 0 && held.flights > 0 && <p role="status" className="cmp-note">{text(C.currentEmpty, locale)}</p>}
      <table className="cmp-table">
        <thead><tr><th scope="col">{text(C.measure, locale)}</th><th scope="col">{text(C.reference, locale)}</th><th scope="col">{text(C.current, locale)}</th><th scope="col">{text(C.change, locale)}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{text(C.flights, locale)}</th><td>{formatNumber(locale, held.flights)}</td><td>{formatNumber(locale, current.flights)}</td>
            <td>{signed(locale, current.flights - held.flights)}</td></tr>
          <tr><th scope="row">{text(C.distancePer, locale)}</th>
            <td>{kmCell(held)}{knownCell(held) && <small>{knownCell(held)}</small>}</td>
            <td>{kmCell(current)}{knownCell(current) && <small>{knownCell(current)}</small>}</td>
            <td>{held.averageDistanceKm !== null && current.averageDistanceKm !== null
              ? `${signed(locale, Math.round(current.averageDistanceKm) - Math.round(held.averageDistanceKm))} ${locale === 'ru' ? 'км' : 'km'}` : dash}</td></tr>
          <tr><th scope="row">{text(C.airports, locale)}</th><td>{formatNumber(locale, airportCount('heldCount'))}</td><td>{formatNumber(locale, airportCount('currentCount'))}</td>
            <td>{signed(locale, airportCount('currentCount') - airportCount('heldCount'))}</td></tr>
        </tbody>
      </table>
      {bothSides && airlines.length > 0 && <>
        <h3>{text(C.airlineShare, locale)}</h3>
        <p className="cmp-muted">{text(C.airlineNote, locale)}</p>
        <table className="cmp-table">
          <thead><tr><th scope="col">{text(C.airline, locale)}</th><th scope="col">{text(C.reference, locale)}</th><th scope="col">{text(C.current, locale)}</th><th scope="col">{text(C.change, locale)}</th></tr></thead>
          <tbody>{airlines.map(airline => <tr key={airline.code}>
            <th scope="row">{airline.code === 'unknown' ? text(C.unknownAirline, locale) : labels.airline(airline.code)}</th>
            <td>{percent(locale, airline.heldShare)}</td><td>{percent(locale, airline.currentShare)}</td>
            <td>{signed(locale, (airline.currentShare - airline.heldShare) * 100, 1)} {text(C.pp, locale)}</td>
          </tr>)}</tbody>
        </table>
      </>}
      {comparison.airports.length > 0 && <>
        <h3>{text(C.touches, locale)}</h3>
        <p className="cmp-muted">{text(C.touchNote, locale)}</p>
        <table className="cmp-table">
          <thead><tr><th scope="col">{text(C.airports, locale)}</th><th scope="col">{text(C.reference, locale)}</th><th scope="col">{text(C.current, locale)}</th><th scope="col">{text(C.change, locale)}</th></tr></thead>
          <tbody>{comparison.airports.slice(0, AIRPORT_LIMIT).map(airport => <tr key={airport.iata}>
            <th scope="row" className="cmp-code">{airport.iata}</th><td>{formatNumber(locale, airport.heldCount)}</td><td>{formatNumber(locale, airport.currentCount)}</td>
            <td>{signed(locale, airport.currentCount - airport.heldCount)}</td></tr>)}</tbody>
        </table>
      </>}
      <h3>{text(C.routes, locale)}</h3>
      {(['added', 'shared', 'absent'] as const).map(status =>
        <RouteGroup key={status} status={status} routes={group(status)} rows={rows} aggregate={aggregate} locale={locale} />)}
    </>}
    <p className="cmp-muted">{text(C.latest, locale)}</p>
  </section>
}
