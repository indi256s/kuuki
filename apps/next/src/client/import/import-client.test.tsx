// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type { ConfirmResponse, Draft, ImportEvent, Snapshot } from './import-types'
import { draft, snapshot } from './fixtures'

const acknowledge = vi.fn()
const refresh = vi.fn()
const confirmItems = vi.fn()
const patchDraft = vi.fn()
const createFlights = vi.fn()
const cancelBatch = vi.fn(async () => ({ cancelled: true }))
const discardBatch = vi.fn(async () => ({ deleted: true }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge, status: 'idle' }) }))
vi.mock('../capture/flight-writes', () => ({
  createFlights: (...args: unknown[]) => createFlights(...args),
}))
vi.mock('../signature/stamp', () => ({ Stamp: () => null }))
vi.mock('./import-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./import-api')>()),
  confirmItems: (...args: unknown[]) => confirmItems(...args),
  cancelBatch: () => cancelBatch(),
  discardBatch: () => discardBatch(),
  patchDraft: (...args: unknown[]) => patchDraft(...args),
  listUnfinished: vi.fn(async () => []),
  fetchPressedCountries: vi.fn(async () => new Set<string>()),
  submitSource: vi.fn(),
  readBatch: vi.fn(),
}))

import { ImportClient } from './import-client'
import type { BatchApi } from './use-import-batch'

const ids = ['a', 'b', 'c']
function serverWith(drafts: Draft[]) {
  const state = { drafts }
  const api: BatchApi = {
    readBatch: vi.fn(async (): Promise<Snapshot> =>
      snapshot(state.drafts, { sequence: 5, expiresAt: '2026-11-04T12:00:00.000Z' }),
    ),
    connect: vi.fn(async () => {}),
    submit: vi.fn(),
    sleep: vi.fn(async () => {}),
  }
  return { state, api }
}
const response = (results: ConfirmResponse['results'], derived = true): ConfirmResponse => ({
  results,
  batch: { id: 'b1', status: 'review', sequence: 6, reviewRowCount: 0 },
  ...(derived ? { derived_state: 'ready' as const, revision: 9 } : {}),
})
const created = (d: { draftId: string; version: number }) => ({
  draftId: d.draftId,
  key: `import:${d.draftId}:${d.version}`,
  status: 'created' as const,
  flight: { id: 100, aircraft_icao: null, origin: 'JFK', destination: 'BOS', date: '2026-03-01' },
})
const failed = (d: { draftId: string; version: number }) => ({
  draftId: d.draftId,
  key: `import:${d.draftId}:${d.version}`,
  status: 'error' as const,
  http_status: 500,
  code: 'INTERNAL',
  error: 'x',
})

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  acknowledge.mockReset()
  refresh.mockReset()
  confirmItems.mockReset()
  patchDraft.mockReset()
  createFlights.mockReset()
  createFlights.mockResolvedValue([])
  window.history.replaceState(null, '', '/import')
})

