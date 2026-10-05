// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../../../web/src/lib/apiClient'
import { JournalQueue } from './journal-queue'
import { awaitPublication } from '../publication'
import type { AwaitingQueue } from '../awaiting'

const state = vi.hoisted(() => ({ online: true, data: null as AwaitingQueue | null, error: false, reload: vi.fn(), refresh: vi.fn() }))
vi.mock('../awaiting', () => ({ useAwaiting: () => state, useOnline: () => state.online }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...await importOriginal<typeof import('../../../../web/src/lib/apiClient')>(), api: { post: vi.fn(), get: vi.fn() } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../publication', () => ({ awaitPublication: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  state.online = true; state.error = false
  state.data = { awaitingFlights: [1, 2, 3].map(id => ({ flight: { id, origin: 'TBS', destination: 'IST', date: '2026-10-03' }, candidate: { kind: 'none', label: null, legId: null }, effectiveDefault: { transit: false }, candidateToken: `token-${id}` })), drafts: [{ batchId: 'batch', sourceType: 'text', sourceLabel: 'Travel notes', status: 'processing', reviewRowCount: 0 }], awaitingFlightCount: 3, draftRowCount: 0, actionableCount: 3, derivedState: 'ready', revision: 1 } as AwaitingQueue
  vi.mocked(api.get).mockResolvedValue({ candidates: [], marker: null })
})
afterEach(() => vi.restoreAllMocks())
const mount = () => render(<JournalQueue ownerId="queue-owner" locale="en" hiddenIds={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

it('keeps queue failures visible alongside cached flights and disables offline mutations', async () => {
  state.error = true; state.online = false
  mount()
  expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh the queue.')
  expect(screen.getAllByRole('button', { name: 'Confirm arrival' })[0]).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getAllByText('Offline. Connect to change flights.').length).toBeGreaterThan(0)
  fireEvent.click(screen.getAllByRole('button', { name: 'Confirm arrival' })[0])
  expect(api.post).not.toHaveBeenCalled()
  expect(screen.getByText(/Processing/)).toBeInTheDocument()
})

it('keeps a failed flight actionable and retries an uncertain confirmation with the same receipt identity', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ results: [{ flightId: 1 }], derivedState: 'ready', revision: 2, newlyStampedCountries: ['GE'] })
  mount()
  fireEvent.click(screen.getAllByRole('button', { name: 'Confirm arrival' })[0])
  await screen.findByRole('button', { name: 'Retry confirmation' })
  expect(screen.getAllByText('Did you arrive?')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }))
  await screen.findByText('New stamps: Georgia.')
  expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[0][1])
  expect(screen.getByText('New stamps: Georgia.')).toHaveFocus()
})

it('bulk confirmation hides committed cards, waits for publication, then resolves the receipt before stamp press', async () => {
  let published!: (value: 'ready') => void
  vi.mocked(awaitPublication).mockImplementation(() => new Promise(resolve => { published = resolve }))
  vi.mocked(api.post).mockResolvedValueOnce({ results: [1, 2, 3].map(flightId => ({ flightId })), derivedState: 'pending', revision: 2, newlyStampedCountries: null }).mockResolvedValueOnce({ results: [], derivedState: 'ready', revision: 2, newlyStampedCountries: ['GE'], pendingCountryCount: 0 })
  const { container } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm all shown' }))
  await screen.findByText('Flights saved. Finishing publication…')
  expect(container.querySelector('[data-press]')).toBeNull()
  expect(screen.queryByText('Did you arrive?')).not.toBeInTheDocument()
  expect(api.post).toHaveBeenCalledTimes(1)
  await act(async () => published('ready'))
  await waitFor(() => expect(container.querySelector('[data-press="play"]')).not.toBeNull())
  expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[0][1])
  expect(screen.getByText('New stamps: Georgia.')).toHaveFocus()
})


it.each(['apply', 'dismiss'] as const)('historical review %s preserves unselected flights and honors the persisted marker', async action => {
  const snapshot = {
    candidates: [1, 2].map(id => ({ flight: { id, origin: 'TBS', destination: 'IST' }, candidate: { kind: 'link', label: 'estimated', leg: { destination: 'FRA' } }, candidateToken: `review-${id}`, affectedCountries: ['TR'] })),
    wouldRemoveStamp: { TR: true }, marker: null, derivedState: 'ready', revision: 1,
  }
  vi.mocked(api.get).mockResolvedValueOnce(snapshot).mockResolvedValue({ ...snapshot, marker: { status: action === 'apply' ? 'completed' : 'dismissed', matchesCandidates: true } })
  vi.mocked(api.post).mockResolvedValue({ action, results: [], derivedState: 'ready', revision: 2, removedCountries: action === 'apply' ? ['TR'] : [] })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Review historical connections' }))
  expect(screen.getAllByText(/Estimated from dates/)).toHaveLength(2)
  expect(screen.getAllByText(/stamp will be removed/)).toHaveLength(2)
  if (action === 'apply') fireEvent.click(screen.getAllByRole('checkbox')[0])
  fireEvent.click(screen.getByRole('button', { name: action === 'apply' ? 'Mark selected as transit' : 'Keep as recorded' }))
  await screen.findByText(action === 'apply' ? 'Removed stamps: TR' : 'Review saved.')
  const request = vi.mocked(api.post).mock.calls[0][1]
  expect(request).toEqual({ operationId: expect.any(String), action, items: action === 'apply' ? [{ flightId: 1, candidateToken: 'review-1' }] : [] })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Review historical connections' })).not.toBeInTheDocument())
})


it('shows a processing draft with no extracted rows without claiming that everything is reviewed', () => {
  state.data = { ...state.data!, awaitingFlights: [], awaitingFlightCount: 0, actionableCount: 0 }
  mount()
  expect(screen.getByText(/Processing/)).toBeInTheDocument()
  expect(screen.queryByText('Everything is reviewed.')).not.toBeInTheDocument()
})
