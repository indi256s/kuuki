// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfirmResponse, Draft, Snapshot } from './import-types'
import { draft, snapshot } from './fixtures'

const acknowledge = vi.fn()
const refresh = vi.fn()
const confirmItems = vi.fn()
const cancelBatch = vi.fn(async () => ({ cancelled: true }))
const discardBatch = vi.fn(async () => ({ deleted: true }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge, status: 'idle' }) }))
vi.mock('../capture/flight-writes', () => ({ createFlights: vi.fn(async () => []) }))
vi.mock('../signature/stamp', () => ({ Stamp: () => null }))
vi.mock('./import-api', async importOriginal => ({
  ...(await importOriginal<typeof import('./import-api')>()),
  confirmItems: (...args: unknown[]) => confirmItems(...args), cancelBatch: () => cancelBatch(), discardBatch: () => discardBatch(),
  patchDraft: vi.fn(), listUnfinished: vi.fn(async () => []), fetchPressedCountries: vi.fn(async () => new Set<string>()),
  submitSource: vi.fn(), readBatch: vi.fn(),
}))

import { ImportClient } from './import-client'
import type { BatchApi } from './use-import-batch'

const ids = ['a', 'b', 'c']
function serverWith(drafts: Draft[]) {
  const state = { drafts }
  const api: BatchApi = {
    readBatch: vi.fn(async (): Promise<Snapshot> => snapshot(state.drafts, { sequence: 5 })),
    connect: vi.fn(async () => {}), submit: vi.fn(), sleep: vi.fn(async () => {}),
  }
  return { state, api }
}
const response = (results: ConfirmResponse['results'], derived = true): ConfirmResponse =>
  ({ results, batch: { id: 'b1', status: 'review', sequence: 6, reviewRowCount: 0 }, ...(derived ? { derived_state: 'ready' as const, revision: 9 } : {}) })
const created = (d: { draftId: string; version: number }) => ({ draftId: d.draftId, key: `import:${d.draftId}:${d.version}`, status: 'created' as const, flight: { id: 100, aircraft_icao: null, origin: 'JFK', destination: 'BOS', date: '2026-03-01' } })
const failed = (d: { draftId: string; version: number }) => ({ draftId: d.draftId, key: `import:${d.draftId}:${d.version}`, status: 'error' as const, http_status: 500, code: 'INTERNAL', error: 'x' })

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => { acknowledge.mockReset(); refresh.mockReset(); confirmItems.mockReset(); window.history.replaceState(null, '', '/import') })

describe('ImportClient journeys', () => {
  it('resumes a stored batch URL into review without submitting', async () => {
    const { api } = serverWith(ids.map((id, ordinal) => draft({ id, ordinal })))
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    expect(await screen.findByRole('heading', { name: /review flights/i })).toBeInTheDocument()
    expect(screen.getByText(/3 selected of 3/i)).toBeInTheDocument()
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('saves partially, lists the failed row, refreshes anyway, and retries only that row', async () => {
    const user = userEvent.setup()
    const server = serverWith(ids.map((id, ordinal) => draft({ id, ordinal, version: 2 })))
    confirmItems.mockImplementationOnce(async (_batch: string, items: Array<{ draftId: string; version: number }>) => {
      for (const item of items) if (item.draftId !== 'b') server.state.drafts = server.state.drafts.map(row => row.id === item.draftId ? { ...row, status: 'converted', convertedFlightId: 100 } : row)
      return response(items.map(item => item.draftId === 'b' ? failed(item) : created(item)))
    })
    confirmItems.mockImplementationOnce(async (_batch: string, items: Array<{ draftId: string; version: number }>) => {
      server.state.drafts = server.state.drafts.map(row => items.some(item => item.draftId === row.id) ? { ...row, status: 'converted', convertedFlightId: 100 } : row)
      return response(items.map(created))
    })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 3/i }))
    expect(await screen.findByRole('heading', { name: /some flights were not saved/i })).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 2 of 3')
    expect(confirmItems.mock.calls[0][1]).toEqual([{ draftId: 'a', version: 2 }, { draftId: 'b', version: 2 }, { draftId: 'c', version: 2 }])
    expect(acknowledge).toHaveBeenCalledTimes(1) // a partial success still refreshes the freshness owners
    const failedList = screen.getByRole('heading', { name: 'Not saved' }).parentElement!
    expect(within(failedList).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Try again for 1' }))
    await waitFor(() => expect(confirmItems).toHaveBeenCalledTimes(2))
    expect(confirmItems.mock.calls[1][1]).toEqual([{ draftId: 'b', version: 2 }])
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Added 3 flights')
    expect(acknowledge).toHaveBeenCalledTimes(2)
  })

  it('refreshes the route itself when the answer carries no derived state', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    confirmItems.mockImplementationOnce(async (_b: string, items: Array<{ draftId: string; version: number }>) => {
      server.state.drafts = [{ ...server.state.drafts[0], status: 'converted' }]
      return response(items.map(created), false)
    })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(refresh).toHaveBeenCalled()
  })

  it('treats a lost answer as uncertain until the stored snapshot says otherwise', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' }), draft({ id: 'b', ordinal: 1 })])
    confirmItems.mockImplementationOnce(async () => {
      server.state.drafts = server.state.drafts.map(row => row.id === 'a' ? { ...row, status: 'converted' as const } : row) // saved, but the response was lost
      throw new TypeError('Failed to fetch')
    })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 2/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 1 of 2')
    expect(screen.getByText(/may or may not be saved/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again for 1' })).toBeInTheDocument()
  })

  it('shows a quota refusal as its own cause, with no review or empty-review copy', async () => {
    const quota = Object.assign(new Error('quota'), { status: 429, code: 'PROVIDER_QUOTA' })
    const api: BatchApi = { readBatch: vi.fn(), connect: vi.fn(), sleep: vi.fn(), submit: vi.fn(async () => { throw quota }) }
    const user = userEvent.setup()
    render(<ImportClient ownerId="u1" locale="en" batchApi={api} initialSource="text" />)
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'JFK BOS')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/recognition limit is used up/i)
    expect(screen.queryByText(/every flight from this import is saved/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /review flights/i })).not.toBeInTheDocument()
  })

  it('cancels a running recognition and returns to the source step', async () => {
    const user = userEvent.setup()
    const api: BatchApi = { readBatch: vi.fn(async () => snapshot([], { status: 'processing', stage: 'recognizing', sequence: 2 })), connect: () => new Promise(() => {}), sleep: vi.fn(), submit: vi.fn() }
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(cancelBatch).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: /find flights/i })).toBeInTheDocument()
  })
})
