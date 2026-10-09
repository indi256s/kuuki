// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import { ToastProvider } from '../ui/toast'
import { JournalShell } from './journal-page'
import type { JournalFlight, JournalPayload } from './model'
import { JournalStoreProvider } from './store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/link', async () => ({ default: (await import('../../test/next-link')).linkStandIn(() => {}) }))
vi.mock('../reads/historical-review', () => ({ HistoricalReview: () => null }))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))

const flight = (id: number, origin: string): JournalFlight => ({
  id, origin, destination: 'IST', date: `2024-05-0${id}`, airline_iata: 'TK', aircraft_icao: null, flight_number: null,
  departure_time: null, arrival_time: null, departure_utc: null, arrival_utc: null, distance_km: 1000, duration_minutes: 120,
  lifecycle_state: 'logged', source: 'manual', origin_country: 'GE', destination_country: 'TR',
}) as JournalFlight
const initial: JournalPayload = { flights: [flight(1, 'TBS'), flight(2, 'LHR')], firsts: {}, refs: { airports: {}, airlines: {}, aircraft: {} },
  updatedAt: 1, revision: 1, publishedRevision: 1, derivedState: 'ready' }

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockRejectedValue(new Error('unstubbed read'))
  vi.mocked(api.post).mockReset()
  vi.mocked(api.delete).mockReset()
  window.history.replaceState(null, '', '/journal')
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query.includes('1280'), addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Element.prototype.scrollIntoView = vi.fn()
})

it('wires desktop keys to real search, selection and the docked sheet, which follows the moved row', async () => {
  const user = userEvent.setup()
  render(<ToastProvider><JournalStoreProvider ownerId="owner" locale="en" initial={initial} initialQuery=""><JournalShell ownerId="owner" locale="en" /></JournalStoreProvider></ToastProvider>)
  fireEvent.keyDown(document.body, { key: '/' })
  expect(screen.getByRole('searchbox', { name: 'Search flights' })).toHaveFocus()
  screen.getByRole('searchbox').blur()
  fireEvent.keyDown(document.body, { key: 'j' })
  const first = screen.getByRole('button', { name: /^LHR to IST/ })
  expect(first).toHaveFocus()
  await user.keyboard('x')
  expect(screen.getByRole('checkbox', { name: /^Select: LHR/ })).toBeChecked()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('complementary', { name: 'Flight details' })).toBeInTheDocument()
  first.focus()
  await user.keyboard('j')
  await waitFor(() => expect(window.location.search).toContain('flight=1'))
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Flight details' })).not.toBeInTheDocument())
  fireEvent.keyDown(document.body, { key: '?' })
  expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
})


it('mobile menu confirms with queue tokens, reports the result, and uses the shared delete Undo', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query.includes('700'), addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const pending = { ...initial.flights[0]!, lifecycle_state: 'awaiting' as const }
  let saved: JournalFlight = pending
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/api/me/awaiting') return { awaitingFlights: [{ flight: pending, candidateToken: 'current-token', effectiveDefault: { transit: false } }], awaitingFlightCount: 1 }
    if (path === '/api/flights/journal') return { ...initial, flights: [saved], revision: 2, publishedRevision: 2 }
    throw new Error(path)
  })
  vi.mocked(api.post).mockImplementation(async () => {
    saved = { ...pending, lifecycle_state: 'logged' }
    return { results: [{ flightId: 1 }], derivedState: 'ready', revision: 2, newlyStampedCountries: [] }
  })
  const user = userEvent.setup()
  render(<ToastProvider><JournalStoreProvider ownerId="owner" locale="en" initial={{ ...initial, flights: [pending] }} initialQuery=""><JournalShell ownerId="owner" locale="en" /></JournalStoreProvider></ToastProvider>)
  await user.click(screen.getByRole('button', { name: /^Actions:/ }))
  await user.click(await screen.findByRole('menuitem', { name: 'I flew' }))
  await waitFor(() => expect(screen.getByText('Confirmed TBS → IST.')).toHaveAttribute('role', 'status'))
  expect(api.post).toHaveBeenCalledWith('/api/flights/confirm', expect.objectContaining({ items: [{ flightId: 1, candidateToken: 'current-token' }] }), expect.anything())
  await user.click(screen.getByRole('button', { name: /^Actions:/ }))
  await user.click(await screen.findByRole('menuitem', { name: 'Delete flight' }))
  expect(screen.queryByRole('button', { name: /^TBS to IST/ })).not.toBeInTheDocument()
  const undo = screen.getByRole('button', { name: 'Undo' })
  await waitFor(() => expect(undo).toHaveFocus())
  await user.click(undo)
  expect(screen.getByRole('button', { name: /^TBS to IST/ })).toBeInTheDocument()
  expect(api.delete).not.toHaveBeenCalled()
})
