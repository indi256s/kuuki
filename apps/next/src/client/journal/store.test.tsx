// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@kuuki/client/apiClient'
import { ROUTE_LINK_EVENT } from '../navigation-link'
import type { JournalFlight, JournalPayload } from './model'
import { JournalStoreProvider, useJournalStore, type JournalStore } from './store'

vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn() } }))

const flight = (id: number, overrides: Partial<JournalFlight> = {}) => ({
  id, date: `2024-05-0${id}`, origin: 'TBS', destination: 'IST', airline_iata: 'TK', aircraft_icao: null, flight_number: null, departure_utc: null, arrival_utc: null,
  distance_km: 1000, duration_minutes: 120, lifecycle_state: 'logged', origin_country: 'GE', destination_country: 'TR', ...overrides,
}) as unknown as JournalFlight
const payloadOf = (flights: JournalFlight[], revision = 1, updatedAt = 1): JournalPayload =>
  ({ flights, firsts: {}, refs: { airports: {}, airlines: {}, aircraft: {} }, updatedAt, revision, publishedRevision: revision, derivedState: 'ready' })

const probe: { current: JournalStore | null } = { current: null }
const store = () => probe.current!
function Probe() {
  const value = useJournalStore()
  useEffect(() => { probe.current = value })
  return <ol>{value.selection.matching.map(item => <li key={item.id}>{item.origin}-{item.destination}</li>)}</ol>
}
const mount = (initial: JournalPayload, initialQuery = '') => render(<JournalStoreProvider ownerId="owner" locale="en" initial={initial} initialQuery={initialQuery}><Probe /></JournalStoreProvider>)
const href = () => window.location.pathname + window.location.search + window.location.hash
const traverse = (step: () => void) => act(async () => { const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true })); step(); await popped })
const back = () => traverse(() => window.history.back())
const forward = () => traverse(() => window.history.forward())

beforeEach(() => {
  window.history.replaceState(null, '', '/journal')
  vi.spyOn(window.history, 'pushState')
  vi.spyOn(window.history, 'replaceState')
  vi.mocked(api.get).mockReset().mockRejectedValue(new Error('unstubbed GET'))
})
afterEach(() => { vi.restoreAllMocks() })

describe('Journal store URL mirror', () => {
  it('renders the initial query on the first render and leaves a canonical URL alone', () => {
    window.history.replaceState(null, '', '/journal?airport=IST')
    vi.mocked(window.history.replaceState).mockClear()
    mount(payloadOf([flight(1), flight(2, { origin: 'MUC', destination: 'FRA', origin_country: 'DE', destination_country: 'DE' })]), 'airport=IST')
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['TBS-IST'])
    expect(store().view.filters.airports).toEqual(['IST'])
    expect(window.history.replaceState).not.toHaveBeenCalled()
  })

  it('canonicalises a legacy query and an arrival hash on mount', () => {
    window.history.replaceState(null, '', '/journal?origin=tbs&page=3&sortField=distance_km#arrival-2')
    mount(payloadOf([flight(1), flight(2)]), 'origin=tbs&page=3&sortField=distance_km')
    expect(href()).toBe('/journal?airport=TBS&sort=distance&flight=2&review=1')
    expect(store().view).toMatchObject({ flight: 2, review: true, sort: { key: 'distance', order: 'desc' } })
    expect(window.history.pushState).not.toHaveBeenCalled()
  })

  it('mirrors filter and sort changes with replaceState, never pushState, and drops defaults', () => {
    mount(payloadOf([flight(1), flight(2, { airline_iata: 'PC' })]))
    act(() => store().setFilters({ airlines: ['PC', 'PC'] }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(href()).toBe('/journal?airline=PC')
    act(() => store().setSort({ key: 'duration', order: 'asc' }))
    expect(href()).toBe('/journal?airline=PC&sort=duration&order=asc')
    act(() => store().resetFilters())
    act(() => store().setSort({ key: 'date', order: 'desc' }))
    expect(href()).toBe('/journal')
    expect(window.history.replaceState).toHaveBeenCalled()
    expect(window.history.pushState).not.toHaveBeenCalled()
  })

  it('pushes one entry to open the sheet, replaces while switching flights, and Back closes it', async () => {
    mount(payloadOf([flight(1), flight(2)]))
    act(() => store().openFlight(1))
    expect(window.history.pushState).toHaveBeenCalledTimes(1)
    expect(href()).toBe('/journal?flight=1')
    act(() => store().openFlight(2))
    act(() => store().openFlight(2, { review: true }))
    expect(window.history.pushState).toHaveBeenCalledTimes(1)
    expect(href()).toBe('/journal?flight=2&review=1')
    await back()
    expect(store().view).toMatchObject({ flight: null, review: false })
    expect(href()).toBe('/journal')
  })

  it('closes a pushed sheet by stepping back, keeping filters changed while it was open', async () => {
    mount(payloadOf([flight(1), flight(2, { airline_iata: 'PC' })]))
    act(() => store().openFlight(1))
    act(() => store().setFilters({ airlines: ['TK'] }))
    const backSpy = vi.spyOn(window.history, 'back')
    const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }))
    act(() => store().closeSheet())
    expect(backSpy).toHaveBeenCalledTimes(1)
    expect(store().view.flight).toBeNull()
    await act(async () => { await popped })
    expect(href()).toBe('/journal?airline=TK')
    expect(store().view.filters.airlines).toEqual(['TK'])
  })

  it('keeps filters only on Back to the sheet\'s own parent entry, not on Forward to a later one', async () => {
    window.history.replaceState(null, '', '/journal?airline=TK')
    mount(payloadOf([flight(1), flight(2, { airline_iata: 'PC' })]), 'airline=TK')
    act(() => store().openFlight(1))
    // A shell link to the bare Journal: Next pushes the entry, the store follows the link's view.
    act(() => { window.history.pushState({}, '', '/journal'); window.dispatchEvent(new CustomEvent(ROUTE_LINK_EVENT, { detail: '/journal' })) })
    expect(store().view.filters.airlines).toEqual([])
    await back()
    expect(store().view).toMatchObject({ flight: 1, filters: { airlines: ['TK'] } })
    await forward()
    expect(store().view).toMatchObject({ flight: null, filters: { airlines: [] } })
    expect(href()).toBe('/journal')
  })

  it('closes a deep-linked sheet with replaceState', () => {
    window.history.replaceState(null, '', '/journal?flight=1')
    mount(payloadOf([flight(1)]), 'flight=1')
    const backSpy = vi.spyOn(window.history, 'back')
    act(() => store().closeSheet())
    expect(backSpy).not.toHaveBeenCalled()
    expect(href()).toBe('/journal')
  })
})

