// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, snapshot } from './fixtures'
import type { Snapshot } from './import-types'

// The real create helper and receipt store run here; only the network answers are stood in.
const post = vi.fn()
const refresh = vi.fn()
const discardBatch = vi.fn(async () => ({ deleted: true }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }) }))
vi.mock('../signature/stamp', () => ({ Stamp: () => null }))
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('../../../../web/src/lib/apiClient')>()), api: { post: (...args: unknown[]) => post(...args) } }))
vi.mock('./import-api', async importOriginal => ({
  ...(await importOriginal<typeof import('./import-api')>()),
  confirmItems: vi.fn(), cancelBatch: vi.fn(), discardBatch: () => discardBatch(), patchDraft: vi.fn(), listUnfinished: vi.fn(async () => []),
  fetchPressedCountries: vi.fn(async () => new Set<string>()), submitSource: vi.fn(), readBatch: vi.fn(),
}))

import { clearFlightCreateOperations } from '../../../../web/src/lib/flightCreateOperations'
import { createFlights } from '../capture/flight-writes'
import { toFlightInput } from './flight-input'
import { ImportClient } from './import-client'
import { emptyValues } from './review-model'
import type { BatchApi } from './use-import-batch'

const api = (answer: Snapshot = snapshot([draft({ id: 'a', selected: false })], { sequence: 5, expiresAt: '2026-11-04T12:00:00.000Z' })): BatchApi => ({
  readBatch: vi.fn(async () => answer), connect: vi.fn(async () => {}), submit: vi.fn(), sleep: vi.fn(async () => {}),
})
const committed = new Set<string>()
const ok = (status: string) => ({ results: [{ status }], derived_state: 'ready', revision: 3 })
const sentKeys = () => post.mock.calls.map(call => (call[1] as { items: Array<{ key: string }> }).items[0].key)
const RECEIPT = 'kuuki-flight-create-operation:'
const DAY = 24 * 60 * 60 * 1000

/** The server commits each key once; a replayed key answers `replayed`. */
const serverCommits = () => post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => {
  const key = body.items[0].key
  const status = committed.has(key) ? 'replayed' : 'created'
  committed.add(key)
  return ok(status)
})
/** The server commits the key, then the answer is lost. */
const commitThenLose = () => post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); throw new TypeError('Failed to fetch') })

const flight = (over: Partial<ReturnType<typeof emptyValues>> = {}) => toFlightInput({ ...emptyValues(), date: '2026-03-01', origin: 'JFK', destination: 'BOS', ...over })
/** A manual save written the way main writes it (a plain UUID operation id) whose committed answer was lost. */
async function loseOldFormatSave(owner = 'u1', over: Partial<ReturnType<typeof emptyValues>> = {}): Promise<string> {
  const operationId = crypto.randomUUID()
  commitThenLose()
  await createFlights(owner, [{ operationId, flight: flight(over) }])
  return operationId
}
/** Ages a stored receipt past the six-day safe-retry window, as if it had been written a week ago. */
function age(owner: string, operationId: string) {
  const stored = JSON.parse(localStorage.getItem(`${RECEIPT}${owner}:${operationId}`)!) as { createdAt: number }
  localStorage.setItem(`${RECEIPT}${owner}:${operationId}`, JSON.stringify({ ...stored, createdAt: Date.now() - 7 * DAY }))
}

const recovery = () => screen.getByRole('region', { name: /unconfirmed saves/i })
const entries = () => within(recovery()).getAllByRole('listitem')
const manualRows = () => screen.getAllByText('Flight added by hand').map(title => title.closest('li')!)

async function addManual(user: ReturnType<typeof userEvent.setup>, over: { date?: string; origin?: string; destination?: string } = {}) {
  await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
  const row = within(manualRows().at(-1)!)
  await user.type(row.getByLabelText(/^Date/), over.date ?? '2026-03-01')
  await user.type(row.getByLabelText(/^From \(airport code\)/), over.origin ?? 'JFK')
  await user.type(row.getByLabelText(/^To \(airport code\)/), over.destination ?? 'BOS')
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  post.mockReset(); refresh.mockReset(); discardBatch.mockClear(); committed.clear(); clearFlightCreateOperations(); localStorage.clear(); window.history.replaceState(null, '', '/import')
})

