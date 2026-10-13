'use client'

import { makerOf } from '@kuuki/data/aircraft-makers'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import { ChevronIcon } from '../ui/icon-morph'
import { memo, useMemo, useRef, type MouseEvent } from 'react'
import { formatDateOnly, formatDuration, formatNumber, type Locale } from '../../lib/format'
import { airlineIdentity } from '../../lib/airline'
import { AirlineMark } from '../ui/airline-mark'
import { Button } from '../ui/button'
import { MakerSwatch } from '../ui/category-mark'
import { Checkbox } from '../ui/checkbox'
import { ContextMenu, ContextMenuButton, type ContextMenuItem } from '../ui/context-menu'
import { SwipeActions, SwipeActionsRow, type SwipeAction } from '../ui/swipe-actions'
import { FirstsGlyph } from './firsts-glyph'
import { useProgressiveCount } from './progressive'
import type { LedgerItem } from './filter'
import {
  flightCode,
  type FlightFirsts,
  type JournalFlight,
  type JournalRefs,
  type JournalSort,
  type JournalSortKey,
} from './model'
import './ledger.css'

// Presentation adapted from Arc "sortable-data-table" (uiarc.dev, MIT, see ui/ARC-LICENSE.txt): the sortable header buttons, the aria-sort cue and the selectable rows.
// Dropped: `motion`, the table's own sorting, selection state and count footer, the enclosing box and every hairline. Sorting, selection and the open row all come from props.
// The markup is a real <table> with explicit ARIA roles; the CSS turns rows into grids (and cards on phones), which would otherwise strip the table semantics.

const copy = {
  en: {
    caption: 'Flights',
    date: 'Date',
    route: 'Route',
    airline: 'Airline',
    aircraft: 'Aircraft',
    duration: 'Duration',
    distance: 'Distance, km',
    toConfirm: 'To confirm',
    upcoming: 'Upcoming',
    addAircraft: 'Add aircraft',
    actions: 'Actions',
    select: 'Select',
    notRecorded: 'Not recorded',
    km: 'km',
    routeName: (origin: string, destination: string) => `${origin} to ${destination}`,
    connection: (airport: string, duration: string | null, estimated: boolean) =>
      duration === null
        ? `${airport} · connection`
        : `${airport} · ${estimated ? '≈ ' : ''}${duration} transfer`,
  },
  ru: {
    caption: 'Перелёты',
    date: 'Дата',
    route: 'Маршрут',
    airline: 'Авиакомпания',
    aircraft: 'Самолёт',
    duration: 'В пути',
    distance: 'Расстояние, км',
    toConfirm: 'Нужно подтвердить',
    upcoming: 'Предстоит',
    addAircraft: 'Добавить самолёт',
    actions: 'Действия',
    select: 'Выбрать',
    notRecorded: 'Нет данных',
    km: 'км',
    routeName: (origin: string, destination: string) => `из ${origin} в ${destination}`,
    connection: (airport: string, duration: string | null, estimated: boolean) =>
      duration === null
        ? `${airport} · пересадка`
        : `${airport} · пересадка ${estimated ? '≈ ' : ''}${duration}`,
  },
} as const

export type JournalLedgerProps = {
  items: LedgerItem[]
  refs: JournalRefs
  locale: Locale
  sort: JournalSort
  onSortChange: (sort: JournalSort) => void
  /** The row whose sheet is open: highlighted and marked `aria-current`. */
  activeId: number | null
  /** The split pane is open: Duration and Distance are hidden. */
  compact: boolean
  selected: ReadonlySet<number>
  selectable: boolean
  onToggleSelect: (id: number, checked: boolean) => void
  onOpen: (id: number, opts?: { field?: 'aircraft' }) => void
  rowMenu?: (flight: JournalFlight) => ContextMenuItem[]
  rowMenuReason?: string
  mobile?: boolean
  swipeActions?: (flight: JournalFlight) => { leading?: SwipeAction[]; trailing?: SwipeAction[] }
  /** Rows pending deletion are not rendered (nor a connector that touched them). */
  hidden?: ReadonlySet<number>
}

const positive = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const shortDateFormats = {
  en: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  ru: new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
}

function dayAndMonth(locale: Locale, date: string) {
  const epoch = dayToEpoch(date)
  if (epoch === null) return date
  const parts = shortDateFormats[locale].formatToParts(new Date(epoch))
  return `${parts.find((part) => part.type === 'day')?.value} ${parts.find((part) => part.type === 'month')?.value}`
}

