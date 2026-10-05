// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { startTransition, Suspense, use, useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JournalView } from './journal'
import { PrimaryNav } from '../nav'
import { QueueSummarySlot } from '../queue-summary'
import { announceJournalLink } from '../journal-links'
import { Sheet } from '../ui/sheet'
import { normalizeJournalQuery } from '../../lib/url-state'
import type { JournalData } from '../../server/journal'
import { api } from '../../../../web/src/lib/apiClient'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), set: vi.fn<(query: string | Promise<string>) => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/journal' }))
// The real Link needs a mounted App Router; the stand-in follows its click contract and navigates through the mocked router.
vi.mock('next/link', async () => ({ default: (await import('../../test/next-link')).linkStandIn((href, { replace }) => nav[replace ? 'replace' : 'push'](href)) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('./journal-queue', () => ({
  JournalQueue: ({ hiddenIds, onDelete }: { hiddenIds: number[]; onDelete: (ids: number[], ) => void }) => hiddenIds.includes(1) ? null : <div><button data-confirm-flight="1">Confirm arrival</button><button onClick={() => onDelete([1])}>Did not fly</button></div>,
}))
vi.mock('../capture/flight-panels', () => ({
  FlightDetailSheet: ({ flightId, initialEditing, focusField, onOpenChange, onDelete, onCloseAutoFocus }: { flightId: number; initialEditing?: boolean; focusField?: string; onOpenChange: (open: boolean) => void; onDelete: (id: number) => void; onCloseAutoFocus: (event: Event) => void }) =>
    <Sheet open onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus} title={`Flight ${flightId}`} closeLabel="Close flight">
      <output data-testid="detail">{`editing:${String(!!initialEditing)} field:${focusField ?? 'none'}`}</output>
      <button onClick={() => { onDelete(flightId); onOpenChange(false) }}>Delete in sheet</button>
    </Sheet>,
}))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: vi.fn(), delete: vi.fn(), post: vi.fn() } }))

type Row = { id: number; date: string; lifecycle_state: string; origin?: string; destination?: string; aircraft_icao?: string | null; duration_minutes?: number | null; flight_number?: string | null; distance_km?: number | null }
type Flight = JournalData['flights'][number]
const flight = (row: Row) => ({ origin: 'TBS', destination: 'IST', aircraft_icao: 'B738', duration_minutes: null, flight_number: null, distance_km: null, departure_utc: null, arrival_utc: null, airline_iata: null, ...row }) as Flight
const logged = [1, 2, 3].map(id => flight({ id, date: `2025-04-0${id}`, lifecycle_state: 'logged' }))
const initialFor = (flights: Flight[], total = flights.length): JournalData => ({ flights, total, revision: 0, publishedRevision: 0, derivedState: 'ready', updatedAt: Date.now() })

function Harness({ start = '', flights = logged, total, locale = 'en' }: { start?: string; flights?: Flight[]; total?: number; locale?: 'en' | 'ru' }) {
  const [route, setQuery] = useState<string | Promise<string>>(start)
  const query = typeof route === 'string' ? route : use(route)
  useEffect(() => { nav.set.mockImplementation(setQuery) }, [])
  const state = normalizeJournalQuery(new URLSearchParams(query))
  const filtered = ['q', 'year', 'status', 'airline', 'aircraft', 'airport', 'origin', 'destination'].some(key => key in state.state)
  return <JournalView ownerId="journal-owner" locale={locale} query={query} page={Number(state.state.page ?? 1)} filtered={filtered} initial={initialFor(flights, total)} />
}
const hrefQuery = (href: string) => new URL(href, 'http://kuuki.test').search.slice(1)

