// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { LedgerItem } from './filter'
import { JournalLedger, type JournalLedgerProps } from './ledger'
import type { JournalFlight, JournalRefs } from './model'

afterEach(() => vi.restoreAllMocks())

function flight(overrides: Partial<JournalFlight> = {}): JournalFlight {
  return {
    id: 1,
    date: '2024-03-12',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'A359',
    flight_number: 'TK381',
    departure_time: '08:00',
    arrival_time: '10:00',
    departure_utc: null,
    arrival_utc: null,
    origin_tz: null,
    dest_tz: null,
    distance_km: 1203,
    duration_minutes: 125,
    duration_source: 'times',
    zones_overflown: null,
    source: 'manual',
    is_upcoming: false,
    enrichment_status: 'done',
    created_at: '2024-03-12T00:00:00.000Z',
    lifecycle_state: 'logged',
    confirmation_source: 'user',
    confirmed_at: null,
    lifecycle_timezone: null,
    awaiting_after: null,
    auto_confirm_after: null,
    arrival_transit: null,
    arrival_transit_leg_id: null,
    origin_country: 'GE',
    destination_country: 'TR',
    ...overrides,
  }
}

const refs: JournalRefs = {
  airports: {
    TBS: { city: 'Tbilisi', name: 'Tbilisi International', country: 'GE' },
    IST: { city: 'Istanbul', name: 'Istanbul Airport', country: 'TR' },
    AMS: { city: 'Amsterdam', name: 'Schiphol', country: 'NL' },
  },
  airlines: { TK: { name: 'Turkish Airlines' } },
  aircraft: {
    A359: { name: 'Airbus A350-900', family: 'A350', manufacturer: 'Airbus', type: 'widebody' },
  },
}

const first = flight({ id: 1 })
const second = flight({
  id: 2,
  date: '2024-03-12',
  origin: 'IST',
  destination: 'AMS',
  aircraft_icao: null,
  lifecycle_state: 'awaiting',
  duration_minutes: 200,
  duration_source: 'estimate',
})
const items: LedgerItem[] = [
  { kind: 'flight', flight: second, chain: null },
  { kind: 'connector', key: 'connector-1-2', airport: 'IST', minutes: 165, estimated: false },
  { kind: 'flight', flight: first, chain: null },
]

function setup(overrides: Partial<JournalLedgerProps> = {}) {
  const props: JournalLedgerProps = {
    items,
    refs,
    locale: 'en',
    sort: { key: 'date', order: 'desc' },
    onSortChange: vi.fn(),
    activeId: null,
    compact: false,
    selected: new Set(),
    selectable: false,
    onToggleSelect: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  }
  const view = render(<JournalLedger {...props} />)
  return { props, ...view }
}

it('renders flight rows with their status, the connector band and no per-row unit in the cells', () => {
  setup()
  expect(screen.getByRole('table', { name: 'Flights' })).toBeInTheDocument()
  // Header row, two flights and the connector band.
  expect(screen.getAllByRole('row')).toHaveLength(4)
  expect(
    screen.getByRole('button', { name: /IST to AMS, To confirm, Mar 12, 2024/ }),
  ).toHaveAttribute('data-flight-row', '2')
  expect(
    screen.getByRole('button', {
      name: /TBS to IST, Mar 12, 2024, Turkish Airlines, TK381, Airbus A350-900, 2\s+h 5\s+min, 1,203 km/,
    }),
  ).toHaveAttribute('data-flight-row', '1')
  expect(screen.getByText('To confirm')).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: /IST · 2\s+h 45\s+min transfer/ })).toBeInTheDocument()
  expect(screen.getByText('Airbus A350-900')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Distance, km' })).toBeInTheDocument()
  // The estimate carries the approximation sign.
  expect(screen.getByText(/≈ 3 h 20 min/)).toBeInTheDocument()
})

it('keeps airline identity and the flight number when a local logo fails to load', () => {
  setup({
    items: [{ kind: 'flight', flight: first, chain: null }],
    refs: { ...refs, airlines: {} },
  })
  const open = screen.getByRole('button', { name: /Turkish Airlines, TK381/ })
  const row = within(open.closest('[role=row]')!)
  const logos = row.getAllByAltText('') as HTMLImageElement[]
  for (const logo of logos) {
    const source = new URL(logo.src)
    expect(source.origin).toBe(window.location.origin)
    expect(source.pathname).toMatch(/^\/airlines\/TK\./)
  }
  const darkLogo = logos.find((logo) => new URL(logo.src).pathname.endsWith('.dark.png'))!
  fireEvent.error(darkLogo)
  const logo = row.getByAltText('') as HTMLImageElement
  expect(new URL(logo.src).pathname).toBe('/airlines/TK.png')
  expect(open).toHaveAccessibleName(/Turkish Airlines, TK381/)
  fireEvent.error(logo)
  expect(row.queryByAltText('')).toBeNull()
  expect(row.getByText('TK')).toBeInTheDocument()
  expect(row.getByText('Turkish Airlines')).toBeInTheDocument()
  expect(row.getByText('TK381')).toBeInTheDocument()
  expect(open).toHaveAccessibleName(/Turkish Airlines, TK381/)
})