function Unknown({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">{label}</span>
    </>
  )
}

type RowProps = {
  flight: JournalFlight
  firsts: FlightFirsts | null
  refs: JournalRefs
  locale: Locale
  active: boolean
  compact: boolean
  selected: boolean
  selectable: boolean
  onOpen: JournalLedgerProps['onOpen']
  onToggleSelect: JournalLedgerProps['onToggleSelect']
  rowMenu: JournalLedgerProps['rowMenu']
  rowMenuReason?: string
  mobile?: boolean
}

// Memo compares flight identity and the booleans (plus the stable props), so a selection or a sort cue elsewhere re-renders only the rows it touches. Callers pass stable callbacks.
// "Any row is selected" reaches the checkboxes through `data-selecting` on the table, not through a prop.
const FlightRow = memo(function FlightRow({
  flight,
  firsts,
  refs,
  locale,
  active,
  compact,
  selected,
  selectable,
  onOpen,
  onToggleSelect,
  rowMenu,
  rowMenuReason,
  mobile,
}: RowProps) {
  const Row = mobile ? 'div' : 'tr'
  const Cell = mobile ? 'div' : 'td'
  const t = copy[locale]
  const openButton = useRef<HTMLButtonElement>(null)
  const date = formatDateOnly(locale, flight.date, 'medium')
  const code = flightCode(flight)
  const route = t.routeName(flight.origin, flight.destination)
  const status =
    flight.lifecycle_state === 'awaiting'
      ? t.toConfirm
      : flight.lifecycle_state === 'upcoming'
        ? t.upcoming
        : null
  const airline = flight.airline_iata
    ? (refs.airlines[flight.airline_iata]?.name ??
      airlineIdentity(flight.airline_iata)?.name ??
      null)
    : null
  const aircraftRef = flight.aircraft_icao ? refs.aircraft[flight.aircraft_icao] : undefined
  const aircraftName = flight.aircraft_icao ? (aircraftRef?.name ?? flight.aircraft_icao) : null
  const origin = refs.airports[flight.origin],
    destination = refs.airports[flight.destination]
  const cities = [
    origin?.city ?? origin?.name ?? flight.origin,
    destination?.city ?? destination?.name ?? flight.destination,
  ]
  const duration = positive(flight.duration_minutes)
    ? `${flight.duration_source === 'estimate' ? '≈ ' : ''}${formatDuration(locale, flight.duration_minutes!)}`
    : null
  const distance = positive(flight.distance_km) ? formatNumber(locale, flight.distance_km!) : null
  const name = [
    route,
    status,
    date,
    airline,
    flight.flight_number ?? flight.airline_iata,
    aircraftName,
    duration,
    distance && `${distance} ${t.km}`,
  ]
    .filter(Boolean)
    .join(', ')
  const items = rowMenu?.(flight)
  const actionLabel = `${t.actions}: ${route}, ${date}`

  const onRowClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element
    // Menu items render in a portal: React bubbles their clicks here, the DOM does not contain them.
    if (!event.currentTarget.contains(target) || target.closest('[data-no-open]')) return
    onOpen(flight.id)
  }

  const routeCell = (
    <>
      <button
        ref={openButton}
        type="button"
        className="jr-open"
        data-flight-row={flight.id}
        aria-label={name}
      >
        <span className="jr-codes">
          {flight.origin}
          <span aria-hidden="true"> → </span>
          {flight.destination}
        </span>
        <span className="jr-cities">
          {cities[0]}
          <span aria-hidden="true"> → </span>
          {cities[1]}
        </span>
      </button>
      {firsts && <FirstsGlyph firsts={firsts} flight={flight} refs={refs} locale={locale} />}
      {items && (
        <span className="jr-more-slot" data-no-open>
          <ContextMenuButton label={actionLabel} className="jr-more" />
        </span>
      )}
    </>
  )

  return (
    <Row
      role="row"
      className="jr-row"
      data-kind="flight"
      data-active={active || undefined}
      data-selected={selected || undefined}
      aria-current={active ? 'true' : undefined}
      onClick={onRowClick}
    >
      {selectable && (
        <Cell role="cell" className="jr-select" data-no-open>
          <Checkbox
            checked={selected}
            aria-label={`${t.select}: ${route}, ${date}`}
            onChange={(event) => onToggleSelect(flight.id, event.target.checked)}
          />
        </Cell>
      )}
      <Cell role="cell" className="jr-date">
        <time className="jr-date-text" dateTime={flight.date} aria-label={date}>
          <span>{dayAndMonth(locale, flight.date)}</span>
          {date !== flight.date && <span className="jr-date-year">{flight.date.slice(0, 4)}</span>}
        </time>
        {mobile && (
          <span className="jr-identity">
            <time dateTime={flight.date}>{date}</time>
            {code && <span>{code}</span>}
          </span>
        )}
        {status && (
          <span className="jr-badge" data-state={flight.lifecycle_state}>
            {status}
          </span>
        )}
      </Cell>
      <Cell role="cell" className="jr-route">
        {items ? (
          <ContextMenu
            className="jr-route-inner jr-menu"
            label={actionLabel}
            items={items}
            reason={rowMenuReason}
            returnFocus={() => openButton.current}
          >
            {routeCell}
          </ContextMenu>
        ) : (
          <div className="jr-route-inner">{routeCell}</div>
        )}
      </Cell>
      <Cell role="cell" className="jr-airline">
        {flight.airline_iata ? (
          <span className="jr-airline-line">
            <AirlineMark iata={flight.airline_iata} />
            <span className="jr-code">{flight.airline_iata}</span>
            {airline && <span className="jr-airline-name">{airline}</span>}
          </span>
        ) : flight.flight_number ? null : (
          <Unknown label={t.notRecorded} />
        )}
        {flight.flight_number && <span className="jr-flightno">{flight.flight_number}</span>}
      </Cell>
      <Cell role="cell" className="jr-aircraft">
        {aircraftName ? (
          <span className="jr-aircraft-line">
            <MakerSwatch maker={makerOf(flight.aircraft_icao)} size={10} />
            <span className="jr-aircraft-name" title={aircraftName}>
              {aircraftName}
            </span>
          </span>
        ) : (
          <Button
            variant="ghost"
            dense
            static
            data-no-open
            aria-label={`${t.addAircraft}, ${route}, ${date}`}
            onClick={() => onOpen(flight.id, { field: 'aircraft' })}
          >
            {t.addAircraft}
          </Button>
        )}
      </Cell>
      {!compact && (
        <Cell role="cell" className="jr-duration">
          {duration ?? <Unknown label={t.notRecorded} />}
        </Cell>
      )}
      {!compact && (
        <Cell role="cell" className="jr-distance">
          {distance ? (
            <>
              {distance}
              <span className="jr-km"> {t.km}</span>
            </>
          ) : (
            <Unknown label={t.notRecorded} />
          )}
        </Cell>
      )}
    </Row>
  )
})