beforeEach(() => {
  nav.push.mockReset().mockImplementation((href: string) => { act(() => nav.set(hrefQuery(href))) })
  nav.replace.mockReset().mockImplementation((href: string) => { act(() => nav.set(hrefQuery(href))) })
  nav.refresh.mockReset()
  nav.set.mockReset()
  // `/api/flights` returns the full Journal contract in one response; every other endpoint this view may call is stubbed explicitly.
  vi.mocked(api.get).mockReset().mockImplementation((async (path: string) => {
    if (path === '/api/flights') return initialFor(logged, 3)
    if (path === '/api/flights/ids') return { ids: logged.map(row => row.id) }
    throw new Error(`unstubbed GET ${path}`)
  }) as typeof api.get)
  vi.mocked(api.delete).mockReset().mockResolvedValue({ derived_state: 'ready' })
  vi.mocked(api.post).mockReset().mockResolvedValue({ derived_state: 'ready' })
})
afterEach(async () => { await act(async () => { waiting.splice(0).forEach(resolve => resolve()) }); vi.useRealTimers(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

it('refetches derived readiness with one /api/flights request, even with equal revisions', async () => {
  // `/api/flights` carries the shared Journal contract, including the current derived state, so no separate derived-state read is made.
  vi.mocked(api.get).mockImplementation((async (path: string) => {
    if (path === '/api/flights') return { ...initialFor([]), revision: 4, publishedRevision: 4, derivedState: 'pending' }
    throw new Error(`unstubbed GET ${path}`)
  }) as typeof api.get)
  render(<JournalView ownerId="journal-owner" locale="en" query="" page={1} filtered={false} initial={{ ...initialFor([]), revision: 4, publishedRevision: 4 }} />)
  expect(screen.queryByText('Recent changes are still being prepared.')).not.toBeInTheDocument()
  expect(api.get).not.toHaveBeenCalled()
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await screen.findByText('Recent changes are still being prepared.')
  expect(vi.mocked(api.get).mock.calls.map(call => call[0])).toEqual(['/api/flights'])
  expect(vi.mocked(api.get).mock.calls.some(call => String(call[0]).includes('derived-state'))).toBe(false)
})

it('groups upcoming flights first, then awaiting and logged history by year', () => {
  const flights = [flight({ id: 1, date: '2025-01-01', lifecycle_state: 'logged' }), flight({ id: 2, date: '2026-10-03', lifecycle_state: 'awaiting' }), flight({ id: 3, date: '2026-12-01', lifecycle_state: 'upcoming' })]
  render(<JournalView ownerId="group-owner" locale="en" query="" page={1} filtered={false} initial={initialFor(flights)} />)
  expect(within(screen.getByTestId('journal-data')).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Upcoming', '2025 · Logged', '2026 · Awaiting'])
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
})

// A router whose navigations stay pending (as in Next, where the transition lasts until the page commits) until `deliver(..., true)` settles them.
// Navigations a slow router still holds; settled after each test so a failed assertion cannot leave a transition that blocks the next test.
const waiting: Array<() => void> = []
function slowRouter() {
  const impl = () => new Promise<void>(resolve => { waiting.push(resolve) })
  nav.push.mockReset().mockImplementation(impl)
  nav.replace.mockReset().mockImplementation(impl)
  return {
    /** The URL changes; with `settle` every pending navigation also completes. */
    deliver: async (query: string, settle: boolean) => { await act(async () => { nav.set(query); if (settle) waiting.splice(0).forEach(resolve => resolve()) }) },
    /** A URL change nobody here requested (Back, a link, Reset). */
    external: async (query: string) => { await act(async () => { nav.set(query) }) },
  }
}

// Installed Next push/replace return void and suspend router state inside a nested transition.
// Only the newest destination is delivered; superseded responses can remain unresolved until cleanup.
function voidRouter() {
  let deliverLatest: () => void
  let resolveLatest: (query: string) => void
  const impl = (href: string) => {
    const query = hrefQuery(href)
    const response = new Promise<string>(resolve => { resolveLatest = resolve; deliverLatest = () => resolve(query); waiting.push(deliverLatest) })
    startTransition(() => nav.set(response))
  }
  nav.push.mockReset().mockImplementation(impl)
  nav.replace.mockReset().mockImplementation(impl)
  return {
    deliver: async () => { await act(async () => deliverLatest()) },
    /** A handled navigation failure: Next returns the router state it already had, so the transition ends on `query`, the URL still rendered. */
    fail: async (query: string) => { await act(async () => resolveLatest(query)) },
  }
}

describe('filters', () => {
  it('keeps the Status select (same element, still focused) after a keyboard change', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const status = screen.getByRole('combobox', { name: 'Status' })
    status.focus()
    await user.selectOptions(status, 'logged')
    expect(nav.push).toHaveBeenCalledWith('/journal?status=logged', { scroll: false })
    expect(screen.getByRole('combobox', { name: 'Status' })).toBe(status)
    expect(status).toHaveFocus()
  })

  it('does not navigate, reset the page or clear the selection when nothing changed', async () => {
    const user = userEvent.setup()
    render(<Harness start="airline=TK&page=3" total={45} />)
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
    await user.click(screen.getByRole('textbox', { name: 'Year' }))
    for (let index = 0; index < 9; index += 1) await user.tab()
    expect(nav.push).not.toHaveBeenCalled()
    expect(nav.replace).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })

  it('keeps text typed in the next field when the previous field commits and the URL changes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    const aircraft = screen.getByRole('textbox', { name: 'Aircraft' })
    await user.type(airline, 'tk')
    await user.tab()
    await user.keyboard('b7')
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('/journal?airline=TK', { scroll: false })
    expect(screen.getByRole('textbox', { name: 'Aircraft' })).toBe(aircraft)
    expect(aircraft).toHaveValue('b7')
    expect(aircraft).toHaveFocus()
    expect(airline).toHaveValue('TK')
  })

  it('commits a field with Enter and keeps focus in it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'tk{Enter}')
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('/journal?airline=TK', { scroll: false })
    expect(airline).toHaveFocus()
    expect(airline).toHaveValue('TK')
  })

  it('searches with Enter and with the Search button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('searchbox'), 'Istanbul{Enter}')
    expect(nav.push).toHaveBeenLastCalledWith('/journal?q=Istanbul', { scroll: false })
  })

  it('flags values the URL contract would drop instead of silently ignoring them', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const airport = screen.getByRole('textbox', { name: 'Airport' })
    await user.type(airport, 'X1')
    await user.tab()
    expect(airport).toHaveAttribute('aria-invalid', 'true')
    const message = screen.getByText('Enter a 3-letter airport code, for example IST.')
    expect(airport.getAttribute('aria-describedby')).toBe(message.id)
    expect(nav.push).not.toHaveBeenCalled()
    await user.clear(airport)
    await user.type(airport, 'ist')
    await user.tab()
    expect(airport).not.toHaveAttribute('aria-invalid')
    expect(nav.push).toHaveBeenCalledWith('/journal?airport=IST', { scroll: false })
  })

  it('refuses an invalid year on Enter, focuses it and explains the range', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const year = screen.getByRole('textbox', { name: 'Year' })
    await user.type(year, '1800{Enter}')
    expect(nav.push).not.toHaveBeenCalled()
    expect(year).toHaveFocus()
    expect(year).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/^Enter a year from 1900 to \d{4}/)).toBeInTheDocument()
  })

  it('replaces the history entry for a same-field refinement and pushes the first value', async () => {
    const user = userEvent.setup()
    render(<Harness start="airline=TK" />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'Y')
    await user.tab()
    expect(nav.replace).toHaveBeenCalledWith('/journal?airline=TKY', { scroll: false })
    expect(nav.push).not.toHaveBeenCalled()
    await user.type(screen.getByRole('textbox', { name: 'Airport' }), 'ist')
    await user.tab()
    expect(nav.push).toHaveBeenCalledWith('/journal?airline=TKY&airport=IST', { scroll: false })
  })

  it('builds on the last requested URL while the previous navigation has not arrived yet', async () => {
    const user = userEvent.setup()
    const router = slowRouter() // the server round trip has not answered yet, so the navigation transition stays pending
    render(<Harness />)
    await user.type(screen.getByRole('textbox', { name: 'Airline' }), 'tk')
    await user.tab()
    await user.keyboard('b738')
    await user.tab()
    expect(nav.push).toHaveBeenCalledTimes(2)
    expect(hrefQuery(nav.push.mock.calls[0][0])).toBe('airline=TK')
    expect(hrefQuery(nav.push.mock.calls[1][0])).toBe('airline=TK&aircraft=B738')
    await router.deliver('airline=TK&aircraft=B738', true)
  })

  it('keeps a field cleared after a commit that has not been answered yet, and sends the clearing next', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'tk')
    await user.tab()
    expect(hrefQuery(nav.push.mock.calls[0][0])).toBe('airline=TK')
    await user.clear(airline)
    await user.tab()
    // The clearing is compared with what was just sent, not with the URL that has not caught up.
    expect(nav.push.mock.calls.length + nav.replace.mock.calls.length).toBe(2)
    expect(hrefQuery([...nav.push.mock.calls, ...nav.replace.mock.calls].at(-1)![0])).toBe('')
    await router.deliver('airline=TK', false) // the intermediate response; navigation still pending
    expect(airline).toHaveValue('')
    await router.deliver('', true)
    expect(airline).toHaveValue('')
  })

  it('keeps the aircraft draft when the response to the earlier airline commit arrives first', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness />)
    await user.type(screen.getByRole('textbox', { name: 'Airline' }), 'tk')
    await user.tab()
    await user.keyboard('b738')
    await user.tab()
    expect(nav.push).toHaveBeenCalledTimes(2)
    await router.deliver('airline=TK', false) // answers the first commit only
    expect(screen.getByRole('textbox', { name: 'Aircraft' })).toHaveValue('B738')
    expect(screen.getByRole('textbox', { name: 'Airline' })).toHaveValue('TK')
    await router.deliver('airline=TK&aircraft=B738', true)
    expect(screen.getByRole('textbox', { name: 'Aircraft' })).toHaveValue('B738')
  })

  it('adopts Back to a value this component had sent and cleared, once its navigations have settled', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'tk')
    await user.tab()
    await user.clear(airline)
    await user.tab()
    await router.deliver('', true) // only the final, empty URL arrives: the query never changed
    expect(airline).toHaveValue('')
    await router.external('airline=TK') // Back or a link
    expect(airline).toHaveValue('TK')
  })

  it('adopts Reset after repeated commits of the same value, and Search then sends the reset state', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'tk')
    await user.tab()
    await user.clear(airline)
    await user.tab()
    await user.type(airline, 'tk')
    await user.tab()
    expect(nav.push).toHaveBeenCalledTimes(3)
    await router.deliver('airline=TK', true) // only the final URL arrives
    expect(airline).toHaveValue('TK')
    await router.external('') // Reset
    expect(airline).toHaveValue('')
    nav.push.mockClear()
    await user.type(screen.getByRole('searchbox'), 'x{Enter}')
    expect(hrefQuery(nav.push.mock.calls.at(-1)![0])).toBe('q=x')
    await router.deliver('q=x', true)
  })

  it('adopts Reset clicked while its own filter navigation is pending, and Search then keeps the reset state', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness start="airline=TK" />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.clear(airline)
    await user.type(airline, 'aa')
    await user.tab()
    expect(hrefQuery([...nav.push.mock.calls, ...nav.replace.mock.calls].at(-1)![0])).toBe('airline=AA') // not answered yet
    await user.click(screen.getByRole('link', { name: 'Reset filters' }))
    await router.deliver('', true) // Reset supersedes the pending navigation; only its URL arrives
    expect(airline).toHaveValue('')
    nav.push.mockClear(); nav.replace.mockClear()
    await user.type(screen.getByRole('searchbox'), 'x{Enter}')
    expect([...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))).toEqual(['q=x'])
    await router.deliver('q=x', true)
  })

  it('keeps desktop and untouched mobile filters after a pending Reset is superseded by the rendered query', async () => {
    const user = userEvent.setup()
    const router = voidRouter()
    render(<Suspense fallback={null}><Harness start="airline=TK" /></Suspense>)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.clear(airline)
    await user.type(airline, 'aa')
    await act(async () => { await user.tab() })
    await act(async () => { await user.click(screen.getByRole('link', { name: 'Reset filters' })) }) // pending too
    expect(airline).toHaveValue('')
    await user.type(airline, 'tk')
    await act(async () => { await user.tab() }) // before Reset returns
    const sent = [...nav.push.mock.calls.map((call, index) => [nav.push.mock.invocationCallOrder[index], call[0]] as const), ...nav.replace.mock.calls.map((call, index) => [nav.replace.mock.invocationCallOrder[index], call[0]] as const)]
    expect(sent.sort(([a], [b]) => a - b).map(([, href]) => hrefQuery(href))).toEqual(['airline=AA', '', 'airline=TK'])
    await router.deliver() // only the TK commit arrives; superseded AA and Reset stay unresolved
    expect(airline).toHaveValue('TK')
    nav.push.mockClear(); nav.replace.mockClear()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'Airline' })).toHaveValue('TK')
    await user.click(within(dialog).getByRole('button', { name: 'Apply filters' }))
    expect(airline).toHaveValue('TK')
    expect(nav.push).not.toHaveBeenCalled()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('shows the selects of a pending Reset destination, so a status equal to the superseded URL can be chosen again', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness start="status=logged&airline=TK" />)
    await user.click(screen.getByRole('link', { name: 'Reset filters' }))
    const status = screen.getByRole('combobox', { name: 'Status' })
    expect(status).toHaveValue('')
    nav.push.mockClear(); nav.replace.mockClear()
    await user.selectOptions(status, 'logged')
    expect([...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))).toEqual(['status=logged'])
    await router.deliver('status=logged', true)
    expect(status).toHaveValue('logged')
  })

  it('restores the same-query Status after it supersedes a pending Reset', async () => {
    const user = userEvent.setup()
    const router = voidRouter()
    render(<Suspense fallback={null}><Harness start="status=logged" /></Suspense>)
    await act(async () => { await user.click(screen.getByRole('link', { name: 'Reset filters' })) })
    const status = screen.getByRole('combobox', { name: 'Status' })
    expect(status).toHaveValue('')
    await act(async () => { await user.selectOptions(status, 'logged') })
    expect(nav.push.mock.calls.map(call => hrefQuery(call[0]))).toEqual(['', 'status=logged'])
    await router.deliver()
    expect(status).toHaveValue('logged')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('logged')
    await user.click(within(dialog).getByRole('button', { name: 'Apply filters' }))
    expect(status).toHaveValue('logged')
    expect(nav.push).toHaveBeenCalledTimes(2)
  })

  it('adopts the first-page link that supersedes a pending filter, and Search keeps its destination', async () => {
    const user = userEvent.setup()
    const router = voidRouter()
    render(<Suspense fallback={null}><Harness start="page=2" flights={[]} total={3} /></Suspense>)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'aa')
    await act(async () => { await user.tab() })
    expect(hrefQuery(nav.push.mock.calls.at(-1)![0])).toBe('airline=AA')
    await act(async () => { await user.click(screen.getByRole('link', { name: 'Back to the first page' })) })
    await router.deliver()
    expect(airline).toHaveValue('')
    nav.push.mockClear(); nav.replace.mockClear()
    await act(async () => { await user.type(screen.getByRole('searchbox'), 'x{Enter}') })
    expect([...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))).toEqual(['q=x'])
    await router.deliver()
  })

  it('adopts the empty-result Reset clicked while its own filter navigation is pending', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness start="airline=ZZ" flights={[]} total={0} />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.clear(airline)
    await user.type(airline, 'aa')
    await user.tab()
    const [, emptyReset] = screen.getAllByRole('link', { name: 'Reset filters' })
    expect(emptyReset).toHaveClass('button')
    await user.click(emptyReset)
    await router.deliver('', true)
    expect(airline).toHaveValue('')
  })

  it('navigates again when the same Search is pressed after a handled navigation failure left the rendered query unchanged', async () => {
    const user = userEvent.setup()
    const router = voidRouter()
    render(<Suspense fallback={null}><Harness /></Suspense>)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'tk')
    await act(async () => { await user.tab() })
    const sent = () => [...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))
    expect(sent()).toEqual(['airline=TK'])
    await router.fail('') // Next catches the failure and keeps the router state: the query is still empty
    expect(airline).toHaveValue('TK')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(sent()).toEqual(['airline=TK', 'airline=TK'])
    await router.deliver()
    expect(airline).toHaveValue('TK')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Airline' })).toHaveValue('TK')
  })

  it('adopts Back taken while its own filter navigation is pending, even to the URL that is still rendered', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    window.history.replaceState(null, '', '/journal')
    render(<Harness />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.type(airline, 'aa')
    await user.tab()
    expect(hrefQuery(nav.push.mock.calls.at(-1)![0])).toBe('airline=AA') // not answered yet
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) }) // Back: the browser is already on /journal
    await router.deliver('', true) // the rendered URL does not change
    expect(airline).toHaveValue('')
    nav.push.mockClear(); nav.replace.mockClear()
    await user.type(screen.getByRole('searchbox'), 'x{Enter}')
    expect([...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))).toEqual(['q=x'])
    await router.deliver('q=x', true)
  })

  it('adopts Forward to another filter taken while its own filter navigation is pending', async () => {
    const user = userEvent.setup()
    const router = slowRouter()
    render(<Harness start="airline=TK" />)
    const airline = screen.getByRole('textbox', { name: 'Airline' })
    await user.clear(airline)
    await user.type(airline, 'aa')
    await user.tab()
    window.history.replaceState(null, '', '/journal?airline=LH')
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
    await router.deliver('airline=LH', true)
    expect(airline).toHaveValue('LH')
  })

  describe('shell links to /journal while its own filter navigation is pending', () => {
    const searchAfter = async (user: ReturnType<typeof userEvent.setup>) => {
      nav.push.mockClear(); nav.replace.mockClear()
      await user.type(screen.getByRole('searchbox'), 'x{Enter}')
      return [...nav.push.mock.calls, ...nav.replace.mock.calls].map(call => hrefQuery(call[0]))
    }
    const commitAirline = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
      const airline = screen.getByRole('textbox', { name: 'Airline' })
      await user.clear(airline)
      await user.type(airline, value)
      await user.tab()
      return airline
    }

    it('adopts the Journal tab to the unchanged /journal', async () => {
      const user = userEvent.setup()
      const router = slowRouter()
      render(<><PrimaryNav /><Harness /></>)
      const airline = await commitAirline(user, 'aa')
      expect(hrefQuery(nav.push.mock.calls.at(-1)![0])).toBe('airline=AA') // not answered yet
      await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: /^Journal/ }))
      await router.deliver('', true) // the rendered URL does not change
      expect(airline).toHaveValue('')
      expect(await searchAfter(user)).toEqual(['q=x'])
      await router.deliver('q=x', true)
    })

    it('adopts the queue link to a different destination', async () => {
      const user = userEvent.setup()
      const router = slowRouter()
      render(<><QueueSummarySlot count={2} /><Harness start="airline=TK" /></>)
      const airline = await commitAirline(user, 'aa')
      await user.click(screen.getByRole('link', { name: '2 awaiting action' }))
      await router.deliver('queue=awaiting', true)
      expect(airline).toHaveValue('')
      expect(await searchAfter(user)).toEqual(['q=x&queue=awaiting'])
      await router.deliver('q=x&queue=awaiting', true)
    })

    it('adopts an announced filtered destination (airline=LH) before and after it arrives', async () => {
      const user = userEvent.setup()
      const router = slowRouter()
      render(<Harness start="airline=TK" />)
      const airline = await commitAirline(user, 'aa')
      act(() => announceJournalLink('/journal?airline=LH')!())
      expect(airline).toHaveValue('LH')
      await router.deliver('airline=LH', true)
      expect(airline).toHaveValue('LH')
      expect(await searchAfter(user)).toEqual(['q=x&airline=LH'])
      await router.deliver('q=x&airline=LH', true)
    })

    it('leaves the drafts alone for a modified click on the Journal tab, which opens another tab', async () => {
      const user = userEvent.setup()
      slowRouter()
      render(<><PrimaryNav /><Harness /></>)
      const airline = await commitAirline(user, 'aa')
      await user.keyboard('{Control>}')
      await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: /^Journal/ }))
      await user.keyboard('{/Control}')
      expect(airline).toHaveValue('AA')
      expect(nav.push).toHaveBeenCalledTimes(1)
    })
  })

  it('adopts an external URL change (Reset, Back) but not its own navigation', () => {
    render(<Harness start="airline=TK" />)
    expect(screen.getByRole('textbox', { name: 'Airline' })).toHaveValue('TK')
    act(() => nav.set(''))
    expect(screen.getByRole('textbox', { name: 'Airline' })).toHaveValue('')
  })

  it('stages mobile values on change and applies them in one navigation', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Airline' }), 'tk')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'logged')
    expect(nav.push).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Apply filters' }))
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(hrefQuery(nav.push.mock.calls[0][0])).toBe('status=logged&airline=TK')
  })
})

