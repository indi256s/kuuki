// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@kuuki/client/apiClient'
import type { AwaitingQueue } from '../awaiting'
import { ToastProvider } from '../ui/toast'
import { JournalDetail, useDockedDetail } from './detail-sheet'
import { JournalDeleteProvider } from './journal-delete'
import type { JournalFlight, JournalPayload } from './model'
import { useJournalReview } from './review-mode'
import { JournalStoreProvider, useJournalStore } from './store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/link', async () => ({ default: (await import('../../test/next-link')).linkStandIn(() => {}) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() } }))

const flight = (id: number, date: string, origin: string, destination: string, lifecycle: JournalFlight['lifecycle_state'] = 'awaiting') => ({
  id, date, origin, destination, airline_iata: 'TK', aircraft_icao: null, flight_number: null,
  departure_time: null, arrival_time: null, departure_utc: null, arrival_utc: null, origin_tz: null, dest_tz: null,
  distance_km: 1000, duration_minutes: 120, duration_source: null, zones_overflown: 0, source: 'manual', is_upcoming: false, enrichment_status: 'enriched',
  created_at: '2024-05-05T10:00:00Z', lifecycle_state: lifecycle, confirmation_source: null, confirmed_at: null, lifecycle_timezone: null, awaiting_after: null,
  auto_confirm_after: null, arrival_transit: null, arrival_transit_leg_id: null, origin_country: null, destination_country: null,
}) as JournalFlight

/** Oldest first: 3 (1 May), 1 (2 May), 2 (3 May). Flight 9 is already flown. */
const journal = () => [flight(2, '2024-05-03', 'LHR', 'JFK'), flight(1, '2024-05-02', 'IST', 'LHR'), flight(3, '2024-05-01', 'TBS', 'IST'), flight(9, '2024-04-01', 'TBS', 'MUC', 'logged')]
const payloadOf = (flights: JournalFlight[]): JournalPayload => ({ flights, firsts: {}, updatedAt: 1, revision: 1, publishedRevision: 1, derivedState: 'ready', refs: { airports: {}, airlines: {}, aircraft: {} } })

/** The server's flights: confirm logs them, the journal and the awaiting queue read them. */
let server: JournalFlight[] = []
const queueOf = () => {
  const awaiting = server.filter(item => item.lifecycle_state === 'awaiting')
  return {
    awaitingFlights: awaiting.map(item => ({ flight: item, candidate: { kind: 'none', label: null, legId: null, leg: null }, effectiveDefault: { transit: false }, candidateToken: `t${item.id}` })),
    awaitingFlightCount: awaiting.length, drafts: [], actionableCount: awaiting.length, revision: 1,
  }
}
const confirmed = async (_path: string, body: unknown) => {
  const ids = (body as { items: Array<{ flightId: number }> }).items.map(item => item.flightId)
  server = server.map(item => ids.includes(item.id) ? { ...item, lifecycle_state: 'logged' } : item)
  return { results: ids.map(flightId => ({ flightId })), derivedState: 'ready', revision: 2, newlyStampedCountries: ['GB'], pendingCountryCount: 0 }
}

/** The page's `useAwaiting().data`; null unless a test sets it. */
let pageQueue: AwaitingQueue | null = null
function Content() {
  const docked = useDockedDetail()
  const { payload, hidden, online, openFlight: open } = useJournalStore()
  const review = useJournalReview({ locale: 'en', docked, queue: pageQueue, offlineNoteId: 'offline-note' })
  return <main>
    <h1>Journal</h1><button onClick={() => open(null, { review: true })}>Review flights</button>
    {!online && <p id="offline-note">Offline. Connect to change flights.</p>}
    {payload.flights.filter(item => !hidden.has(item.id)).map(item => <button key={item.id} type="button" data-flight-row={item.id}>Row {item.id}</button>)}
    <JournalDetail ownerId="owner" locale="en" docked={docked} top={review?.top} status={review?.status} footer={review?.footer} placeholder={review?.placeholder} />
  </main>
}
function Page() {
  const { hide, unhide, refresh } = useJournalStore()
  return <JournalDeleteProvider locale="en" hide={hide} unhide={unhide} refresh={refresh}><Content /></JournalDeleteProvider>
}
const mount = (flights: JournalFlight[], query: string) => {
  server = flights
  window.history.replaceState(null, '', `/journal?${query}`)
  return render(<ToastProvider><JournalStoreProvider ownerId="owner" locale="en" initial={payloadOf(flights)} initialQuery={query}><Page /></JournalStoreProvider></ToastProvider>)
}
const setOnline = (value: boolean) => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
const openFlight = () => new URLSearchParams(window.location.search).get('flight')

beforeEach(() => {
  pageQueue = null
  setOnline(true)
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) })
  vi.mocked(api.get).mockReset().mockImplementation((async (path: string) => {
    if (path === '/api/me/awaiting') return queueOf()
    if (path === '/api/flights/journal') return payloadOf(server)
    throw new Error(`unexpected GET ${path}`)
  }) as typeof api.get)
  vi.mocked(api.post).mockReset().mockImplementation(confirmed as typeof api.post)
  vi.mocked(api.delete).mockReset().mockResolvedValue({ derived_state: 'ready' })
})
afterEach(() => { vi.restoreAllMocks() })

