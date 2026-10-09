// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import type { AwaitingQueue } from '../awaiting'
import { ToastProvider } from '../ui/toast'
import { JournalBulkActions } from './bulk-actions'
import { downloadCsv } from './export-csv'
import { JournalDeleteProvider } from './journal-delete'
import type { JournalFlight, JournalRefs } from './model'

vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('./export-csv', async importOriginal => ({ ...(await importOriginal<typeof import('./export-csv')>()), downloadCsv: vi.fn() }))

const refs: JournalRefs = { airports: {}, airlines: {}, aircraft: {} }
const flight = (id: number, overrides: Partial<JournalFlight> = {}) => ({
  id, date: '2024-05-01', origin: 'TBS', destination: 'IST', airline_iata: 'TK', aircraft_icao: null, flight_number: null, departure_time: null, departure_utc: null, arrival_utc: null,
  distance_km: 1000, duration_minutes: 120, lifecycle_state: 'logged', ...overrides,
}) as unknown as JournalFlight

function Harness({ flights, ticked = flights.map(f => f.id), online = true, queue = null, refresh }: {
  flights: JournalFlight[]; ticked?: number[]; online?: boolean; queue?: AwaitingQueue | null; refresh: () => Promise<void>
}) {
  const [selected, setSelected] = useState(() => new Set(ticked))
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  const visible = flights.filter(f => !hidden.has(f.id))
  return <ToastProvider><JournalDeleteProvider locale="en" refresh={refresh}
    hide={ids => { setHidden(old => new Set([...old, ...ids])); setSelected(old => new Set([...old].filter(id => !ids.includes(id)))) }}
    unhide={ids => setHidden(old => new Set([...old].filter(id => !ids.includes(id))))}><main>
    <h1>Journal</h1>
    {!online && <p id="offline-note">Offline. Connect to change flights.</p>}
    {visible.map(f => <button key={f.id} type="button" data-flight-row={f.id}>Row {f.id}</button>)}
    <JournalBulkActions locale="en" selected={visible.filter(f => selected.has(f.id))} matching={visible} refs={refs} queue={queue} online={online} offlineNoteId="offline-note"
      onSelectAll={ids => setSelected(new Set(ids))} onClear={() => setSelected(new Set())} refresh={refresh} />
  </main></JournalDeleteProvider></ToastProvider>
}

const bar = () => screen.getByRole('toolbar', { name: 'Selection actions' })
const accepted = (items: Array<{ id: number; aircraft_icao: string }>) => ({ results: items.map(item => ({ id: item.id, status: 'accepted', flight: { id: item.id, aircraft_icao: item.aircraft_icao } })), derived_state: 'ready' })

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(downloadCsv).mockReset()
})
afterEach(() => { vi.useRealTimers() })

describe('Set aircraft', () => {
  async function chooseAircraft() {
    fireEvent.click(within(bar()).getByRole('button', { name: 'Set aircraft' }))
    const dialog = await screen.findByRole('dialog', { name: 'Set aircraft' })
    fireEvent.change(await within(dialog).findByRole('combobox'), { target: { value: 'A320' } })
    return dialog
  }

  it('fills only flights without an aircraft by default, in sequential chunks of 20', async () => {
    vi.mocked(api.post).mockImplementation(async (_path, body) => accepted((body as { items: Array<{ id: number; aircraft_icao: string }> }).items))
    const refresh = vi.fn(async () => {})
    const flights = [...Array.from({ length: 25 }, (_, i) => flight(i + 1)), ...[26, 27, 28].map(id => flight(id, { aircraft_icao: 'B738' }))]
    render(<Harness flights={flights} refresh={refresh} />)
    const dialog = await chooseAircraft()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set for 25 without aircraft (3 already set)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const calls = vi.mocked(api.post).mock.calls
    expect(calls.map(([path]) => path)).toEqual(['/api/flights/aircraft-batch', '/api/flights/aircraft-batch'])
    const sent = calls.map(([, body]) => (body as { items: Array<{ id: number; aircraft_icao: string }> }).items)
    expect(sent.map(items => items.length)).toEqual([20, 5])
    expect(sent.flat().map(item => item.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    expect(sent.flat().every(item => item.aircraft_icao === 'A320')).toBe(true)
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByText('Aircraft set for 25 flights.')).toHaveAttribute('role', 'status')
  })

  it('replaces existing aircraft only after the explicit tick', async () => {
    vi.mocked(api.post).mockImplementation(async (_path, body) => accepted((body as { items: Array<{ id: number; aircraft_icao: string }> }).items))
    render(<Harness flights={[flight(1, { aircraft_icao: 'B738' }), flight(2, { aircraft_icao: 'A21N' })]} refresh={async () => {}} />)
    const dialog = await chooseAircraft()
    const blocked = within(dialog).getByRole('button', { name: 'Set aircraft' })
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByText(/Every selected flight already has an aircraft/)).toBeInTheDocument()
    fireEvent.click(blocked)
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Replace all 2' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set for all 2' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect((vi.mocked(api.post).mock.calls[0]![1] as { items: Array<{ id: number }> }).items.map(item => item.id)).toEqual([1, 2])
  })

  it('reports a partial failure and refreshes', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(accepted(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, aircraft_icao: 'A320' })))).mockRejectedValueOnce(Object.assign(new Error('bad'), { status: 400, code: 'INVALID' }))
    const refresh = vi.fn(async () => {})
    render(<Harness flights={Array.from({ length: 23 }, (_, i) => flight(i + 1))} refresh={refresh} />)
    const dialog = await chooseAircraft()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set for 23 flights' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Aircraft set for 20 of 23 flights. Not saved: 3.')
    expect(refresh).toHaveBeenCalled()
  })
})