describe('mobile filters and Search', () => {
  it('keeps a filter applied on mobile when Search is submitted afterwards', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Airline' }), 'tk')
    await user.click(within(dialog).getByRole('button', { name: 'Apply filters' }))
    expect(hrefQuery(nav.push.mock.calls[0][0])).toBe('airline=TK')
    await user.type(screen.getByRole('searchbox'), 'Istanbul{Enter}')
    expect(hrefQuery(nav.push.mock.calls.at(-1)![0])).toBe('q=Istanbul&airline=TK')
    expect(screen.getAllByRole('textbox', { name: 'Airline' })[0]).toHaveValue('TK')
  })
})

describe('pending delete', () => {
  const select = async (user: ReturnType<typeof userEvent.setup>, count = 1) => {
    for (const box of screen.getAllByRole('checkbox').slice(0, count)) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Delete selected flights' }))
    return screen.getByRole('dialog')
  }
  const confirm = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => user.click(within(dialog).getByRole('button', { name: 'Delete selected flights' }))

  it('states the consequence with real plurals in the confirmation', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    expect(within(await select(user, 1)).getByText('1 selected flight will be deleted. You can undo it for six seconds.')).toBeInTheDocument()
    unmount()
    render(<Harness locale="ru" />)
    for (const box of screen.getAllByRole('checkbox').slice(0, 3)) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Удалить выбранные перелёты' }))
    expect(within(screen.getByRole('dialog')).getByText(/^Будут удалены 3 выбранных перелёта\./)).toBeInTheDocument()
  })

  it('shows one polite notice that says the flights are being deleted, and retires the selection bar', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await confirm(user, await select(user, 2))
    expect(screen.queryByRole('region', { name: 'Selection actions' })).not.toBeInTheDocument()
    const status = screen.getByText('2 flights are being deleted.')
    expect(status).toHaveAttribute('role', 'status')
    expect(status.textContent).not.toMatch(/\d\s*s\b/)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument()
  })

  it('says it in Russian with the right plural', async () => {
    const user = userEvent.setup()
    render(<Harness locale="ru" />)
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Удалить выбранные перелёты' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить выбранные перелёты' }))
    expect(screen.getByText('1 перелёт будет удалён.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument()
  })

  it('moves focus to Undo when the delete is scheduled, then to the restored row after Undo', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await confirm(user, await select(user, 1))
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()
    await user.click(undo)
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    const row = document.querySelector('[data-flight-row="1"]')
    expect(row).toBeTruthy()
    expect(row).toHaveFocus()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('"Did not fly" focuses Undo, and Undo returns focus to that card Confirm button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Did not fly' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Confirm arrival' })).toHaveFocus()
  })

  it('does not take focus when the server confirms while the user is somewhere else', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness />)
    await confirm(user, await select(user, 1))
    const search = screen.getByRole('searchbox')
    search.focus()
    await act(async () => { await vi.advanceTimersByTimeAsync(6500) })
    expect(api.delete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(search).toHaveFocus()
  })

  it('moves focus to the list heading when the request starts only if focus was resting on Undo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness />)
    await confirm(user, await select(user, 1))
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await act(async () => { await vi.advanceTimersByTimeAsync(6500) })
    expect(screen.getByRole('heading', { level: 2, name: 'Flights' })).toHaveFocus()
  })
})