describe('ImportClient journeys', () => {
  it.each(['failed', 'verified'] as const)(
    'keeps a %s model row unchecked after answering a field question',
    async (verification) => {
      const row = draft({
        id: 'question',
        selected: false,
        fields: {
          date: '2026-03-01',
          origin: 'JFK',
          destination: 'BOS',
          airline_iata: 'ZZ',
          airline_was_placeholder: true,
          verification,
        },
      })
      const { api } = serverWith([row])
      patchDraft.mockResolvedValue({
        ...row,
        fields: { ...row.fields, airline_iata: undefined, verification: 'not_verified' },
        version: 2,
      })
      render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Save without airline' }))
      await waitFor(() => expect(patchDraft).toHaveBeenCalled())
      expect(patchDraft.mock.calls[0][1]).toEqual({
        fields: { airline_iata: null },
        version: 1,
      })
      expect(screen.getByRole('checkbox', { name: /include in import/i })).not.toBeChecked()
    },
  )

  it('explains an unverified draft and lets the member select it for review', async () => {
    const row = draft({
      id: 'unverified',
      selected: false,
      fields: {
        date: '2026-03-01',
        origin: 'JFK',
        destination: 'BOS',
        airline_iata: 'AA',
        verification: 'failed',
      },
    })
    const { api } = serverWith([row])
    patchDraft.mockResolvedValue({ ...row, selected: true, version: 2 })
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    const note = await screen.findByText(/not verified against the source/i)
    const checkbox = screen.getByRole('checkbox', { name: /include in import/i })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAccessibleDescription(note.textContent!)
    await userEvent.click(checkbox)
    await waitFor(() =>
      expect(patchDraft).toHaveBeenCalledWith(
        'unverified',
        expect.objectContaining({ selected: true, version: 1 }),
      ),
    )
  })

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
    confirmItems.mockImplementationOnce(
      async (_batch: string, items: Array<{ draftId: string; version: number }>) => {
        for (const item of items)
          if (item.draftId !== 'b')
            server.state.drafts = server.state.drafts.map((row) =>
              row.id === item.draftId
                ? { ...row, status: 'converted', convertedFlightId: 100 }
                : row,
            )
        return response(items.map((item) => (item.draftId === 'b' ? failed(item) : created(item))))
      },
    )
    confirmItems.mockImplementationOnce(
      async (_batch: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = server.state.drafts.map((row) =>
          items.some((item) => item.draftId === row.id)
            ? { ...row, status: 'converted', convertedFlightId: 100 }
            : row,
        )
        return response(items.map(created))
      },
    )
    const onResult = vi.fn()
    render(
      <ImportClient
        ownerId="u1"
        locale="en"
        initialBatchId="b1"
        batchApi={server.api}
        onResult={onResult}
      />,
    )
    await user.click(await screen.findByRole('button', { name: /import 3/i }))
    expect(
      await screen.findByRole('heading', { name: /some flights were not saved/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 2 of 3')
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'import:u1:b1',
          flightIds: [100, 100],
          savedCount: 2,
          publication: 'idle',
          newCodes: null,
        }),
      ),
    )
    expect(confirmItems.mock.calls[0][1]).toEqual([
      { draftId: 'a', version: 2 },
      { draftId: 'b', version: 2 },
      { draftId: 'c', version: 2 },
    ])
    expect(acknowledge).toHaveBeenCalledTimes(1) // a partial success still refreshes the freshness owners
    const failedList = screen.getByRole('heading', { name: 'Not saved' }).parentElement!
    expect(within(failedList).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Try again for 1' }))
    await waitFor(() => expect(confirmItems).toHaveBeenCalledTimes(2))
    expect(confirmItems.mock.calls[1][1]).toEqual([{ draftId: 'b', version: 2 }])
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('3 flights added')
    expect(acknowledge).toHaveBeenCalledTimes(2)
  })

  it('refreshes the route itself when the answer carries no derived state', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = [{ ...server.state.drafts[0], status: 'converted' }]
        return response(items.map(created), false)
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(refresh).toHaveBeenCalled()
  })

  it('refreshes the route on a pending answer, so a Passport prefetched before the write is dropped', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = [{ ...server.state.drafts[0], status: 'converted' }]
        return {
          ...response(items.map(created), false),
          derived_state: 'pending' as const,
          revision: 10,
        }
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ derived_state: 'pending', revision: 10 }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('leaves a ready answer to the write feedback, which refreshes once publication is known', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = [{ ...server.state.drafts[0], status: 'converted' }]
        return response(items.map(created))
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ derived_state: 'ready' }))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('treats a lost answer as uncertain until the stored snapshot says otherwise', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' }), draft({ id: 'b', ordinal: 1 })])
    confirmItems.mockImplementationOnce(async () => {
      server.state.drafts = server.state.drafts.map((row) =>
        row.id === 'a' ? { ...row, status: 'converted' as const } : row,
      ) // saved, but the response was lost
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
    const api: BatchApi = {
      readBatch: vi.fn(),
      connect: vi.fn(),
      sleep: vi.fn(),
      submit: vi.fn(async () => {
        throw quota
      }),
    }
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
    const api: BatchApi = {
      readBatch: vi.fn(async () =>
        snapshot([], { status: 'processing', stage: 'recognizing', sequence: 2 }),
      ),
      connect: () => new Promise(() => {}),
      sleep: vi.fn(),
      submit: vi.fn(),
    }
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(cancelBatch).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: /find flights/i })).toBeInTheDocument()
  })
})

