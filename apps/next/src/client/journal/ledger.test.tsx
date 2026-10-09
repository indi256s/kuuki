// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { LedgerItem } from './filter'
import { JournalLedger, type JournalLedgerProps } from './ledger'
import type { JournalFlight, JournalRefs } from './model'

afterEach(() => vi.restoreAllMocks())

function flight(overrides: Partial<JournalFlight> = {}): JournalFlight {
  return {
    id: 1, date: '2024-03-12', origin: 'TBS', destination: 'IST', airline_iata: 'TK', aircraft_icao: 'A359', flight_number: 'TK381',
    departure_time: '08:00', arrival_time: '10:00', departure_utc: null, arrival_utc: null, origin_tz: null, dest_tz: null,
    distance_km: 1203, duration_minutes: 125, duration_source: 'times', zones_overflown: null, source: 'manual', is_upcoming: false,
    enrichment_status: 'done', created_at: '2024-03-12T00:00:00.000Z', lifecycle_state: 'logged', confirmation_source: 'user',
    confirmed_at: null, lifecycle_timezone: null, awaiting_after: null, auto_confirm_after: null, arrival_transit: null,
    arrival_transit_leg_id: null, origin_country: 'GE', destination_country: 'TR',
    ...overrides,
  }
}

const refs: JournalRefs = {
  airports: { TBS: { city: 'Tbilisi', name: 'Tbilisi International', country: 'GE' }, IST: { city: 'Istanbul', name: 'Istanbul Airport', country: 'TR' }, AMS: { city: 'Amsterdam', name: 'Schiphol', country: 'NL' } },
  airlines: { TK: { name: 'Turkish Airlines' } },
  aircraft: { A359: { name: 'Airbus A350-900', family: 'A350', manufacturer: 'Airbus', type: 'widebody' } },
}

const first = flight({ id: 1 })
const second = flight({ id: 2, date: '2024-03-12', origin: 'IST', destination: 'AMS', aircraft_icao: null, lifecycle_state: 'awaiting', duration_minutes: 200, duration_source: 'estimate' })
const items: LedgerItem[] = [
  { kind: 'flight', flight: second, firsts: null, chain: null },
  { kind: 'connector', key: 'connector-1-2', airport: 'IST', minutes: 165, estimated: false },
  { kind: 'flight', flight: first, firsts: { countries: ['GE'], aircraft: true, airline: true, pending: false }, chain: null },
]

function setup(overrides: Partial<JournalLedgerProps> = {}) {
  const props: JournalLedgerProps = {
    items, refs, locale: 'en', sort: { key: 'date', order: 'desc' }, onSortChange: vi.fn(), activeId: null, compact: false,
    selected: new Set(), selectable: false, onToggleSelect: vi.fn(), onOpen: vi.fn(), ...overrides,
  }
  const view = render(<JournalLedger {...props} />)
  return { props, ...view }
}

it('renders flight rows with their status, the connector band and no per-row unit in the cells', () => {
  setup()
  expect(screen.getByRole('table', { name: 'Flights' })).toBeInTheDocument()
  // Header row, two flights and the connector band.
  expect(screen.getAllByRole('row')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /IST to AMS, To confirm, Mar 12, 2024/ })).toHaveAttribute('data-flight-row', '2')
  expect(screen.getByRole('button', { name: /TBS to IST, Mar 12, 2024, TK381, Airbus A350-900, 2\s+h 5\s+min, 1,203 km/ })).toHaveAttribute('data-flight-row', '1')
  expect(screen.getByText('To confirm')).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: /IST · 2\s+h 45\s+min transfer/ })).toBeInTheDocument()
  expect(screen.getByText('Airbus A350-900')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Distance, km' })).toBeInTheDocument()
  // The estimate carries the approximation sign.
  expect(screen.getByText(/≈ 3 h 20 min/)).toBeInTheDocument()
})