describe('pending delete while the request is in flight', () => {
  it('moves focus to the list heading the moment Undo leaves, before the DELETE answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    let answer!: (ack: unknown) => void
    vi.mocked(api.delete).mockReset().mockReturnValue(new Promise(resolve => { answer = resolve }) as never)
    render(<Harness />)
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Delete selected flights' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete selected flights' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await act(async () => { await vi.advanceTimersByTimeAsync(6500) })
    expect(api.delete).toHaveBeenCalledTimes(1) // still unresolved
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'Flights' })).toHaveFocus()
    await act(async () => { answer({ derived_state: 'ready' }); await vi.advanceTimersByTimeAsync(50) })
    expect(screen.getByRole('heading', { level: 2, name: 'Flights' })).toHaveFocus()
  })

  it('does not move a user who is elsewhere when the request starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(api.delete).mockReset().mockReturnValue(new Promise(() => {}) as never)
    render(<Harness />)
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Delete selected flights' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete selected flights' }))
    const search = screen.getByRole('searchbox')
    search.focus()
    await act(async () => { await vi.advanceTimersByTimeAsync(6500) })
    expect(search).toHaveFocus()
  })
})

describe('detail sheet', () => {
  it('returns focus to the row that opened it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const row = document.querySelector<HTMLElement>('[data-flight-row="2"]')!
    await user.click(row)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close flight' }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('[data-flight-row="2"]')).toHaveFocus()
  })

  it('focuses Undo, not a hidden row, when the flight was deleted from the sheet', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(document.querySelector<HTMLElement>('[data-flight-row="2"]')!)
    await user.click(await screen.findByRole('button', { name: 'Delete in sheet' }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })

  it('opens "Add aircraft" in the editor with the aircraft field requested', async () => {
    const user = userEvent.setup()
    render(<Harness flights={[flight({ id: 7, date: '2025-04-03', lifecycle_state: 'logged', aircraft_icao: null })]} />)
    await user.click(screen.getByRole('button', { name: /^Add aircraft/ }))
    expect(await screen.findByTestId('detail')).toHaveTextContent('editing:true field:aircraft')
    expect(nav.push).toHaveBeenCalledWith('/journal?flight=7', { scroll: false })
  })
})

