// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@kuuki/client/apiClient'
import { ToastProvider } from '../ui/toast'
import { DOCK_QUERY, JournalDetail, useDockedDetail } from './detail-sheet'
import type { JournalFlight, JournalPayload } from './model'
import { JournalStoreProvider, useJournalStore } from './store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/link', async () => ({
  default: (await import('../../test/next-link')).linkStandIn(() => {}),
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('@kuuki/client/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()),
  api: { get: vi.fn(), patch: vi.fn() },
}))

const flight = (id: number, overrides: Partial<JournalFlight> = {}) =>
  ({
    id,
    date: '2024-05-04',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'A321',
    flight_number: 'TK381',
    departure_time: '05:10',
    arrival_time: '06:50',
    departure_utc: '2024-05-04T01:10:00Z',
    arrival_utc: '2024-05-04T03:50:00Z',
    origin_tz: 'Asia/Tbilisi',
    dest_tz: 'Europe/Istanbul',
    distance_km: 1350,
    duration_minutes: 160,
    duration_source: 'times',
    zones_overflown: 1,
    source: 'manual',
    is_upcoming: false,
    enrichment_status: 'enriched',
    created_at: '2024-05-05T10:00:00Z',
    lifecycle_state: 'logged',
    confirmation_source: 'save',
    confirmed_at: null,
    lifecycle_timezone: null,
    awaiting_after: null,
    auto_confirm_after: null,
    arrival_transit: null,
    arrival_transit_leg_id: null,
    origin_country: 'GE',
    destination_country: 'TR',
    ...overrides,
  }) as JournalFlight
const payloadOf = (flights: JournalFlight[]): JournalPayload => ({
  flights,
  firsts: {},
  updatedAt: 1,
  revision: 1,
  publishedRevision: 1,
  derivedState: 'ready',
  refs: {
    airports: {
      TBS: { city: 'Tbilisi', name: 'Tbilisi', country: 'GE' },
      IST: { city: 'Istanbul', name: 'Istanbul', country: 'TR' },
    },
    airlines: { TK: { name: 'Turkish Airlines' } },
    aircraft: {
      A321: { name: 'Airbus A321', family: 'A320', manufacturer: 'Airbus', type: 'narrowbody' },
    },
  },
})
const dto = (base: JournalFlight, overrides: Partial<JournalFlight>) => {
  const row: Partial<JournalFlight> = { ...base, ...overrides }
  delete row.origin_country
  delete row.destination_country
  return { ...row, derived_state: 'ready', revision: 2, undo_token: 'signed-snapshot' }
}

let payloadNow: () => JournalPayload = () => {
  throw new Error('not mounted')
}
/** The server's flights: a PATCH applies its body here and answers with the row, a GET serves them. */
let server: JournalFlight[] = []
let beforeEdit: JournalFlight | undefined
const serve = async (path: string, body: unknown) => {
  const id = Number(path.split('/').at(-1))
  const fields = { ...(body as Record<string, unknown>) }
  delete fields.timezone
  delete fields.offer_undo
  if (fields.undo_token) {
    server = server.map((item) => (item.id === id ? beforeEdit! : item))
    return dto(
      server.find((item) => item.id === id)!,
      {},
    )
  }
  beforeEdit = server.find((item) => item.id === id)
  server = server.map((item) => (item.id === id ? { ...item, ...fields } : item))
  return dto(
    server.find((item) => item.id === id)!,
    {},
  )
}
function Page() {
  const docked = useDockedDetail()
  const store = useJournalStore()
  useEffect(() => {
    payloadNow = () => store.payload
  })
  return (
    <>
      <button type="button" data-flight-row="1" onClick={() => store.openFlight(1)}>
        TBS to IST
      </button>
      <button type="button" onClick={() => store.openFlight(2)}>
        Open upcoming flight
      </button>
      <JournalDetail ownerId="owner" locale="en" docked={docked} />
    </>
  )
}
const mount = (flights: JournalFlight[], query = 'flight=1') => {
  server = flights
  window.history.replaceState(null, '', `/journal${query ? `?${query}` : ''}`)
  return render(
    <ToastProvider>
      <JournalStoreProvider
        ownerId="owner"
        locale="en"
        initial={payloadOf(flights)}
        initialQuery={query}
      >
        <Page />
      </JournalStoreProvider>
    </ToastProvider>,
  )
}
const dock = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === DOCK_QUERY,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  )
const setOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })

beforeEach(() => {
  setOnline(true)
  vi.mocked(api.get)
    .mockReset()
    .mockImplementation((async () => ({ ...payloadNow(), flights: server })) as typeof api.get)
  vi.mocked(api.patch)
    .mockReset()
    .mockImplementation(serve as typeof api.patch)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('Journal detail sheet', () => {
  it('reads as a journey: cities lead, local times with quiet offsets, the time between and one arrival fact', async () => {
    mount([
      flight(1),
      flight(3, { date: '2023-01-02', origin: 'AMS', origin_country: 'NL' }),
      flight(4, { date: '2025-01-02', lifecycle_state: 'upcoming', is_upcoming: true }),
    ])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tbilisi')).toHaveClass('jd-city')
    expect(within(dialog).getByText('Istanbul')).toHaveClass('jd-city')
    expect(within(dialog).getByText('05:10')).toBeInTheDocument()
    expect(within(dialog).getByText('UTC+4')).toBeInTheDocument()
    expect(within(dialog).getByText('UTC+3')).toBeInTheDocument()
    expect(within(dialog).getByText('2 h 40 min in the air')).toBeInTheDocument()
    // The upcoming flight does not count: this is the second logged arrival in Istanbul.
    expect(within(dialog).getByText('2nd recorded arrival in Istanbul')).toBeInTheDocument()
    expect(within(dialog).getByText('Turkish Airlines')).toBeInTheDocument()
    expect(within(dialog).getByText('Airbus A321')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Firsts|In your journal|Added by you|Confirmed/)).toBeNull()
    expect(within(dialog).queryByRole('link', { name: 'Open full editor' })).toBeNull()
  })

  it('omits unknown times and empty facts without prompting, and labels an awaiting flight without an arrival fact', async () => {
    mount([
      flight(1, {
        lifecycle_state: 'awaiting',
        departure_time: null,
        arrival_time: null,
        departure_utc: null,
        arrival_utc: null,
        aircraft_icao: null,
        duration_source: 'estimate',
      }),
    ])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Waiting for your confirmation')).toBeInTheDocument()
    expect(within(dialog).getByText('About 2 h 40 min in the air')).toBeInTheDocument()
    expect(within(dialog).queryByText(/^UTC/)).toBeNull()
    expect(within(dialog).queryByText('Aircraft')).toBeNull()
    expect(within(dialog).queryByText(/^Add /)).toBeNull()
    expect(within(dialog).queryByText(/recorded arrival/)).toBeNull()
  })

  it('saves related changes together, returns to reading and offers Undo inside the overlay that restores the server snapshot', async () => {
    const user = userEvent.setup()
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Edit flight' }))
    const number = await within(dialog).findByRole('textbox', { name: 'Flight number' })
    expect(within(dialog).getByRole('heading', { name: 'Edit flight' })).toHaveFocus()
    await user.clear(number)
    await user.type(number, 'TK382')
    const departure = within(dialog).getByRole('textbox', { name: /^Departure time/ })
    await user.clear(departure)
    await user.type(departure, '05:20')
    expect(api.patch).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Edit flight' })).toHaveFocus(),
    )
    expect(api.patch).toHaveBeenCalledTimes(1)
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/1')
    expect(
      Object.fromEntries(Object.entries(body as object).filter(([key]) => key !== 'timezone')),
    ).toEqual({ departure_time: '05:20', flight_number: 'TK382', offer_undo: true })
    expect(payloadNow().flights[0]).toMatchObject({
      flight_number: 'TK382',
      departure_time: '05:20',
      origin_country: 'GE',
    })
    await waitFor(() => expect(api.get).toHaveBeenCalled()) // background refresh

    // The overlay is modal, so its Undo lives inside it rather than in a toast behind the focus trap.
    expect(within(dialog).getByText('Flight saved')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    const [undoPath, undoBody] = vi.mocked(api.patch).mock.calls[1]
    expect(undoPath).toBe('/api/flights/1')
    expect(
      Object.fromEntries(Object.entries(undoBody as object).filter(([key]) => key !== 'timezone')),
    ).toEqual({ undo_token: 'signed-snapshot' })
    expect(await screen.findByText('Change undone')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByText('05:10')).toBeInTheDocument())
  })

  it('offers Undo in a toast beside the docked pane, and refuses it when the flight changed again since', async () => {
    const user = userEvent.setup()
    dock()
    mount([flight(1)], '')
    await user.click(screen.getByRole('button', { name: 'TBS to IST' }))
    const pane = await screen.findByRole('complementary', { name: 'Flight details' })
    await user.click(within(pane).getByRole('button', { name: 'Edit flight' }))
    const number = await within(pane).findByRole('textbox', { name: 'Flight number' })
    await user.clear(number)
    await user.type(number, 'TK382{Enter}')
    await within(pane).findByRole('button', { name: 'Edit flight' })
    expect(screen.getByText('Flight number saved')).toBeInTheDocument()
    const firstUndo = screen.getByRole('button', { name: 'Undo' })
    expect(pane).not.toContainElement(firstUndo)
    await user.click(within(pane).getByRole('button', { name: 'Edit flight' }))
    const aircraft = await within(pane).findByRole('combobox', { name: 'Aircraft' })
    await user.clear(aircraft)
    await user.type(aircraft, 'A333')
    await user.keyboard('{Enter}') // takes A333 from the list
    await user.click(within(pane).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    await user.click(firstUndo)
    expect(
      await screen.findByText(/changed after that edit, so it cannot be undone/),
    ).toBeInTheDocument()
    expect(api.patch).toHaveBeenCalledTimes(2)
  })

  it('checks every changed field before sending, and keeps the form with the server message when the change is rejected', async () => {
    const user = userEvent.setup()
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Edit flight' }))
    const departure = await within(dialog).findByRole('textbox', { name: /^Departure time/ })
    await user.clear(departure)
    await user.type(departure, '25:00')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText('Use HH:MM, for example 14:30.')).toBeInTheDocument()
    expect(departure).toHaveFocus()
    expect(api.patch).not.toHaveBeenCalled()

    vi.mocked(api.patch).mockRejectedValueOnce(
      new ApiError(400, 'Invalid flight', 'INVALID_FLIGHT'),
    )
    await user.clear(departure)
    await user.type(departure, '05:20')
    await user.type(within(dialog).getByRole('textbox', { name: 'Flight number' }), '0')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(
      await within(dialog).findByText('Check the flight details and try again.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Flight number' })).toHaveValue('TK3810')
    expect(departure).toHaveValue('05:20')
  })

  it('shows the consequence preview before an airport change is saved', async () => {
    const user = userEvent.setup()
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Edit flight' }))
    const input = await within(dialog).findByRole('combobox', { name: 'From' })
    await user.clear(input)
    await user.type(input, 'MUC')
    expect(
      within(dialog).getByText(
        /^Distance becomes .* km, country changes to Germany, duration will be recalculated\.$/,
      ),
    ).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('leaves Edit on Escape without closing the overlay, and asks before Escape or Close discards changes', async () => {
    const user = userEvent.setup()
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Edit flight' }))
    await within(dialog).findByRole('textbox', { name: 'Flight number' })
    await user.keyboard('{Escape}')
    expect(within(dialog).getByRole('button', { name: 'Edit flight' })).toHaveFocus()
    expect(screen.getByRole('dialog')).toBe(dialog)

    await user.click(within(dialog).getByRole('button', { name: 'Edit flight' }))
    await user.type(await within(dialog).findByRole('textbox', { name: 'Flight number' }), '0')
    await user.keyboard('{Escape}')
    const question = within(dialog).getByRole('alertdialog', {
      name: 'Discard your changes to this flight?',
    })
    expect(within(question).getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(within(dialog).getByRole('textbox', { name: 'Flight number' })).toHaveValue('TK3810')

    await user.click(within(dialog).getByRole('button', { name: 'Close flight details' }))
    expect(screen.getByRole('dialog')).toBe(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.patch).not.toHaveBeenCalled()
    expect(payloadNow().flights[0].flight_number).toBe('TK381')
  })

  it('makes Edit unavailable offline and points at the note', async () => {
    setOnline(false)
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    const note = within(dialog).getByText('Offline. Connect to change flights.')
    const edit = within(dialog).getByRole('button', { name: 'Edit flight' })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    expect(edit).toHaveAttribute('aria-describedby', expect.stringContaining(note.id))
    await userEvent.setup().click(edit)
    expect(within(dialog).queryByRole('textbox')).toBeNull()
  })

  it('says quietly that an unknown flight is gone, and closes', async () => {
    const user = userEvent.setup()
    mount([flight(1)], 'flight=999')
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('This flight is no longer in your journal.'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.search).toBe('')
  })

  it('docks as a non-modal pane at 1280px: focus moves in, Escape closes it and focus returns to the row', async () => {
    const user = userEvent.setup()
    dock()
    mount(
      [
        flight(1),
        flight(2, {
          date: '2024-05-04',
          origin: 'IST',
          destination: 'JFK',
          departure_utc: '2024-05-04T06:30:00Z',
          arrival_utc: '2024-05-04T17:00:00Z',
        }),
      ],
      '',
    )
    expect(screen.queryByRole('complementary')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'TBS to IST' }))
    const pane = await screen.findByRole('complementary', { name: 'Flight details' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(pane).getByRole('heading', { level: 2 })).toHaveFocus()
    // Identity before any decision: the title names the date and flight number, not only a route that may repeat.
    expect(within(pane).getByRole('heading', { level: 2 })).toHaveAccessibleName(
      /^TBS\s*to\s*IST\s*,\s*May 4, 2024 · TK381$/,
    )
    // The connection's next leg swaps the pane and keeps focus inside it.
    expect(within(pane).getByText('2 h 40 min transfer in IST')).toBeInTheDocument()
    await user.click(within(pane).getByRole('button', { name: /^Open IST → JFK/ }))
    await waitFor(() =>
      expect(within(pane).getByRole('heading', { level: 2 })).toHaveTextContent(/IST.*JFK/),
    )
    expect(within(pane).getByRole('heading', { level: 2 })).toHaveFocus()
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
  })

  it('returns focus to an upcoming flight opener outside the ledger after Escape', async () => {
    const user = userEvent.setup()
    dock()
    mount([flight(1), flight(2, { is_upcoming: true, lifecycle_state: 'upcoming' })], '')
    const opener = screen.getByRole('button', { name: 'Open upcoming flight' })
    await user.click(opener)
    const pane = await screen.findByRole('complementary', { name: 'Flight details' })
    expect(within(pane).getByRole('heading', { level: 2 })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
    expect(opener).toHaveFocus()
  })

  it('returns focus to the originating row when the pane closes', async () => {
    const user = userEvent.setup()
    dock()
    mount([flight(1)], '')
    await user.click(screen.getByRole('button', { name: 'TBS to IST' }))
    const pane = await screen.findByRole('complementary', { name: 'Flight details' })
    await user.click(within(pane).getByRole('button', { name: 'Close flight details' }))
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
    expect(screen.getByRole('button', { name: 'TBS to IST' })).toHaveFocus()
  })
})