describe('Journal store payload', () => {
  it('keeps a newer cached payload when an older server render arrives, and adopts a newer one', async () => {
    const view = mount(payloadOf([flight(1)], 2, 2))
    vi.mocked(api.get).mockResolvedValue(payloadOf([flight(1), flight(2)], 3, 3))
    await act(async () => { await store().refresh() })
    expect(api.get).toHaveBeenCalledWith('/api/flights/journal', { owner: 'owner' }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    await waitFor(() => expect(store().payload.revision).toBe(3))

    view.rerender(<JournalStoreProvider ownerId="owner" locale="en" initial={payloadOf([flight(1)], 1, 9)} initialQuery=""><Probe /></JournalStoreProvider>)
    await act(async () => {})
    expect(store().payload.revision).toBe(3)

    view.rerender(<JournalStoreProvider ownerId="owner" locale="en" initial={payloadOf([flight(1), flight(2), flight(3)], 4, 4)} initialQuery=""><Probe /></JournalStoreProvider>)
    await waitFor(() => expect(store().payload.revision).toBe(4))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('keeps rows and reports an error when a background refresh fails', async () => {
    mount(payloadOf([flight(1)]))
    vi.mocked(api.get).mockRejectedValue(new Error('offline'))
    await act(async () => { await store().refresh() })
    await waitFor(() => expect(store().isError).toBe(true), { timeout: 3000 })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps this owner\'s rows without an error when the server says the account changed', async () => {
    mount(payloadOf([flight(1)]))
    vi.mocked(api.get).mockRejectedValue(new ApiError(409, 'The signed-in account changed', 'OWNER_CHANGED'))
    await act(async () => { await store().refresh() })
    await act(async () => {})
    expect(store().isError).toBe(false)
    expect(store().payload.flights.map(item => item.id)).toEqual([1])
  })

  it('hides rows optimistically and keeps hidden rows out of the visible selection', () => {
    mount(payloadOf([flight(1), flight(2), flight(3)]))
    act(() => store().selectAll([1, 2, 3]))
    act(() => store().setFilters({ years: [2024] }))
    expect(store().selectedVisible).toEqual([3, 2, 1])
    act(() => store().hide([2]))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(store().selectedVisible).toEqual([3, 1])
    act(() => store().toggle(2))
    expect(store().selected.has(2)).toBe(false)
    act(() => store().unhide([2]))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