function ConnectorRow({
  item,
  locale,
  columns,
}: {
  item: Extract<LedgerItem, { kind: 'connector' }>
  locale: Locale
  columns: number
}) {
  const duration = item.minutes === null ? null : formatDuration(locale, Math.max(0, item.minutes))
  return (
    <tr role="row" className="jr-row" data-kind="connector">
      <td role="cell" colSpan={columns} className="jr-connector">
        {copy[locale].connection(item.airport, duration, item.estimated)}
      </td>
    </tr>
  )
}

export function JournalLedger({
  items,
  refs,
  locale,
  sort,
  onSortChange,
  activeId,
  compact,
  selected,
  selectable,
  onToggleSelect,
  onOpen,
  rowMenu,
  rowMenuReason,
  mobile,
  swipeActions,
  hidden,
}: JournalLedgerProps) {
  const t = copy[locale]
  const selecting = selected.size > 0
  const visible = useMemo(() => {
    if (!hidden?.size) return items
    const shown = (item: LedgerItem | undefined) =>
      item?.kind === 'flight' && !hidden.has(item.flight.id)
    return items.filter((item, index) =>
      item.kind === 'flight'
        ? !hidden.has(item.flight.id)
        : shown(items[index - 1]) && shown(items[index + 1]),
    )
  }, [items, hidden])
  // D3: the server and the hydrating render show the first rows; the rest mount right after in interruptible chunks.
  const mounted = useProgressiveCount(visible.length)
  const rows = mounted < visible.length ? visible.slice(0, mounted) : visible
  const columns = 4 + (compact ? 0 : 2) + (selectable ? 1 : 0)

  const sortBy = (key: JournalSortKey) =>
    onSortChange(
      sort.key === key
        ? { key, order: sort.order === 'desc' ? 'asc' : 'desc' }
        : { key, order: 'desc' },
    )
  const header = (
    key: JournalSortKey | null,
    label: string,
    className: string,
    visibleLabel = label,
  ) => {
    if (!key)
      return (
        <th role="columnheader" scope="col" className={className}>
          {label}
        </th>
      )
    const active = sort.key === key
    return (
      <th
        role="columnheader"
        scope="col"
        className={className}
        aria-label={label}
        aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="jr-sort" aria-label={label} onClick={() => sortBy(key)}>
          <span>{visibleLabel}</span>
          <ChevronIcon
            className="jr-sort-cue"
            state={sort.order === 'asc'}
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            data-order={active ? sort.order : undefined}
          />
        </button>
      </th>
    )
  }

  const renderFlight = (item: Extract<LedgerItem, { kind: 'flight' }>) => (
    <FlightRow
      flight={item.flight}
      firsts={item.firsts}
      refs={refs}
      locale={locale}
      active={activeId === item.flight.id}
      compact={compact}
      selected={selected.has(item.flight.id)}
      selectable={selectable}
      onOpen={onOpen}
      onToggleSelect={onToggleSelect}
      rowMenu={rowMenu}
      rowMenuReason={rowMenuReason}
      mobile={mobile}
    />
  )
  if (mobile)
    return (
      <div
        role="table"
        aria-label={t.caption}
        className="journal-ledger"
        data-menu={rowMenu ? 'true' : undefined}
        data-selecting={selecting || undefined}
      >
        <SwipeActions className="jr-body">
          <div
            role="rowgroup"
            className="jr-mobile-rows"
            aria-busy={mounted < visible.length || undefined}
          >
            {rows.map((item) =>
              item.kind === 'connector' ? (
                <div role="row" key={item.key} className="jr-row" data-kind="connector">
                  <div role="cell" className="jr-connector">
                    {t.connection(
                      item.airport,
                      item.minutes === null
                        ? null
                        : formatDuration(locale, Math.max(0, item.minutes)),
                      item.estimated,
                    )}
                  </div>
                </div>
              ) : (
                <SwipeActionsRow key={item.flight.id} {...swipeActions?.(item.flight)}>
                  {renderFlight(item)}
                </SwipeActionsRow>
              ),
            )}
          </div>
        </SwipeActions>
      </div>
    )

  return (
    <table
      role="table"
      className="journal-ledger"
      data-compact={compact || undefined}
      data-menu={rowMenu ? 'true' : undefined}
      data-selectable={selectable || undefined}
      data-selecting={selecting || undefined}
    >
      <caption className="sr-only">{t.caption}</caption>
      <thead role="rowgroup" className="jr-head">
        <tr role="row" className="jr-headrow">
          {/* Matches the rows' leading checkbox cell, so every cell keeps its column header. */}
          {selectable && (
            <th role="columnheader" scope="col" className="jr-select-head">
              <span className="sr-only">{t.select}</span>
            </th>
          )}
          {header('date', t.date, 'jr-date')}
          {header(null, t.route, 'jr-route')}
          {header(null, t.airline, 'jr-airline')}
          {header(null, t.aircraft, 'jr-aircraft')}
          {!compact && header('duration', t.duration, 'jr-duration')}
          {!compact && header('distance', t.distance, 'jr-distance', t.km)}
        </tr>
      </thead>
      <tbody role="rowgroup" className="jr-body" aria-busy={mounted < visible.length || undefined}>
        {rows.map((item) =>
          item.kind === 'connector' ? (
            <ConnectorRow key={item.key} item={item} locale={locale} columns={columns} />
          ) : (
            <FlightRow
              key={item.flight.id}
              flight={item.flight}
              firsts={item.firsts}
              refs={refs}
              locale={locale}
              active={activeId === item.flight.id}
              compact={compact}
              selected={selected.has(item.flight.id)}
              selectable={selectable}
              onOpen={onOpen}
              onToggleSelect={onToggleSelect}
              rowMenu={rowMenu}
              rowMenuReason={rowMenuReason}
            />
          ),
        )}
      </tbody>
    </table>
  )
}