const importButton = (name: RegExp) => screen.findByRole('button', { name })
const typedDestination = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  await user.click(screen.getAllByText('Edit')[0])
  const field = screen.getAllByLabelText(/^To \(airport code\)/)[0]
  await user.clear(field)
  await user.type(field, value)
}

describe('I1 typed corrections gate the import', () => {
  it('blocks the import and arms the leave warning while a correction is typed but not saved, and keeps it across a selection save', async () => {
    const user = userEvent.setup()
    const server = serverWith(ids.map((id, ordinal) => draft({ id, ordinal })))
    patchDraft.mockImplementation(
      async (
        id: string,
        body: { version: number; selected?: boolean; fields?: Record<string, string> },
      ) => {
        const stored = server.state.drafts.find((row) => row.id === id)!
        return {
          ...stored,
          version: body.version + 1,
          selected: body.selected ?? stored.selected,
          fields: { ...stored.fields, ...body.fields },
        }
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await importButton(/import 3/i)
    await typedDestination(user, 'LAX')
    const bar = screen.getByRole('region', { name: /import actions/i })
    expect(within(bar).getByRole('button', { name: /import 3/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(bar).getByText(/some edits are not saved yet/i)).toBeInTheDocument()
    const leave = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leave)
    expect(leave.defaultPrevented).toBe(true)

    // An unrelated selection change returns a newer version of the same draft; the typed text stays.
    await user.click(screen.getAllByRole('checkbox', { name: /include in import/i })[1])
    await waitFor(() => expect(patchDraft).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getAllByLabelText(/^To \(airport code\)/)[0]).toHaveValue('LAX'),
    )
    expect(confirmItems).not.toHaveBeenCalled()

    await user.click(screen.getAllByRole('button', { name: /save changes/i })[0])
    await waitFor(() => expect(patchDraft).toHaveBeenCalledTimes(2))
    expect(patchDraft.mock.calls[1][1]).toMatchObject({ fields: { destination: 'LAX' } })
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: /import actions/i })).getByRole('button', {
          name: /import 2/i,
        }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    )
    const after = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })
})

describe('I2 a discarded import leaves no edit state behind', () => {
  it('failed edit, discard the import, start another: the new review can be confirmed', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    const next = snapshot(
      [
        draft({
          id: 'x',
          fields: { date: '2026-05-01', origin: 'LHR', destination: 'CDG', airline_iata: 'BA' },
        }),
      ],
      { id: 'b2', sequence: 1 },
    )
    server.api.submit = vi.fn(async () => next)
    patchDraft.mockRejectedValue(new ApiError(503, 'down', 'INTERNAL'))
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) =>
        response(items.map(created)),
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('checkbox', { name: /include in import/i }))
    expect(await screen.findByText(/some edits are not saved yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^discard import$/i }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^discard import$/i }),
    )
    await user.click(await screen.findByRole('radio', { name: /paste text/i }))
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'LHR CDG')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    const confirm = await importButton(/import 1/i)
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(confirm)
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
  })
})

describe('I3 retrying a stored failure uses a new operation id', () => {
  const failedSnap = () =>
    snapshot([], { id: 'bf', status: 'failed', stage: null, errorCode: 'MODEL_UNAVAILABLE' })
  const reviewSnap = () => snapshot([draft({ id: 'a' })], { id: 'bg' })

  it('replays the stored failure under the old id, so the retry sends a fresh one', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    const api: BatchApi = {
      readBatch: vi.fn(),
      connect: vi.fn(),
      sleep: vi.fn(),
      submit: vi.fn(async (_source, operationId: string) => {
        seen.push(operationId)
        return seen.length === 1 || seen.slice(0, -1).includes(operationId)
          ? failedSnap()
          : reviewSnap()
      }),
    }
    render(<ImportClient ownerId="u1" locale="en" batchApi={api} initialSource="text" />)
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'JFK BOS')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: /review flights/i })).toBeInTheDocument()
    expect(seen).toHaveLength(2)
    expect(seen[1]).not.toBe(seen[0])
  })

  it('keeps the same id while the outcome is unknown (the request was lost)', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    const api: BatchApi = {
      readBatch: vi.fn(),
      connect: vi.fn(),
      sleep: vi.fn(),
      submit: vi.fn(async (_source, operationId: string) => {
        seen.push(operationId)
        if (seen.length === 1) throw new TypeError('Failed to fetch')
        return reviewSnap()
      }),
    }
    render(<ImportClient ownerId="u1" locale="en" batchApi={api} initialSource="text" />)
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'JFK BOS')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: /review flights/i })
    expect(seen[1]).toBe(seen[0])
  })

  it('after a reload the source is gone: it asks for it again instead of replaying the stored failure', async () => {
    const user = userEvent.setup()
    const api: BatchApi = {
      readBatch: vi.fn(async () => failedSnap()),
      connect: vi.fn(),
      sleep: vi.fn(),
      submit: vi.fn(),
    }
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="bf" batchApi={api} />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/choose the file or paste the text again/i)).toBeInTheDocument()
    expect(api.submit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /find flights/i })).toBeInTheDocument()
  })
})