describe('R3-C1 an unresolved save in the earlier plain-UUID format is recoverable', () => {
  it('lost committed response, remount: the save is listed with its flight and retrying it commits one key', async () => {
    const user = userEvent.setup()
    await loseOldFormatSave()
    render(<StrictMode><ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} /></StrictMode>)
    await screen.findByRole('heading', { name: /review flights/i })
    expect(entries()).toHaveLength(1) // listed once, also under StrictMode
    expect(within(entries()[0]).getByText(/JFK → BOS · Mar 1, 2026/)).toBeInTheDocument()
    expect(within(entries()[0]).getByText(/may or may not be saved/i)).toBeInTheDocument()

    serverCommits()
    await user.click(within(entries()[0]).getByRole('button', { name: /retry original save/i }))
    expect(await within(recovery()).findByText(/saved: jfk → bos/i)).toBeInTheDocument()
    expect(within(recovery()).queryAllByRole('listitem')).toHaveLength(0)
    expect(post).toHaveBeenCalledTimes(2)
    expect(new Set(sentKeys()).size).toBe(1)
    expect(committed.size).toBe(1)
  })

  it('lost committed response, remount: an identical re-add is held, points at the listed save, and nothing is committed twice', async () => {
    const user = userEvent.setup()
    const old = await loseOldFormatSave()
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    await screen.findByRole('heading', { name: /review flights/i })
    await addManual(user)
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    expect(await screen.findByText(/same flight is still unconfirmed/i)).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1) // only the lost original
    expect(committed.size).toBe(1)

    await user.click(screen.getByRole('button', { name: /^back to review$/i }))
    await user.click(within(manualRows()[0]).getByRole('button', { name: /show the unconfirmed save/i }))
    expect(document.activeElement).toBe(entries()[0])
    expect(entries()[0].id).toContain(old)

    serverCommits()
    await user.click(within(entries()[0]).getByRole('button', { name: /retry original save/i }))
    await within(recovery()).findByText(/saved: jfk → bos/i)
    expect(new Set(sentKeys()).size).toBe(1)
    expect(committed.size).toBe(1)
  })
})

describe('R3-I1 recovery does not depend on the batch that wrote the save', () => {
  it('discard the batch, remount in another: the identical re-add is held, the listed save is reachable, and the journal check frees the re-add', async () => {
    const user = userEvent.setup()
    const first = render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api()} />)
    commitThenLose()
    await addManual(user)
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    await user.click(screen.getByRole('button', { name: /^back to review$/i }))
    await user.click(screen.getByRole('button', { name: /^discard import$/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^discard import$/i }))
    await screen.findByRole('radio', { name: /paste text/i })
    expect(entries()).toHaveLength(1) // the discarded batch's save is still listed on Source
    first.unmount()

    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b2" batchApi={api(snapshot([draft({ id: 'z', selected: false })], { id: 'b2' }))} />)
    await screen.findByRole('heading', { name: /review flights/i })
    await addManual(user)
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByText(/same flight is still unconfirmed/i)
    expect(post).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /^back to review$/i }))
    await user.click(within(manualRows()[0]).getByRole('button', { name: /show the unconfirmed save/i }))
    expect(document.activeElement).toBe(entries()[0])

    await user.click(within(entries()[0]).getByRole('button', { name: /i checked the journal/i }))
    expect(within(recovery()).getByText(/marked as checked: jfk → bos/i)).toBeInTheDocument()
    expect(screen.queryByText(/same flight is still unconfirmed/i)).toBeNull()
    serverCommits()
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
    expect(new Set(sentKeys()).size).toBe(2) // a new key only after the member settled the old one
  })

  it('an expired batch still lists the unresolved save on Source', async () => {
    await loseOldFormatSave()
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api(snapshot([], { expired: true }))} />)
    expect(await screen.findByRole('heading', { name: /expired/i })).toBeInTheDocument()
    expect(entries()).toHaveLength(1)
    expect(within(entries()[0]).getByText(/JFK → BOS/)).toBeInTheDocument()
    expect(within(entries()[0]).getByRole('button', { name: /retry original save/i })).not.toHaveAttribute('aria-disabled', 'true')
    expect(within(entries()[0]).getByRole('button', { name: /i checked the journal/i })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('a manual row started after leaving a failed batch is labelled solo, not with the old batch', async () => {
    const user = userEvent.setup()
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api(snapshot([], { status: 'failed', errorCode: 'NO_FLIGHTS_FOUND' }))} />)
    await user.click(await screen.findByRole('button', { name: /enter flights by hand/i }))
    const row = within(manualRows()[0])
    await user.type(row.getByLabelText(/^Date/), '2026-03-01')
    await user.type(row.getByLabelText(/^From \(airport code\)/), 'JFK')
    await user.type(row.getByLabelText(/^To \(airport code\)/), 'BOS')
    commitThenLose()
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    const stored = Object.keys(localStorage).filter(key => key.startsWith(`${RECEIPT}u1:`))
    expect(stored).toHaveLength(1)
    expect(stored[0]).toContain(':manual:solo:')
  })
})