describe('Delete', () => {
  it('hides the rows at once, focuses Undo and deletes after six seconds', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockResolvedValue({ deleted: 2, derived_state: 'ready' })
    const refresh = vi.fn(async () => {})
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    render(<Harness flights={[flight(1), flight(2), flight(3)]} ticked={[1, 2]} refresh={refresh} />)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
    expect(screen.getByText('Row 3')).toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    expect(screen.getByText('2 flights are being deleted.')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(5900))
    expect(api.post).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(200))
    expect(api.post).toHaveBeenCalledWith('/api/flights/bulk-delete', { ids: [1, 2] }, expect.anything())
    expect(refresh).toHaveBeenCalled()
    expect(changed).toHaveBeenCalled()
    window.removeEventListener('kuuki:lifecycle-changed', changed)
  })

  it('Undo brings the rows back, focuses the first and sends nothing', async () => {
    vi.useFakeTimers()
    render(<Harness flights={[flight(1), flight(2)]} refresh={async () => {}} />)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Row 1')).toHaveFocus()
    expect(screen.getByText('Row 2')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(api.post).not.toHaveBeenCalled()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('a failed delete brings the rows back with an error', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockRejectedValue(new TypeError('offline'))
    render(<Harness flights={[flight(1), flight(2)]} refresh={async () => {}} />)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Delete' }))
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    expect(screen.getByText('Could not delete 2 flights. They are back in the list.')).toBeInTheDocument()
  })
})

describe('I flew and Did not fly', () => {
  const flights = [flight(1, { lifecycle_state: 'awaiting' }), flight(2, { lifecycle_state: 'awaiting' }), flight(3, { lifecycle_state: 'upcoming' }), flight(4, { lifecycle_state: 'upcoming' }), flight(5)]
  const queue = { awaitingFlights: [1, 2].map(id => ({ flight: { id }, candidateToken: `t${id}` })), awaitingFlightCount: 2 } as unknown as AwaitingQueue

  it('confirms only the awaiting flights and counts the skipped ones', async () => {
    vi.mocked(api.post).mockImplementation(async (_path, body) => ({ results: (body as { items: Array<{ flightId: number }> }).items.map(item => ({ flightId: item.flightId })), derivedState: 'ready', revision: 3, newlyStampedCountries: [], pendingCountryCount: 0 }))
    const refresh = vi.fn(async () => {})
    render(<Harness flights={flights} queue={queue} refresh={refresh} />)
    const button = within(bar()).getByRole('button', { name: 'I flew (2)' })
    expect(screen.getByText('Skipped: 2 upcoming, 1 already flown.')).toBeInTheDocument()
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByText('Skipped: 2 upcoming, 1 already flown.').id)
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('Confirmed 2 flights.')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.post).mock.calls[0]![0]).toBe('/api/flights/confirm')
    expect((vi.mocked(api.post).mock.calls[0]![1] as { items: unknown[] }).items).toEqual([{ flightId: 1, candidateToken: 't1' }, { flightId: 2, candidateToken: 't2' }])
    expect(refresh).toHaveBeenCalled()
  })

  it('Did not fly is a deferred delete of the awaiting flights only', () => {
    vi.useFakeTimers()
    render(<Harness flights={flights} queue={queue} refresh={async () => {}} />)
    fireEvent.click(within(bar()).getByRole('button', { name: 'Did not fly, remove 2' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
    expect(screen.getByText('Row 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })

  it('is disabled with a visible reason when nothing is awaiting', () => {
    render(<Harness flights={[flight(3, { lifecycle_state: 'upcoming' }), flight(5)]} refresh={async () => {}} />)
    const reason = screen.getByText('None of the selected flights are waiting for confirmation.')
    for (const name of ['I flew', 'Did not fly']) {
      const button = within(bar()).getByRole('button', { name })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button.getAttribute('aria-describedby')).toContain(reason.id)
    }
  })
})

describe('Bar', () => {
  it('offline blocks every write and points at the offline note, but Export still works', () => {
    render(<Harness flights={[flight(1, { lifecycle_state: 'awaiting' }), flight(2)]} online={false} refresh={async () => {}} />)
    for (const name of ['Set aircraft', 'I flew (1)', 'Did not fly, remove 1', 'Delete']) {
      const button = within(bar()).getByRole('button', { name })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button.getAttribute('aria-describedby')).toContain('offline-note')
    }
    fireEvent.click(within(bar()).getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    const exportButton = within(bar()).getByRole('button', { name: 'Export CSV' })
    expect(exportButton).not.toHaveAttribute('aria-disabled')
    fireEvent.click(exportButton)
    expect(downloadCsv).toHaveBeenCalledTimes(1)
    const [name, csv] = vi.mocked(downloadCsv).mock.calls[0]!
    expect(name).toMatch(/^kuuki-flights-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv.trim().split('\r\n')).toHaveLength(3)
  })

  it('counts the selection, selects all matching and clears with Escape', () => {
    render(<Harness flights={[flight(1), flight(2), flight(3)]} ticked={[2]} refresh={async () => {}} />)
    expect(screen.getByRole('region', { name: 'Selection' })).toHaveTextContent('1 selected')
    fireEvent.click(within(bar()).getByRole('button', { name: 'Select all 3 matching' }))
    expect(screen.getByRole('region', { name: 'Selection' })).toHaveTextContent('3 selected')
    expect(within(bar()).queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument()
    fireEvent.keyDown(within(bar()).getByRole('button', { name: 'Clear' }), { key: 'Escape' })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.getByText('Row 1')).toHaveFocus()
  })
})