it('sorts from the headers: the active column flips, another column starts descending, and aria-sort follows', async () => {
  const user = userEvent.setup()
  const { props } = setup()
  expect(screen.getByRole('columnheader', { name: 'Date' })).toHaveAttribute('aria-sort', 'descending')
  expect(screen.getByRole('columnheader', { name: 'Duration' })).toHaveAttribute('aria-sort', 'none')
  expect(screen.getByRole('columnheader', { name: 'Route' })).not.toHaveAttribute('aria-sort')
  expect(screen.queryByRole('button', { name: 'Route' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Duration' }))
  expect(props.onSortChange).toHaveBeenLastCalledWith({ key: 'duration', order: 'desc' })
  await user.click(screen.getByRole('button', { name: 'Date' }))
  expect(props.onSortChange).toHaveBeenLastCalledWith({ key: 'date', order: 'asc' })
})

it('asks for the aircraft without opening the row, and opens the row from its button', async () => {
  const user = userEvent.setup()
  const { props } = setup()
  await user.click(screen.getByRole('button', { name: /^Add aircraft/ }))
  expect(props.onOpen).toHaveBeenCalledTimes(1)
  expect(props.onOpen).toHaveBeenCalledWith(2, { field: 'aircraft' })

  await user.click(screen.getByRole('button', { name: /^TBS to IST/ }))
  expect(props.onOpen).toHaveBeenCalledTimes(2)
  expect(props.onOpen).toHaveBeenLastCalledWith(1)
})

it('selects with the checkbox without opening the row, and has no checkbox when selection is off', async () => {
  const user = userEvent.setup()
  const { unmount } = setup()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  unmount()

  const view = setup({ selectable: true, selected: new Set([2]) })
  const boxes = screen.getAllByRole('checkbox')
  expect(boxes).toHaveLength(2)
  expect(screen.getByRole('checkbox', { name: /^Select: IST to AMS/ })).toBeChecked()
  await user.click(screen.getByRole('checkbox', { name: /^Select: TBS to IST/ }))
  expect(view.props.onToggleSelect).toHaveBeenCalledWith(1, true)
  expect(view.props.onOpen).not.toHaveBeenCalled()
  })

it('marks the open row and hides Duration and Distance in compact mode', () => {
  const { rerender, props } = setup({ activeId: 1 })
  const row = screen.getByRole('button', { name: /^TBS to IST/ }).closest('tr')!
  expect(row).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: /^IST to AMS/ }).closest('tr')).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('columnheader', { name: 'Duration' })).toBeInTheDocument()

  rerender(<JournalLedger {...props} activeId={1} compact />)
  expect(screen.queryByRole('columnheader', { name: 'Duration' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Distance, km' })).not.toBeInTheDocument()
  expect(within(row).queryByText('1,203')).not.toBeInTheDocument()
})

it('names the firsts in a tooltip on keyboard focus', async () => {
  const user = userEvent.setup()
  setup()
  const glyph = screen.getByRole('img', { name: /First visit to Georgia/ })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  // jsdom matches :focus-visible only on buttons and inputs; a keyboard-focused tabindex span matches it in browsers.
  const matches = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) { return selector === ':focus-visible' ? this === document.activeElement : matches.call(this, selector) })
  for (let step = 0; step < 12 && document.activeElement !== glyph; step += 1) await user.tab()
  expect(glyph).toHaveFocus()
  const tooltip = screen.getByRole('tooltip')
  expect(tooltip).toHaveTextContent('First visit to Georgia')
  expect(tooltip).toHaveTextContent('First Airbus A350-900')
  expect(tooltip).toHaveTextContent('First flight with Turkish Airlines')
  expect(tooltip).not.toHaveTextContent('pending')
})

it('labels pending firsts, leaves out rows pending deletion with their connector, and offers row actions', () => {
  const pending = { countries: [], aircraft: false, airline: true, pending: true }
  const rowMenu = vi.fn(() => [{ id: 'open', label: 'Open', onSelect: vi.fn() }])
  const view = setup({ items: [items[0], items[1], { ...items[2], kind: 'flight', firsts: pending } as LedgerItem], rowMenu })
  const glyph = screen.getByRole('img', { name: 'First flight with Turkish Airlines (pending confirmation)' })
  expect(glyph).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Actions: / })).toHaveLength(2)

  view.rerender(<JournalLedger {...view.props} rowMenu={rowMenu} hidden={new Set([1])} />)
  expect(screen.queryByRole('button', { name: /^TBS to IST/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('cell', { name: /transfer/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^IST to AMS/ })).toBeInTheDocument()
})

it('speaks Russian: caption, status, plural-free labels and the connector', () => {
  setup({ locale: 'ru' })
  expect(screen.getByRole('table', { name: 'Перелёты' })).toBeInTheDocument()
  expect(screen.getByText('Нужно подтвердить')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Добавить самолёт, из IST в AMS, 12 мар/ })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: /IST · пересадка 2\s+ч 45\s+мин/ })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Расстояние, км' })).toBeInTheDocument()
})

it('keeps one column header per row cell when selection is on, so cells announce the right header', () => {
  setup({ selectable: true })
  const [head, ...rows] = screen.getAllByRole('row')
  const flightRow = rows.find(row => row.querySelector('[data-flight-row]'))!
  expect(within(head!).getAllByRole('columnheader')).toHaveLength(within(flightRow).getAllByRole('cell').length)
})