describe('R3-I2 a completed batch keeps restored saves settleable', () => {
  it('an uncertain and an expired save are both settled from Done, and no control there is a no-op', async () => {
    const user = userEvent.setup()
    await loseOldFormatSave('u1')
    const aged = await loseOldFormatSave('u1', { origin: 'LHR', destination: 'CDG' })
    age('u1', aged)
    const done = snapshot([draft({ id: 'a', status: 'converted', convertedFlightId: 5 })], { status: 'completed' })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api(done)} />)
    await screen.findByRole('heading', { name: /import finished/i })
    expect(entries()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /back to review|review the remaining/i })).toBeNull()

    const [lhr, jfk] = [entries().find(item => within(item).queryByText(/LHR → CDG/))!, entries().find(item => within(item).queryByText(/JFK → BOS/))!]
    expect(within(lhr).getByRole('button', { name: /retry original save/i })).toHaveAttribute('aria-disabled', 'true')
    serverCommits()
    await user.click(within(jfk).getByRole('button', { name: /retry original save/i }))
    await within(recovery()).findByText(/saved: jfk → bos/i)
    await user.click(within(entries()[0]).getByRole('button', { name: /i checked the journal/i }))
    expect(within(recovery()).getByText(/marked as checked: lhr → cdg/i)).toBeInTheDocument()
    expect(within(recovery()).queryAllByRole('listitem')).toHaveLength(0)
    expect(committed.size).toBe(2) // two different flights, each under its own single key
    expect(new Set(sentKeys()).size).toBe(2)
    expect(screen.getByRole('heading', { name: /import finished/i })).toBeInTheDocument()
  })

  it('Back to review wins over a batch that completed while manual work remained', async () => {
    const user = userEvent.setup()
    const batchApi = api()
    const completed = snapshot([draft({ id: 'a', status: 'dismissed' })], { status: 'completed' })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={batchApi} />)
    await addManual(user)
    vi.mocked(batchApi.readBatch).mockResolvedValue(completed) // the stored batch completed meanwhile
    commitThenLose()
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    await user.click(screen.getByRole('button', { name: /^back to review$/i }))
    expect(await screen.findByRole('heading', { name: /review flights/i })).toBeInTheDocument()
    expect(within(manualRows()[0]).getByRole('button', { name: /i checked the journal/i })).toBeInTheDocument()
  })
})

describe('R3-I3 an intact receipt past the safe-retry window', () => {
  it('shows its pinned flight, holds the retry back with the reason, and keeps the journal check', async () => {
    const user = userEvent.setup()
    const operationId = await loseOldFormatSave('u1', { flight_number: '100', airline_iata: 'AA' })
    age('u1', operationId)
    render(<ImportClient ownerId="u1" locale="en" />)
    const entry = await waitFor(() => entries()[0])
    expect(within(entry).getByText(/JFK → BOS · Mar 1, 2026/)).toBeInTheDocument()
    expect(within(entry).getByText('100')).toBeInTheDocument()
    expect(within(entry).getByText('AA')).toBeInTheDocument()
    const retry = within(entry).getByRole('button', { name: /retry original save/i })
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(document.getElementById(retry.getAttribute('aria-describedby')!.split(' ').at(-1)!)).toHaveTextContent(/safe retry period has passed/i)
    await user.click(retry)
    expect(post).toHaveBeenCalledTimes(1)
    const check = within(entry).getByRole('button', { name: /i checked the journal/i })
    expect(check).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(check)
    expect(screen.getByText(/marked as checked/i)).toBeInTheDocument()
    expect(Object.keys(localStorage).filter(key => key.startsWith(RECEIPT))).toEqual([])
  })
})

describe('owner isolation', () => {
  it("another member's unresolved saves are never listed or matched", async () => {
    const user = userEvent.setup()
    await loseOldFormatSave('u1')
    render(<ImportClient ownerId="u2" locale="en" initialBatchId="b1" batchApi={api()} />)
    await screen.findByRole('heading', { name: /review flights/i })
    expect(screen.queryByRole('region', { name: /unconfirmed saves/i })).toBeNull()
    serverCommits()
    await addManual(user)
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
    expect(Object.keys(localStorage).filter(key => key.startsWith(`${RECEIPT}u1:`))).toHaveLength(1) // u1's save is untouched
  })
})