describe('I4 cancelled batches keep their rows', () => {
  it.each(['success', 'failure'] as const)(
    'keeps a new processing import after an old cancellation answers late: %s',
    async (outcome) => {
      const user = userEvent.setup()
      const processingA = snapshot([draft({ id: 'a' })], {
        id: 'b1',
        status: 'processing',
        stage: 'recognizing',
        sequence: 2,
      })
      const cancelledA = snapshot([draft({ id: 'a' })], {
        id: 'b1',
        status: 'cancelled',
        sequence: 3,
      })
      const processingB = snapshot(
        [
          draft({
            id: 'x',
            fields: { date: '2026-05-01', origin: 'LHR', destination: 'CDG', airline_iata: 'BA' },
          }),
        ],
        { id: 'b2', status: 'processing', stage: 'recognizing', sequence: 1 },
      )
      let notifyA!: (event: ImportEvent) => void
      let finishCancel!: (value: { cancelled: boolean }) => void
      let rejectCancel!: (reason: Error) => void
      let reads = 0
      cancelBatch.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finishCancel = resolve
            rejectCancel = reject
          }),
      )
      const api: BatchApi = {
        readBatch: vi.fn(async (id) =>
          id === 'b2' ? processingB : ++reads === 1 ? processingA : cancelledA,
        ),
        connect: vi.fn(async (id, _after, onEvent) => {
          if (id === 'b1') notifyA = onEvent
          await new Promise<void>(() => {})
        }),
        sleep: vi.fn(async () => {}),
        submit: vi.fn(async () => processingB),
      }
      render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
      await waitFor(() => expect(api.connect).toHaveBeenCalled())
      await user.click(screen.getByRole('button', { name: /^cancel$/i }))
      await waitFor(() => expect(cancelBatch).toHaveBeenCalled())
      act(() =>
        notifyA({
          name: 'end',
          sequence: 3,
          rowIds: [],
          snapshot: false,
          reupload: false,
          status: 'cancelled',
        }),
      )
      await screen.findByRole('heading', { name: /partial result/i })
      await user.click(screen.getByRole('button', { name: /^discard import$/i }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: /^discard import$/i,
        }),
      )
      await user.click(await screen.findByRole('radio', { name: /paste text/i }))
      await user.type(screen.getByLabelText(/booking or itinerary text/i), 'LHR CDG')
      await user.click(screen.getByRole('button', { name: /find flights/i }))
      await screen.findByText('LHR → CDG')
      expect(window.location.search).toBe('?batch=b2')

      await act(async () => {
        if (outcome === 'failure') rejectCancel(new Error('old cancellation failed'))
        else finishCancel({ cancelled: true })
      })
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeEnabled()
      expect(screen.queryByText('Could not cancel. Try again.')).not.toBeInTheDocument()
      expect(window.location.search).toBe('?batch=b2')
      expect(screen.getByText('LHR → CDG')).toBeInTheDocument()
      expect(screen.queryByText('JFK → BOS')).not.toBeInTheDocument()
    },
  )

  it('cancel after one extracted row shows that row as a stopped review', async () => {
    const user = userEvent.setup()
    const reads = [
      snapshot([draft({ id: 'a' })], { status: 'processing', stage: 'recognizing', sequence: 2 }),
      snapshot([draft({ id: 'a' })], { status: 'cancelled', sequence: 3 }),
    ]
    const api: BatchApi = {
      readBatch: vi.fn(async () => (reads.length > 1 ? reads.shift()! : reads[0])),
      connect: () => new Promise(() => {}),
      sleep: vi.fn(),
      submit: vi.fn(),
    }
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
    expect(await screen.findByRole('heading', { name: /partial result/i })).toBeInTheDocument()
    expect(screen.getByText(/you cancelled recognition/i)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: /include in import/i })).toHaveLength(1)
  })

  it('resuming a cancelled batch URL shows its rows', async () => {
    const api: BatchApi = {
      readBatch: vi.fn(async () => snapshot([draft({ id: 'a' })], { status: 'cancelled' })),
      connect: vi.fn(),
      sleep: vi.fn(),
      submit: vi.fn(),
    }
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    expect(await screen.findByRole('heading', { name: /partial result/i })).toBeInTheDocument()
    expect(api.connect).not.toHaveBeenCalled()
  })
})