describe('Review mode', () => {
  it('opens on the chosen awaiting flight and counts its place among every awaiting flight, oldest first', async () => {
    mount(journal(), 'flight=1&review=1')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Review 2 of 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Did you take this flight?' })).toBeInTheDocument()
  })

  it('opens on the oldest awaiting flight when none is chosen (the pill)', async () => {
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Review 1 of 3')).toBeInTheDocument()
    expect(openFlight()).toBe('3')
  })

  it('I flew confirms that flight and advances to the next one, saying what was stamped', async () => {
    const user = userEvent.setup()
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'I flew' }))
    await waitFor(() => expect(within(dialog).getByText('Review 1 of 2')).toBeInTheDocument())
    expect(openFlight()).toBe('1')
    const confirm = vi.mocked(api.post).mock.calls.find(([path]) => path === '/api/flights/confirm')!
    expect((confirm[1] as { items: unknown[] }).items).toEqual([{ flightId: 3, candidateToken: 't3' }])
    expect(within(dialog).getByText(/^Confirmed TBS → IST\. New stamp: /)).toHaveAttribute('role', 'status')
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([path]) => path === '/api/flights/journal')).toBe(true))
  })

  it('does not carry an unfinished confirmation outcome into a reopened review session', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    vi.mocked(api.post).mockImplementationOnce((async () => {
      await new Promise<void>(resolve => { finish = resolve })
      return { results: [{ flightId: 3 }], derivedState: 'ready', revision: 2, newlyStampedCountries: ['GB'], pendingCountryCount: 0 }
    }) as typeof api.post)
    mount(journal(), 'review=1')
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'I flew' }))
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close flight details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Review flights' }))
    await screen.findByRole('dialog')
    await act(async () => { finish() })
    expect(screen.queryByText(/^Confirmed TBS/)).not.toBeInTheDocument()
  })

  it('says all confirmed after the last one', async () => {
    const user = userEvent.setup()
    mount([flight(3, '2024-05-01', 'TBS', 'IST'), flight(9, '2024-04-01', 'TBS', 'MUC', 'logged')], 'review=1')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'I flew' }))
    expect(await within(dialog).findByText('All confirmed.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(openFlight()).toBeNull()
  })

  it('a refused confirmation stays on the flight and says so', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'bad', 'INVALID_REQUEST'))
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'I flew' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not confirm this flight. The list is refreshing.')
    expect(within(dialog).getByText('Review 1 of 3')).toBeInTheDocument()
    expect(openFlight()).toBe('3')
  })

  it('Did not fly hides the flight, advances, and Undo brings it back to the sheet without deleting', async () => {
    const user = userEvent.setup()
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Did not fly, remove' }))
    expect(screen.queryByText('Row 3')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Review 1 of 2')).toBeInTheDocument()
    expect(openFlight()).toBe('1')
    expect(within(dialog).getByText('Did not fly: removing TBS → IST.')).toBeInTheDocument()
    const undo = within(dialog).getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()
    await user.click(undo)
    expect(screen.getByText('Row 3')).toBeInTheDocument()
    expect(within(dialog).getByText('Review 1 of 3')).toBeInTheDocument()
    expect(openFlight()).toBe('3')
    expect(within(dialog).getByRole('button', { name: 'I flew' })).toHaveFocus()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('Next to review moves on without writing and stops at the last flight', async () => {
    const user = userEvent.setup()
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Next to review' }))
    expect(within(dialog).getByText('Review 2 of 3')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Next to review' }))
    expect(within(dialog).getByText('Review 3 of 3')).toBeInTheDocument()
    expect(openFlight()).toBe('2')
    expect(within(dialog).getByRole('button', { name: 'Next to review' })).toHaveAttribute('aria-disabled', 'true')
    expect(api.post).not.toHaveBeenCalled()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('offers the queue\'s arrival transit choice with its default and sends the member\'s change', async () => {
    const user = userEvent.setup()
    const flights = journal()
    server = flights
    const queue = queueOf()
    const first = queue.awaitingFlights.find(entry => entry.flight.id === 3)!
    Object.assign(first, { candidate: { kind: 'link', label: 'precise', legId: 1, leg: { destination: 'LHR' } }, effectiveDefault: { transit: true } })
    pageQueue = queue as unknown as AwaitingQueue
    mount(flights, 'review=1')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Connection: IST → LHR · Based on flight times')).toBeInTheDocument()
    const left = within(dialog).getByRole('checkbox', { name: 'Left the airport' })
    expect(left).not.toBeChecked()
    await user.click(left)
    await user.click(within(dialog).getByRole('button', { name: 'I flew' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect((vi.mocked(api.post).mock.calls[0]![1] as { items: unknown[] }).items).toEqual([{ flightId: 3, candidateToken: 't3', arrivalTransit: false }])
  })

  it('says there is nothing to confirm when no flight is awaiting', async () => {
    mount([flight(9, '2024-04-01', 'TBS', 'MUC', 'logged')], 'review=1')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Nothing to confirm.')).toBeInTheDocument()
  })

  it('offline blocks both answers and points at the offline note', async () => {
    setOnline(false)
    mount(journal(), 'review=1')
    const dialog = await screen.findByRole('dialog')
    await screen.findByText('Offline. Connect to change flights.', { selector: '#offline-note' })
    for (const name of ['I flew', 'Did not fly, remove']) {
      const button = within(dialog).getByRole('button', { name })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button.getAttribute('aria-describedby')).toContain('offline-note')
    }
  })
})
