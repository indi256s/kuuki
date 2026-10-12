// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it.each([{ isComposing: true }, { keyCode: 229 }])(
    'keeps IME confirmation in the field until a deliberate Enter saves (%j)',
    async (composition) => {
      const user = userEvent.setup()
      mount([flight(1)])
      const dialog = await screen.findByRole('dialog')
      await user.click(
        within(dialog).getByRole('button', { name: 'Change flight number, now TK381' }),
      )
      const input = await within(dialog).findByRole('textbox', { name: 'Flight number' })
      fireEvent.keyDown(input, { key: 'Enter', ...composition })
      expect(input).toBeInTheDocument()
      fireEvent.change(input, { target: { value: 'TK382' } })
      fireEvent.keyDown(input, { key: 'Enter', ...composition })
      expect(api.patch).not.toHaveBeenCalled()
      expect(input).toHaveValue('TK382')
      fireEvent.keyDown(input, { key: 'Enter' })
      await within(dialog).findByRole('button', { name: 'Change flight number, now TK382' })
      expect(api.patch).toHaveBeenCalledTimes(1)
    },
  )

  it('saves a field inline, confirms it in place, applies the server row and offers Undo inside the overlay that restores the server snapshot', async () => {
    const user = userEvent.setup()
    const base = flight(1)
    mount([base])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/^Istanbul, T/)).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Change flight number, now TK381' }),
    )
    const input = await within(dialog).findByRole('textbox', { name: 'Flight number' })
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, 'TK382{Enter}')

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Change flight number, now TK382' }),
      ).toHaveFocus(),
    )
    expect(within(dialog).getByTestId('field-saved')).toBeInTheDocument()
    expect(payloadNow().flights[0]).toMatchObject({ flight_number: 'TK382', origin_country: 'GE' })
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/1')
    expect(body).toMatchObject({ flight_number: 'TK382' })
    expect(Object.keys(body as object).filter((key) => key !== 'timezone')).toEqual([
      'flight_number',
      'offer_undo',
    ])
    await waitFor(() => expect(api.get).toHaveBeenCalled()) // background refresh

    // The overlay is modal, so its Undo lives inside it rather than in a toast behind the focus trap.
    expect(within(dialog).getByText('Flight number saved')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    const [undoPath, undoBody] = vi.mocked(api.patch).mock.calls[1]
    expect(undoPath).toBe('/api/flights/1')
    expect(
      Object.fromEntries(Object.entries(undoBody as object).filter(([key]) => key !== 'timezone')),
    ).toEqual({ undo_token: 'signed-snapshot' })
    expect(await screen.findByText('Change undone')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Change flight number, now TK381' }),
      ).toBeInTheDocument(),
    )
  })

  it('offers Undo in a toast beside the docked pane, and refuses it when the flight changed again since', async () => {
    const user = userEvent.setup()
    dock()
    mount([flight(1)], '')
    await user.click(screen.getByRole('button', { name: 'TBS to IST' }))
    const dialog = await screen.findByRole('complementary', { name: 'Flight details' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Change flight number, now TK381' }),
    )
    await user.clear(await within(dialog).findByRole('textbox', { name: 'Flight number' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Flight number' }), 'TK382{Enter}')
    await within(dialog).findByRole('button', { name: 'Change flight number, now TK382' })
    expect(screen.getByText('Flight number saved')).toBeInTheDocument()
    const firstUndo = screen.getByRole('button', { name: 'Undo' })
    expect(dialog).not.toContainElement(firstUndo)
    await user.click(within(dialog).getByRole('button', { name: /^Change aircraft/ }))
    const aircraft = await within(dialog).findByRole('combobox', { name: 'Aircraft' })
    await user.clear(aircraft)
    await user.type(aircraft, 'A333')
    await user.keyboard('{Enter}{Enter}') // the first Enter takes A333 from the list, the second saves
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    await user.click(firstUndo)
    expect(
      await screen.findByText(/changed after that edit, so it cannot be undone/),
    ).toBeInTheDocument()
    expect(api.patch).toHaveBeenCalledTimes(2)
  })

  it('keeps the editor open with the server message when the change is rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockRejectedValueOnce(
      new ApiError(400, 'Invalid flight', 'INVALID_FLIGHT'),
    )
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Change flight number, now TK381' }),
    )
    await user.type(
      await within(dialog).findByRole('textbox', { name: 'Flight number' }),
      '0{Enter}',
    )
    expect(
      await within(dialog).findByText('Check the flight details and try again.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Flight number' })).toHaveValue('TK3810')
  })

  it('shows the consequence preview before an airport change is saved', async () => {
    const user = userEvent.setup()
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Change from/ }))
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

  it('makes every field read-only offline and points at the note', async () => {
    setOnline(false)
    mount([flight(1)])
    const dialog = await screen.findByRole('dialog')
    const note = within(dialog).getByText('Offline. Connect to change flights.')
    const trigger = within(dialog).getByRole('button', { name: 'Change flight number, now TK381' })
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(trigger).toHaveAttribute('aria-describedby', note.id)
    await userEvent.setup().click(trigger)
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