describe('I5 confirmed saves survive a failed follow-up read', () => {
  it('reports the saved flights even when the snapshot read after the confirm fails', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.api.readBatch = vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        })
        return response(items.map(created))
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await importButton(/import 1/i))
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('1 flight added')
    expect(screen.getByRole('alert')).toHaveTextContent(/could not confirm what was saved/i)
    expect(screen.queryByText(/still in review/i)).not.toBeInTheDocument()
  })
})

describe('I6 the requested total counts each row once', () => {
  it('a row that fails twice is still one of two', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' }), draft({ id: 'b', ordinal: 1 })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = server.state.drafts.map((row) =>
          row.id === 'a' ? { ...row, status: 'converted' as const, convertedFlightId: 100 } : row,
        )
        return response(items.map((item) => (item.draftId === 'b' ? failed(item) : created(item))))
      },
    )
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) =>
        response(items.map(failed)),
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await importButton(/import 2/i))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 1 of 2')
    await user.click(screen.getByRole('button', { name: 'Try again for 1' }))
    await waitFor(() => expect(confirmItems).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Try again for 1' })).toBeEnabled(),
    )
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 1 of 2')
  })
})

const manualRow = () => screen.getByText('Flight added by hand').closest('li')!
async function fillManual(user: ReturnType<typeof userEvent.setup>, route: [string, string]) {
  const row = within(manualRow())
  await user.type(row.getByLabelText(/^Date/), '2026-03-01')
  await user.type(row.getByLabelText(/^From \(airport code\)/), route[0])
  await user.type(row.getByLabelText(/^To \(airport code\)/), route[1])
}

describe('I7 manual flights keep their cause and receipt', () => {
  it('preserves an independently failed same-route flight after its sibling saves', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a', selected: false })])
    createFlights.mockResolvedValueOnce([null, new ApiError(503, 'down', 'DOWN')])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    for (let index = 0; index < 2; index++) {
      await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
      const row = within(screen.getAllByText('Flight added by hand')[index].closest('li')!)
      await user.type(row.getByLabelText(/^Date/), '2026-03-01')
      await user.type(row.getByLabelText(/^From \(airport code\)/), 'JFK')
      await user.type(row.getByLabelText(/^To \(airport code\)/), 'BOS')
    }
    await user.click(screen.getByRole('button', { name: /import 2/i }))
    expect(
      await screen.findByRole('heading', { name: /some flights were not saved/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again for 1' })).toBeInTheDocument()
    createFlights.mockResolvedValueOnce([null])
    await user.click(screen.getByRole('button', { name: 'Try again for 1' }))
    await screen.findByRole('heading', { name: /import finished/i })
    expect(createFlights.mock.calls[1][1]).toHaveLength(1)
    expect(createFlights.mock.calls[1][1][0].operationId).toBe(
      createFlights.mock.calls[0][1][1].operationId,
    )
  })

  it('a refusal says what to fix, and the corrected row saves under a new operation', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a', selected: false })])
    createFlights.mockResolvedValueOnce([new ApiError(400, 'bad', 'INVALID_FLIGHT')])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
    await fillManual(user, ['JFK', 'BOS'])
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    expect(screen.getByText(/the service refused these details/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back to review/i }))
    expect(screen.getByText(/the service refused these details/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry original save/i })).not.toBeInTheDocument()
    await user.clear(within(manualRow()).getByLabelText(/^To \(airport code\)/))
    await user.type(within(manualRow()).getByLabelText(/^To \(airport code\)/), 'LAX')
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await waitFor(() => expect(createFlights).toHaveBeenCalledTimes(2))
    const [first, second] = createFlights.mock.calls.map(
      (call) => (call[1] as Array<{ operationId: string }>)[0].operationId,
    )
    expect(second).not.toBe(first)
  })

  it('a lost answer is shown as uncertain and the original save is retried under the same operation', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a', selected: false })])
    createFlights.mockResolvedValueOnce([new TypeError('Failed to fetch')])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
    await fillManual(user, ['JFK', 'BOS'])
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    expect(screen.getByText(/may or may not be saved/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again for 1' }))
    await waitFor(() => expect(createFlights).toHaveBeenCalledTimes(2))
    const [first, second] = createFlights.mock.calls.map(
      (call) => (call[1] as Array<{ operationId: string }>)[0].operationId,
    )
    expect(second).toBe(first)
  })
})

