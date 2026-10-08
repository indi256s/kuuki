// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, advanceAuthGeneration } from '@kuuki/client/apiClient'
import { JournalView } from './journal'
import type { JournalData } from '../../server/journal'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/journal' }))
vi.mock('next/link', async () => ({ default: (await import('../../test/next-link')).linkStandIn(() => {}) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('./journal-queue', () => ({ JournalQueue: () => null }))
vi.mock('../capture/flight-panels', () => ({ FlightDetailSheet: () => null }))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn(), delete: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

type Flight = JournalData['flights'][number]
const flight = (id: number, aircraft: string | null) => ({ id, date: `2025-04-0${id - 4}`, lifecycle_state: 'logged', origin: 'TBS', destination: 'IST', aircraft_icao: aircraft, duration_minutes: null, flight_number: null, distance_km: null, departure_utc: null, arrival_utc: null, airline_iata: null }) as unknown as Flight
const dataFor = (flights: Flight[]): JournalData => ({ flights, total: flights.length, revision: 0, publishedRevision: 0, derivedState: 'ready', updatedAt: Date.now() })
let rows: Flight[]
const mount = (query = '') => render(<JournalView ownerId="interaction-owner" locale="en" query={query} page={1} filtered={!!query} initial={dataFor(rows)} />)
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const row = (id: number) => document.querySelector<HTMLElement>(`[data-flight-row="${id}"]`)!
const field = () => screen.findByRole('combobox', { name: 'Aircraft' })
const addAircraft = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getAllByRole('button', { name: /^Add aircraft/ })[0]); const input = await field(); await waitFor(() => expect(input).toHaveFocus()); return input }

beforeEach(() => {
  rows = [flight(7, null), flight(8, 'B738')]
  nav.push.mockReset(); nav.replace.mockReset(); nav.refresh.mockReset()
  vi.mocked(api.get).mockReset().mockImplementation((async (path: string) => { if (path === '/api/flights') return dataFor(rows); throw new Error(`unstubbed GET ${path}`) }) as typeof api.get)
  vi.mocked(api.delete).mockReset().mockResolvedValue({ derived_state: 'ready' })
  vi.mocked(api.post).mockReset().mockResolvedValue({ derived_state: 'ready' })
  vi.mocked(api.patch).mockReset()
})
afterEach(() => { vi.restoreAllMocks() })

describe('inline aircraft edit', () => {
  it('sends nothing for an untouched Enter, Escape or blur, and keeps the draft when focus leaves', async () => {
    const user = userEvent.setup()
    mount()
    await addAircraft(user)
    await user.keyboard('{Enter}') // nothing was typed: the highlighted suggestion is not picked and nothing is sent
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Aircraft' })).toBeNull())
    expect(screen.getAllByRole('button', { name: /^Add aircraft/ })[0]).toHaveFocus()

    const input = await addAircraft(user)
    await user.keyboard('B738{Enter}') // chooses the suggestion; still not saved
    await user.click(document.body) // blur
    expect(input).toHaveValue('B738')
    expect(api.patch).not.toHaveBeenCalled()

    input.focus()
    await user.keyboard('{Escape}{Escape}')
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Aircraft' })).toBeNull())
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('saves once on the second Enter, shows nothing as saved until the answer, then reconciles and returns focus', async () => {
    const user = userEvent.setup()
    const write = deferred<object>()
    vi.mocked(api.patch).mockReturnValue(write.promise as never)
    mount()
    await addAircraft(user)
    await user.keyboard('B738{Enter}{Enter}')
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    await user.keyboard('{Enter}') // a repeat while the request is out is ignored
    expect(api.patch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.patch).mock.calls[0][0]).toBe('/api/flights/7')
    expect(vi.mocked(api.patch).mock.calls[0][1]).toMatchObject({ aircraft_icao: 'B738' })
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Change aircraft B738, TBS to IST, April\s3/ })).toBeNull() // not claimed before the answer

    rows = [flight(7, 'B738'), flight(8, 'B738')]
    await act(async () => { write.resolve({ id: 7, aircraft_icao: 'B738', derived_state: 'ready' }) })
    const trigger = await screen.findByRole('button', { name: /^Change aircraft B738, TBS to IST, April\s3/ })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('keeps the draft and says why on rejection, and calls an unreadable answer unknown instead of failed', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockRejectedValueOnce(new ApiError(400, 'bad', 'UNKNOWN_AIRCRAFT'))
    mount()
    await addAircraft(user)
    await user.keyboard('B738{Enter}{Enter}')
    expect(await screen.findByText('Choose an aircraft from the list or leave it empty.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Aircraft' })).toHaveValue('B738')

    const reads = vi.mocked(api.get).mock.calls.length
    vi.mocked(api.patch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.keyboard('{Enter}') // a plain Enter retries the retained draft
    expect(await screen.findByText(/may or may not be saved/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Aircraft' })).toHaveValue('B738')
    expect(api.patch).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(reads)) // the canonical list is re-read
  })

  it.each([{}, { id: 8, aircraft_icao: 'B738' }, { id: 7, aircraft_icao: null }, { id: 7, aircraft_icao: 'A320' }])('keeps the draft and refetches when a 2xx aircraft receipt is unproven: %j', async receipt => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockResolvedValue(receipt)
    mount()
    await addAircraft(user)
    const reads = vi.mocked(api.get).mock.calls.length
    await user.keyboard('B738{Enter}{Enter}')
    expect(await screen.findByText(/may or may not be saved/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Aircraft' })).toHaveValue('B738')
    expect(screen.getByRole('button', { name: 'All details' })).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(reads))
  })

  it('does not write an old row when identity changes while the write module is being admitted', async () => {
    const user = userEvent.setup()
    mount()
    await addAircraft(user)
    await user.keyboard('B738{Enter}')
    fireEvent.click(screen.getByRole('button', { name: 'Save aircraft' }))
    advanceAuthGeneration()
    expect(await screen.findByText('Your session changed. Reopen the Journal before editing.')).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Aircraft' })).toHaveValue('B738')
  })

  it('restores the saved trigger when disabling the focused input moved native focus to body', async () => {
    const user = userEvent.setup(), write = deferred<object>()
    vi.mocked(api.patch).mockReturnValue(write.promise as never)
    mount()
    const input = await addAircraft(user)
    await user.keyboard('B738{Enter}{Enter}')
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    expect(input).toBeDisabled()
    document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex') // jsdom cannot blur disabled inputs.
    expect(document.body).toHaveFocus()
    rows = [flight(7, 'B738'), flight(8, 'B738')]
    await act(async () => { write.resolve({ id: 7, aircraft_icao: 'B738', derived_state: 'ready' }) })
    await waitFor(() => expect(screen.getByRole('button', { name: /^Change aircraft B738, TBS to IST, April\s3/ })).toHaveFocus())
  })

  it('closes an unknown draft after canonical reconciliation without taking focus from another row', async () => {
    const user = userEvent.setup(), read = deferred<JournalData>()
    vi.mocked(api.patch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mount()
    await addAircraft(user)
    vi.mocked(api.get).mockReturnValueOnce(read.promise as never)
    await user.keyboard('B738{Enter}{Enter}')
    expect(await screen.findByText(/may or may not be saved/)).toBeInTheDocument()
    const other = row(8)
    other.focus()
    rows = [flight(7, 'B738'), flight(8, 'B738')]
    await act(async () => { read.resolve(dataFor(rows)) })
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Aircraft' })).toBeNull())
    expect(other).toHaveFocus()
  })

  it.each(['edited row', 'native focus loss', 'elsewhere'] as const)('a filtered saved row disappearing restores focus only from the edited row: %s', async focus => {
    const user = userEvent.setup(), write = deferred<object>()
    rows = [flight(7, 'B738'), flight(8, 'B738')]
    vi.mocked(api.patch).mockReturnValue(write.promise as never)
    mount('aircraft=B738')
    await user.click(screen.getAllByRole('button', { name: /^Change aircraft B738/ })[0])
    const input = await field()
    await user.clear(input)
    await user.type(input, 'A320{Enter}')
    if (focus === 'native focus loss') await user.keyboard('{Enter}')
    else await user.click(screen.getByRole('button', { name: 'Save aircraft' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    const other = row(8)
    if (focus === 'elsewhere') other.focus()
    else if (focus === 'native focus loss') { document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex'); expect(document.body).toHaveFocus() }
    rows = [flight(8, 'B738')]
    await act(async () => { write.resolve({ id: 7, aircraft_icao: 'A320', derived_state: 'ready' }) })
    await waitFor(() => expect(row(7)).toBeNull())
    await waitFor(() => expect(focus !== 'elsewhere' ? screen.getByRole('heading', { name: 'Flights', level: 2 }) : other).toHaveFocus())
  })

})

describe('row actions menu and single delete question', () => {
  it('opens on right-click and Shift+F10 without opening or selecting the row, and offers the visible controls\' actions', async () => {
    const user = userEvent.setup()
    mount()
    fireEvent.contextMenu(row(7))
    expect(await screen.findByRole('menuitem', { name: 'Open flight' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Edit flight' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete flight' })).not.toHaveAttribute('aria-disabled', 'true')
    expect(nav.push).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox', { hidden: true }).some(box => (box as HTMLInputElement).checked)).toBe(false)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(row(7)).toHaveFocus())

    await user.keyboard('{Shift>}{F10}{/Shift}')
    await user.click(await screen.findByRole('menuitem', { name: 'Edit flight' }))
    expect(nav.push).toHaveBeenCalledWith('/journal?flight=7', { scroll: false })
  })

  it('asks in place, hands the answer to the one deferred delete, and disables a second deletion while it waits', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getAllByRole('button', { name: /^Actions: / })[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete flight' }))
    const question = await screen.findByRole('group', { name: /^Delete TBS to IST/ })
    await waitFor(() => expect(within(question).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(question).toHaveTextContent('You can undo for six seconds')
    expect(api.delete).not.toHaveBeenCalled()

    await user.click(within(question).getByRole('button', { name: 'Delete flight' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus())
    expect(row(7)).toBeNull() // hidden while pending
    expect(api.delete).not.toHaveBeenCalled() // nothing is sent inside the Undo window

    await user.click(screen.getAllByRole('button', { name: /^Actions: / })[0])
    expect(await screen.findByRole('menuitem', { name: 'Delete flight' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Another deletion is still waiting/)).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(row(7)).toHaveFocus())
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('cancels the question with Escape and puts focus back on the row', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getAllByRole('button', { name: /^Actions: / })[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete flight' }))
    await screen.findByRole('group', { name: /^Delete TBS to IST/ })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Delete TBS to IST/ })).toBeNull())
    expect(row(7)).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})

it('keeps the inline editor and full-details escape hatch mounted after a failed chunk, then retries locally', async () => {
  const user = userEvent.setup()
  vi.doMock('./journal-aircraft', () => { throw new Error('chunk unavailable') })
  try {
    mount()
    await user.click(screen.getByRole('button', { name: /^Change aircraft B738/ }))
    expect(await screen.findByText('Could not load the aircraft editor.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All details' })).toBeInTheDocument()
    expect(row(7)).toBeInTheDocument()
    vi.doMock('./journal-aircraft', () => ({
      AircraftField: (props: import('../ui/inline-edit').InlineEditFieldProps) => <input aria-label="Aircraft" ref={props.inputRef} value={props.value} onChange={event => props.onChange(event.target.value)} />,
    }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    const input = await within(screen.getByRole('group', { name: 'Aircraft' })).findByRole('textbox', { name: 'Aircraft' })
    expect(input).toHaveValue('B738')
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.queryByText('Could not load the aircraft editor.')).toBeNull()
    expect(api.patch).not.toHaveBeenCalled()
  } finally { vi.doUnmock('./journal-aircraft') }
})