it('preserves an impossible legacy date instead of normalizing it to another day', () => {
  setup({
    items: [{ kind: 'flight', flight: flight({ date: '2024-02-31' }), chain: null }],
  })
  const date = screen.getByLabelText('2024-02-31')
  expect(date).toHaveTextContent('2024-02-31')
  expect(date).not.toHaveTextContent('2 Mar')
})

it('sorts from the headers: the active column flips, another column starts descending, and aria-sort follows', async () => {
  const user = userEvent.setup()
  const { props } = setup()
  expect(screen.getByRole('columnheader', { name: 'Date' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(screen.getByRole('columnheader', { name: 'Duration' })).toHaveAttribute(
    'aria-sort',
    'none',
  )
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
  expect(screen.getByRole('button', { name: /^IST to AMS/ }).closest('tr')).not.toHaveAttribute(
    'aria-current',
  )
  expect(screen.getByRole('columnheader', { name: 'Duration' })).toBeInTheDocument()

  rerender(<JournalLedger {...props} activeId={1} compact />)
  expect(screen.queryByRole('columnheader', { name: 'Duration' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Distance, km' })).not.toBeInTheDocument()
  expect(within(row).queryByText('1,203')).not.toBeInTheDocument()
})

it('leaves out rows pending deletion with their connector, and offers row actions', () => {
  const rowMenu = vi.fn(() => [{ id: 'open', label: 'Open', onSelect: vi.fn() }])
  const view = setup({ rowMenu })
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
  expect(
    screen.getByRole('button', { name: /^Добавить самолёт, из IST в AMS, 12 мар/ }),
  ).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: /IST · пересадка 2\s+ч 45\s+мин/ })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Расстояние, км' })).toBeInTheDocument()
})

it('keeps one column header per row cell when selection is on, so cells announce the right header', () => {
  setup({ selectable: true })
  const [head, ...rows] = screen.getAllByRole('row')
  const flightRow = rows.find((row) => row.querySelector('[data-flight-row]'))!
  expect(within(head!).getAllByRole('columnheader')).toHaveLength(
    within(flightRow).getAllByRole('cell').length,
  )
})

it('mobile card swipes and the accessible menu invoke the same actions, and the menu starts selection', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn(),
    remove = vi.fn(),
    select = vi.fn()
  const pending = {
    kind: 'flight' as const,
    flight: { ...second, flight_number: '381' },
    chain: null,
  }
  setup({
    mobile: true,
    items: [pending],
    rowMenu: () => [
      { id: 'confirm', label: 'I flew', onSelect: confirm },
      { id: 'delete', label: 'Delete flight', danger: true, onSelect: remove },
      { id: 'select', label: 'Select', onSelect: select },
    ],
    swipeActions: () => ({
      leading: [{ label: 'I flew', icon: null, onSelect: confirm }],
      trailing: [{ label: 'Delete flight', icon: null, onSelect: remove }],
    }),
  })
  const identity = screen.getByText('TK 381').parentElement!
  expect(identity).toHaveTextContent('Mar 12, 2024')
  const actionButton = screen.getByRole('button', { name: /Actions:/ })
  await user.click(actionButton)
  await user.click(await screen.findByRole('menuitem', { name: 'I flew' }))
  expect(confirm).toHaveBeenCalledTimes(1)
  await user.click(actionButton)
  await user.click(await screen.findByRole('menuitem', { name: 'Delete flight' }))
  expect(remove).toHaveBeenCalledTimes(1)
  await user.click(actionButton)
  await user.click(await screen.findByRole('menuitem', { name: 'Select' }))
  expect(select).toHaveBeenCalledTimes(1)
  const card = screen.getByRole('button', { name: /^IST to AMS/ }).closest('.ui-swipe-content')!
  const touch = { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, clientY: 10 }
  for (const direction of [1, -1]) {
    fireEvent.pointerDown(card, { ...touch, clientX: 300 })
    fireEvent.pointerMove(card, { ...touch, clientX: 300 + direction * 20 })
    fireEvent.pointerMove(card, { ...touch, clientX: 300 + direction * 240 })
    fireEvent.pointerUp(card, { ...touch, clientX: 300 + direction * 240 })
    // These are separate action shortcuts; let the row return before the opposite swipe.
    await waitFor(() => expect(card.closest('.ui-swipe-row')).not.toHaveAttribute('data-reveal'))
  }
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(remove).toHaveBeenCalledTimes(2)
})