describe('list', () => {
  it('names rows and checkboxes from formatted values and shows real durations', () => {
    render(<Harness flights={[flight({ id: 1, date: '2025-04-03', lifecycle_state: 'logged', flight_number: 'TK123', duration_minutes: 25, distance_km: 1234 })]} />)
    const row = document.querySelector<HTMLElement>('[data-flight-row="1"]')!
    expect(row.getAttribute('aria-label')!.replaceAll('\u00a0', ' ')).toBe('TBS to IST, April 3, 2025, TK123, B738, 25 min, 1,234 km')
    const cells = row.closest('.flight-row')!
    expect(cells.textContent!.replaceAll('\u00a0', ' ')).toContain('25 min')
    expect(cells).not.toHaveTextContent('0 h')
    expect(screen.getByRole('checkbox', { name: 'Select: TBS to IST, April 3, 2025' })).toBeInTheDocument()
  })

  it.each([['en', 'Add aircraft, TBS to IST, April 3, 2025', 'Add aircraft, TBS to IST, April 2, 2025'], ['ru', 'Добавить самолёт, из TBS в IST, 3 апреля 2025 г.', 'Добавить самолёт, из TBS в IST, 2 апреля 2025 г.']] as const)('names each Add aircraft action after its flight (%s)', (locale, first, second) => {
    render(<Harness locale={locale} flights={[flight({ id: 7, date: '2025-04-03', lifecycle_state: 'logged', aircraft_icao: null }), flight({ id: 8, date: '2025-04-02', lifecycle_state: 'logged', aircraft_icao: null })]} />)
    const names = screen.getAllByRole('button', { name: /^(Add aircraft|Добавить самолёт)/ }).map(button => button.getAttribute('aria-label')!.replaceAll('\u00a0', ' '))
    expect(names).toEqual([first, second])
  })

  it('puts "Add aircraft" in the row\'s aircraft cell, not after the row and not inside the row button', () => {
    render(<Harness flights={[flight({ id: 7, date: '2025-04-03', lifecycle_state: 'logged', aircraft_icao: null }), flight({ id: 8, date: '2025-04-02', lifecycle_state: 'logged' })]} />)
    const missing = document.querySelector('[data-flight-row="7"]')!.closest('.flight-row')!
    const cell = missing.querySelector('.journal-aircraft-cell')!
    expect(cell).toContainElement(screen.getByRole('button', { name: /^Add aircraft/ }))
    expect(missing).toContainElement(cell as HTMLElement)
    expect(missing.querySelector('.flight-row-route')).toBeTruthy() // same row element as the other cells
    expect(document.querySelector('[data-flight-row="7"]')!.querySelector('button, a, input, select')).toBeNull()
    expect(missing.nextElementSibling).toBeNull() // nothing follows the row as a separate grid row
    const present = document.querySelector('[data-flight-row="8"]')!.closest('.flight-row')!
    expect(present.querySelector('.journal-aircraft-cell')).toHaveTextContent('B738')
    expect(present.querySelector('.journal-aircraft-cell button')).toBeNull()
  })

  it('aligns the six desktop cells, including the aircraft action cell, on one baseline without making the overlay a grid item', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/reads.css'), 'utf8')
    expect(css).toMatch(/\.journal-entry \.flight-row\{align-items:baseline\}/)
    expect(css).toMatch(/\.flight-row>\.flight-row-open\{position:absolute;inset:0/) // out of the grid flow, so it takes no cell and no baseline
  })

  it('declares the mobile card order route, date, distance, flight number and a control-border checkbox outline', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/reads.css'), 'utf8')
    const mobile = css.slice(css.indexOf('@media(max-width:700px){.journal-entry'))
    const place = (cell: string) => mobile.match(new RegExp(`\\.journal-entry \\.flight-row>\\.${cell}\\{grid-column:(\\d);grid-row:(\\d)`))!.slice(1).join('/')
    expect(['flight-row-route', 'flight-row-date', 'flight-row-distance', 'flight-row-number'].map(place)).toEqual(['1/1', '2/1', '1/2', '2/2'])
    expect(css).toMatch(/\.journal-data input\[type=checkbox\]\{[^}]*outline:1px solid var\(--control-border\)/)
  })

  it('renders the upcoming group in the order the server returned it, without re-sorting', () => {
    render(<Harness flights={[flight({ id: 1, date: '2027-03-01', lifecycle_state: 'upcoming' }), flight({ id: 2, date: '2027-01-01', lifecycle_state: 'upcoming' }), flight({ id: 3, date: '2026-01-01', lifecycle_state: 'logged' })]} />)
    expect([...document.querySelectorAll('[data-flight-row]')].map(row => row.getAttribute('data-flight-row'))).toEqual(['1', '2', '3'])
  })

  it('exposes the sort direction and uses a labelled group', async () => {
    const user = userEvent.setup()
    render(<Harness start="order=asc" />)
    const group = screen.getByRole('group', { name: 'Sort' })
    expect(within(group).getByRole('button', { name: 'Date, ascending' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Origin' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(group).getByRole('button', { name: 'Date, ascending' }))
    expect(nav.push).toHaveBeenCalledWith('/journal', { scroll: false })
  })

  it('has one desktop sort control (the list headers, covering every sort) and keeps Sort and Order in the mobile filter sheet', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Order' })).not.toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Sort' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Date', 'Origin', 'Destination', 'Airline', 'Aircraft', 'Duration', 'Distance'])
    await user.click(within(group).getByRole('button', { name: 'Duration' }))
    expect(nav.push).toHaveBeenCalledWith('/journal?sort=duration_minutes', { scroll: false })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('combobox', { name: 'Sort' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Order' })).toBeInTheDocument()
  })

  it('offers a way back from an out-of-range page, and the Import and Add pair for an empty journal', () => {
    const { unmount } = render(<Harness start="page=9" flights={[]} total={3} />)
    expect(screen.getByRole('heading', { name: 'There are no flights on this page.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the first page' })).toHaveAttribute('href', '/journal')
    unmount()
    render(<Harness flights={[]} total={0} />)
    expect(screen.getByRole('link', { name: 'Import flights' })).toHaveAttribute('href', '/import')
    expect(screen.getByRole('link', { name: 'Add a flight' })).toHaveAttribute('href', '/add')
  })

  it('shows Reset as a client link when filters match nothing', () => {
    render(<Harness start="airline=ZZ" flights={[]} total={0} />)
    expect(screen.getAllByRole('link', { name: 'Reset filters' })[0]).toHaveAttribute('href', '/journal')
  })

  it('shows one offline notice and blocks changes without repeating the reason per row', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<Harness flights={[flight({ id: 7, date: '2025-04-03', lifecycle_state: 'logged', aircraft_icao: null }), flight({ id: 8, date: '2025-04-02', lifecycle_state: 'logged', aircraft_icao: null })]} />)
    const notes = screen.getAllByText('Offline. Connect to change flights.')
    expect(notes).toHaveLength(1)
    for (const button of screen.getAllByRole('button', { name: /^Add aircraft/ })) { expect(button).toHaveAttribute('aria-disabled', 'true'); expect(button).toHaveAttribute('aria-describedby', notes[0].id) }
  })
})
