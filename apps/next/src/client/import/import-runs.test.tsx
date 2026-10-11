// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchApi } from './batch-run'
import { draft, snapshot } from './fixtures'
import type { ImportEvent, Snapshot } from './import-types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../write-feedback', () => ({
  useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }),
}))
vi.mock('./import-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./import-api')>()),
  listUnfinished: vi.fn(async () => []),
  fetchPressedCountries: vi.fn(async () => new Set<string>()),
}))

import { ImportClient } from './import-client'
import { ImportRuns, ImportRunsProvider, useImportRuns } from './import-runs'

afterEach(cleanup)
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  window.history.replaceState(null, '', '/import')
})

const processing = (sequence: number) =>
  snapshot([draft({ id: 'a' })], { status: 'processing', stage: 'recognizing', sequence })

function Shown() {
  const entries = useImportRuns()
  return (
    <ul aria-label="runs">
      {entries.map((entry) => (
        <li key={entry.run.batchId() ?? 'new'}>
          {entry.run.batchId()} {entry.state.phase} {entry.viewed ? 'viewed' : 'docked'}
        </li>
      ))}
    </ul>
  )
}

describe('ImportRunsProvider', () => {
  it('keeps watching a run started in ImportClient after ImportClient unmounts', async () => {
    const user = userEvent.setup()
    let notify!: (event: ImportEvent) => void
    let signal!: AbortSignal
    const readBatch = vi
      .fn<BatchApi['readBatch']>()
      .mockResolvedValueOnce(processing(1))
      .mockResolvedValue(snapshot([draft({ id: 'a' })], { status: 'review', sequence: 2 }))
    const api: BatchApi = {
      readBatch,
      connect: vi.fn((_id, _after, onEvent, s) => {
        notify = onEvent
        signal = s
        return new Promise<void>(() => {})
      }),
      submit: vi.fn(async () => ({ batchId: 'b1' })),
      sleep: vi.fn(async () => {}),
    }
    const page = (open: boolean) => (
      <ImportRunsProvider api={api}>
        {open ? <ImportClient ownerId="u1" locale="en" batchApi={api} /> : null}
        <Shown />
      </ImportRunsProvider>
    )
    const { rerender } = render(page(true))
    await user.click(await screen.findByRole('radio', { name: /paste text/i }))
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'LHR CDG')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    await waitFor(() => expect(api.connect).toHaveBeenCalled())
    expect(screen.getByText('b1 processing viewed')).toBeInTheDocument()

    rerender(page(false))
    expect(signal.aborted).toBe(false)
    expect(screen.getByText('b1 processing docked')).toBeInTheDocument()
    act(() => notify({ name: 'rows', sequence: 2, rowIds: [], snapshot: false, reupload: false }))
    await waitFor(() => expect(screen.getByText('b1 ready docked')).toBeInTheDocument())
  })

  it('seeds only batches that are still being read', () => {
    const api: BatchApi = {
      readBatch: vi.fn(() => new Promise<Snapshot>(() => {})),
      connect: vi.fn(() => new Promise<void>(() => {})),
      submit: vi.fn(),
      sleep: vi.fn(async () => {}),
    }
    const store = new ImportRuns(api)
    const summary = (batchId: string, status: string) => ({
      batchId,
      status,
      sourceType: 'pdf',
      sourceLabel: `${batchId}.pdf`,
    })
    store.seed([
      summary('reading', 'processing'),
      summary('old-review', 'review'),
      summary('old-partial', 'partial'),
      summary('stopped', 'cancelled'),
    ])
    expect(store.getEntries().map((entry) => entry.run.batchId())).toEqual(['reading'])
    expect(api.readBatch).toHaveBeenCalledTimes(1)
    expect(api.readBatch).toHaveBeenCalledWith('reading', expect.anything())
  })
})