describe('N2 manual recovery goes through the same unsaved-correction gate', () => {
  it('Retry original save is blocked with a visible reason while a typed correction is unsaved, and works once it is saved', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a', selected: false })])
    patchDraft.mockImplementation(
      async (id: string, body: { version: number; fields?: Record<string, string> }) => {
        const stored = server.state.drafts.find((row) => row.id === id)!
        return {
          ...stored,
          version: body.version + 1,
          fields: { ...stored.fields, ...body.fields },
        }
      },
    )
    createFlights.mockResolvedValueOnce([new TypeError('Failed to fetch')])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
    await fillManual(user, ['JFK', 'BOS'])
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    await user.click(screen.getByRole('button', { name: /back to review/i }))

    await typedDestination(user, 'LAX')
    const retry = within(manualRow()).getByRole('button', { name: /retry original save/i })
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(within(manualRow()).getByText(/some edits are not saved yet/i)).toBeInTheDocument()
    await user.click(retry)
    expect(createFlights).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /review flights/i })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^To \(airport code\)/)[0]).toHaveValue('LAX')

    await user.click(screen.getAllByRole('button', { name: /save changes/i })[0])
    await waitFor(() => expect(patchDraft).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        within(manualRow()).getByRole('button', { name: /retry original save/i }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    )
    createFlights.mockResolvedValueOnce([null])
    await user.click(within(manualRow()).getByRole('button', { name: /retry original save/i }))
    await waitFor(() => expect(createFlights).toHaveBeenCalledTimes(2))
    const [first, second] = createFlights.mock.calls.map(
      (call) => (call[1] as Array<{ operationId: string }>)[0].operationId,
    )
    expect(second).toBe(first)
  })
})

