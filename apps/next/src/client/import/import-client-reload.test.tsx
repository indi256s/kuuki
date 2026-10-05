// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, snapshot } from './fixtures'

// The real create helper and receipt store run here; only the network answers are stood in.
const post = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }) }))
vi.mock('../signature/stamp', () => ({ Stamp: () => null }))
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('../../../../web/src/lib/apiClient')>()), api: { post: (...args: unknown[]) => post(...args) } }))
vi.mock('./import-api', async importOriginal => ({
  ...(await importOriginal<typeof import('./import-api')>()),
  confirmItems: vi.fn(), cancelBatch: vi.fn(), discardBatch: vi.fn(), patchDraft: vi.fn(), listUnfinished: vi.fn(async () => []),
  fetchPressedCountries: vi.fn(async () => new Set<string>()), submitSource: vi.fn(), readBatch: vi.fn(),
}))

import { clearFlightCreateOperations } from '../../../../web/src/lib/flightCreateOperations'
import { ImportClient } from './import-client'
import type { BatchApi } from './use-import-batch'

const api = (): BatchApi => ({
  readBatch: vi.fn(async () => snapshot([draft({ id: 'a', selected: false })], { sequence: 5, expiresAt: '2026-11-04T12:00:00.000Z' })),
  connect: vi.fn(async () => {}), submit: vi.fn(), sleep: vi.fn(async () => {}),
})
const committed = new Set<string>()
const answer = (status: string) => ({ results: [{ status }], derived_state: 'ready', revision: 3 })
const manualRow = () => screen.getByText('Flight added by hand').closest('li')!
const sentKeys = () => post.mock.calls.map(call => (call[1] as { items: Array<{ key: string }> }).items[0].key)

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  post.mockReset(); refresh.mockReset(); committed.clear(); clearFlightCreateOperations(); window.history.replaceState(null, '', '/import')
})

async function addAndLoseManualSave(user: ReturnType<typeof userEvent.setup>) {
  post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); throw new TypeError('Failed to fetch') })
  await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
  await fillManual(user)
  await user.click(screen.getByRole('button', { name: /import 1/i }))
  await screen.findByRole('heading', { name: /some flights were not saved/i })
}
async function fillManual(user: ReturnType<typeof userEvent.setup>) {
  const row = within(manualRow())
  await user.type(row.getByLabelText(/^Date/), '2026-03-01')
  await user.type(row.getByLabelText(/^From \(airport code\)/), 'JFK')
  await user.type(row.getByLabelText(/^To \(airport code\)/), 'BOS')
}

describe('N1 an unresolved manual save survives a reload', () => {
  it('lost committed response, reload: the recovery row is shown and retrying it commits one key', async () => {
    const user = userEvent.setup()
    const first = render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    await addAndLoseManualSave(user)
    first.unmount()

    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    await screen.findByRole('heading', { name: /review flights/i })
    expect(within(manualRow()).getByText(/may or may not be saved/i)).toBeInTheDocument()
    expect(within(manualRow()).getByLabelText(/^To \(airport code\)/)).toHaveValue('BOS')
    expect(within(manualRow()).getByRole('button', { name: /i checked the journal/i })).toBeInTheDocument()

    post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => {
      const key = body.items[0].key
      const status = committed.has(key) ? 'replayed' : 'created'
      committed.add(key)
      return answer(status)
    })
    await user.click(within(manualRow()).getByRole('button', { name: /retry original save/i }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(post).toHaveBeenCalledTimes(2)
    expect(new Set(sentKeys()).size).toBe(1)
    expect(committed.size).toBe(1)
  })

  it('re-adding the identical flight after a reload is held back and points to the recovery row', async () => {
    const user = userEvent.setup()
    const first = render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    await addAndLoseManualSave(user)
    first.unmount()

    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    await screen.findByRole('heading', { name: /review flights/i })
    await user.click(screen.getByRole('button', { name: /add a flight manually/i }))
    const added = screen.getAllByText('Flight added by hand')[1].closest('li')!
    await user.type(within(added).getByLabelText(/^Date/), '2026-03-01')
    await user.type(within(added).getByLabelText(/^From \(airport code\)/), 'JFK')
    await user.type(within(added).getByLabelText(/^To \(airport code\)/), 'BOS')
    post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); return answer('replayed') })
    await user.click(screen.getByRole('button', { name: /import 2/i }))
    await screen.findByText(/same flight is still unconfirmed/i)
    expect(post).toHaveBeenCalledTimes(2) // the recovery row replays; the identical new row is not sent
    expect(committed.size).toBe(1)
    expect(new Set(sentKeys()).size).toBe(1)
  })
})