describe('N2 the review is frozen while a save is in flight', () => {
  async function holdManualReplay(user: ReturnType<typeof userEvent.setup>) {
    const server = serverWith([draft({ id: 'a', selected: false })])
    patchDraft.mockImplementation(
      async (id: string, body: { version: number; fields?: Record<string, string> }) => {
        const stored = server.state.drafts.find((row) => row.id === id)!
        server.state.drafts = server.state.drafts.map((row) =>
          row.id === id
            ? { ...row, version: body.version + 1, fields: { ...row.fields, ...body.fields } }
            : row,
        )
        return {
          ...stored,
          version: body.version + 1,
          fields: { ...stored.fields, ...body.fields },
        }
      },
    )
    createFlights.mockResolvedValueOnce([new TypeError('Failed to fetch')])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
    await fillManual(user, ['JFK', 'BOS'])
    await user.click(screen.getByRole('button', { name: /import 1/i }))
    await screen.findByRole('heading', { name: /some flights were not saved/i })
    await user.click(screen.getByRole('button', { name: /back to review/i }))
    let release: (value: Array<Error | null>) => void = () => {}
    createFlights.mockReturnValueOnce(
      new Promise<Array<Error | null>>((resolve) => {
        release = resolve
      }),
    )
    await user.click(within(manualRow()).getByRole('button', { name: /retry original save/i }))
    await screen.findAllByText(/editing is paused until it finishes/i)
    return { release }
  }

  it('pauses draft corrections and selection with a visible reason, and nothing is lost when Done opens', async () => {
    const user = userEvent.setup()
    const { release } = await holdManualReplay(user)
    await user.click(screen.getAllByText('Edit')[0])
    expect(screen.getAllByLabelText(/^To \(airport code\)/)[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /save changes/i })[0]).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('checkbox', { name: /include in import/i })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /select all/i })).toBeDisabled()
    release([null])
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
    expect(patchDraft).not.toHaveBeenCalled()
  })

  it('keeps a correction that slipped in during the save: Done waits until it is saved', async () => {
    const user = userEvent.setup()
    const { release } = await holdManualReplay(user)
    await user.click(screen.getAllByText('Edit')[0])
    // A change event reaches the form despite the pause (for example from autofill): the review must not close over it.
    fireEvent.change(screen.getAllByLabelText(/^To \(airport code\)/)[0], {
      target: { value: 'LAX' },
    })
    release([null])
    expect(await screen.findByText(/some corrections are not saved yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /import finished/i })).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^To \(airport code\)/)[0]).toHaveValue('LAX')
    await user.click(screen.getAllByRole('button', { name: /save changes/i })[0])
    await waitFor(() => expect(patchDraft).toHaveBeenCalledTimes(1))
    expect(patchDraft.mock.calls[0][1]).toMatchObject({ fields: { destination: 'LAX' } })
    expect(await screen.findByRole('heading', { name: /import finished/i })).toBeInTheDocument()
  })
})

describe('I9 and I10 the way back and the deadline', () => {
  it('after saving a subset, Done offers the remaining rows again', async () => {
    const user = userEvent.setup()
    const server = serverWith([draft({ id: 'a' }), draft({ id: 'b', ordinal: 1, selected: false })])
    confirmItems.mockImplementationOnce(
      async (_b: string, items: Array<{ draftId: string; version: number }>) => {
        server.state.drafts = server.state.drafts.map((row) =>
          row.id === 'a' ? { ...row, status: 'converted' as const, convertedFlightId: 100 } : row,
        )
        return response(items.map(created))
      },
    )
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={server.api} />)
    await user.click(await importButton(/import 1/i))
    await screen.findByRole('heading', { name: /import finished/i })
    await user.click(screen.getByRole('button', { name: /1 still in review/i }))
    expect(await screen.findByRole('heading', { name: /review flights/i })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: /include in import/i })).toHaveLength(1)
  })

  it('a resumed review shows the stored deadline', async () => {
    const { api } = serverWith([draft({ id: 'a' })])
    render(<ImportClient ownerId="u1" locale="en" initialBatchId="b1" batchApi={api} />)
    expect(await screen.findByTestId('import-retention')).toHaveTextContent(
      'Kept until Nov 4, 2026.',
    )
  })
})

it('exposes the existing bulk acknowledgement canonical manual flight to a hosted result', async () => {
  const user = userEvent.setup(),
    onResult = vi.fn()
  const server = serverWith([])
  const canonical = {
    id: 66,
    date: '2026-03-01',
    origin: 'JFK',
    destination: 'BOS',
    is_upcoming: false,
    lifecycle_state: 'logged',
  }
  createFlights.mockImplementation(
    async (_owner: string, _entries: unknown[], notify: (ack: object, count: number) => void) => {
      notify(
        {
          derived_state: 'ready',
          revision: 9,
          results: [{ status: 'created', flight: canonical }],
        },
        1,
      )
      return [null]
    },
  )
  render(
    <ImportClient
      ownerId="u1"
      locale="en"
      initialBatchId="b1"
      batchApi={server.api}
      onResult={onResult}
    />,
  )
  await user.click(await screen.findByRole('button', { name: /add a flight manually/i }))
  const row = within(manualRow())
  await user.type(row.getByLabelText(/^From \(airport code\)/), 'JFK')
  await user.type(row.getByLabelText(/^To \(airport code\)/), 'BOS')
  await user.type(row.getByLabelText(/^Date$/), '2026-03-01')
  await user.click(await importButton(/import 1/i))
  await waitFor(() =>
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ savedCount: 1, flights: [{ ...canonical, user_id: 'u1' }] }),
    ),
  )
})
