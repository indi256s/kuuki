// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@kuuki/client/apiClient'
import { ToastProvider } from '../ui/toast'
import { JournalDeleteProvider, useJournalDelete } from './journal-delete'

vi.mock('@kuuki/client/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))

function Actions() {
  const { scheduleDelete } = useJournalDelete()
  return (
    <>
      <button type="button" onClick={() => scheduleDelete([1])}>
        Delete 1
      </button>
      <button type="button" onClick={() => scheduleDelete([2, 3])}>
        Delete 2 and 3
      </button>
    </>
  )
}

function Harness({
  refresh = async () => {},
  read,
  ownerId = 'owner',
}: {
  refresh?: (options?: { throwOnError?: boolean }) => Promise<void>
  ownerId?: string
  read?: () => Promise<number[]>
}) {
  const [rows, setRows] = useState([1, 2, 3])
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  return (
    <ToastProvider>
      <JournalDeleteProvider
        locale="en"
        key={ownerId}
        ownerId={ownerId}
        refresh={async (options) => {
          await refresh(options)
          if (read) setRows(await read())
        }}
        hide={(ids) => setHidden((old) => new Set([...old, ...ids]))}
        unhide={(ids) => setHidden((old) => new Set([...old].filter((id) => !ids.includes(id))))}
      >
        <main>
          <h1>Journal</h1>
          {rows
            .filter((id) => !hidden.has(id))
            .map((id) => (
              <button key={id} type="button" data-flight-row={id}>
                Row {id}
              </button>
            ))}
          <Actions />
        </main>
      </JournalDeleteProvider>
    </ToastProvider>
  )
}

const setHiddenTab = (value: boolean) =>
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })

beforeEach(() => {
  sessionStorage.clear()
  vi.useFakeTimers()
  setHiddenTab(false)
  vi.mocked(api.post).mockReset().mockResolvedValue({ deleted: 2, derived_state: 'ready' })
  vi.mocked(api.delete).mockReset().mockResolvedValue({ derived_state: 'ready' })
})
afterEach(() => {
  vi.useRealTimers()
  setHiddenTab(false)
})

describe('Journal deferred delete', () => {
  it('keeps one pending operation: a second delete commits the first at once and only the newest can be undone', async () => {
    const refresh = vi.fn(async () => {})
    render(<Harness refresh={refresh} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    expect(api.delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 and 3' }))
    expect(api.delete).toHaveBeenCalledWith(
      '/api/flights/1',
      undefined,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    expect(screen.getByText('2 flights are being deleted.')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(refresh).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Row 2')).toHaveFocus()
    expect(screen.getByText('Row 3')).toBeInTheDocument()
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(api.post).not.toHaveBeenCalled()
    expect(api.delete).toHaveBeenCalledTimes(1)
  })

  it('sends after six visible seconds, pausing while the tab is hidden, then refreshes and announces the change', async () => {
    const refresh = vi.fn(async () => {})
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    render(<Harness refresh={refresh} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 and 3' }))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    setHiddenTab(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(api.post).not.toHaveBeenCalled()
    setHiddenTab(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await act(() => vi.advanceTimersByTimeAsync(3900))
    expect(api.post).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(200))
    expect(api.post).toHaveBeenCalledWith(
      '/api/flights/bulk-delete',
      { ids: [2, 3] },
      expect.anything(),
    )
    expect(refresh).toHaveBeenCalled()
    expect(changed).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    window.removeEventListener('kuuki:lifecycle-changed', changed)
  })

  it('a rejected delete brings the rows back with an error that offers to try again', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new ApiError(403, 'Forbidden'))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    expect(screen.getByText('Could not delete 1 flight. Try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })
})

it('a lost committed DELETE and a retry returning 404 reconcile the server list before restoring rows', async () => {
  let serverRows = [1, 2, 3]
  const refresh = vi.fn(async () => {})
  vi.mocked(api.delete)
    .mockImplementationOnce(async () => {
      serverRows = [2, 3]
      throw new TypeError('answer lost')
    })
    .mockRejectedValueOnce(new ApiError(404, 'Flight not found'))
  render(<Harness refresh={refresh} read={async () => serverRows} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  expect(refresh).toHaveBeenCalledWith({ throwOnError: true })
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(
    screen.getByText(
      'Could not check whether the flights were deleted. Check the list before trying again.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
})

it('a failed reconciliation keeps uncertain rows hidden and its retry reads without deleting again', async () => {
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValue(undefined)
  vi.mocked(api.delete).mockRejectedValueOnce(new TypeError('answer lost'))
  render(<Harness refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(
    screen.getByText(
      'Could not check whether the flights were deleted. Refresh the list before trying again.',
    ),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Row 1')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(api.delete).toHaveBeenCalledTimes(1)
})

it('passes the single-delete signal as transport options and aborts it when the page unmounts', async () => {
  let signal: AbortSignal | undefined
  vi.mocked(api.delete).mockImplementation(
    (_path, _body, options) =>
      new Promise((_resolve, reject) => {
        signal = options?.signal
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        })
      }),
  )
  const refresh = vi.fn(async () => {})
  const view = render(<Harness refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  expect(signal?.aborted).toBe(false)
  view.unmount()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(signal?.aborted).toBe(true)
  expect(refresh).not.toHaveBeenCalled()
})

it('does not restore rows or announce an uncertain result after an identity reset', async () => {
  let finish: (() => void) | undefined
  const refresh = () =>
    new Promise<void>((resolve) => {
      finish = resolve
    })
  vi.mocked(api.delete).mockRejectedValueOnce(new TypeError('answer lost'))
  render(<Harness refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  window.dispatchEvent(new Event('kuuki:identity-reset'))
  await act(async () => {
    finish?.()
  })
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(screen.queryByText(/Could not check whether/)).not.toBeInTheDocument()
})

it('resumes a pending deletion after a document reload instead of restoring the flight', async () => {
  let serverRows = [1, 2, 3]
  vi.mocked(api.delete).mockImplementation(async () => {
    serverRows = [2, 3]
    return { derived_state: 'ready' }
  })
  const view = render(<Harness read={async () => serverRows} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(2000))
  window.dispatchEvent(new Event('pagehide'))
  view.unmount()
  render(
    <StrictMode>
      <Harness read={async () => serverRows} />
    </StrictMode>,
  )
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(4100))
  expect(serverRows).toEqual([2, 3])
  expect(api.delete).toHaveBeenCalledTimes(1)
})

it('Undo after reload clears the deletion so another reload cannot send it', async () => {
  const view = render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 2 and 3' }))
  window.dispatchEvent(new Event('pagehide'))
  view.unmount()
  const restored = render(<Harness />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(screen.getByText('Row 2')).toBeInTheDocument()
  window.dispatchEvent(new Event('pagehide'))
  restored.unmount()
  render(<Harness />)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(api.post).not.toHaveBeenCalled()
})

it('reconciles an interrupted committed request after reload without deleting again', async () => {
  let serverRows = [1, 2, 3]
  vi.mocked(api.delete).mockImplementation(() => {
    serverRows = [2, 3]
    return new Promise(() => {})
  })
  const view = render(<Harness read={async () => serverRows} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  await act(() => vi.advanceTimersByTimeAsync(6100))
  window.dispatchEvent(new Event('pagehide'))
  view.unmount()
  const refresh = vi.fn(async () => {})
  render(<Harness refresh={refresh} read={async () => serverRows} />)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(refresh).toHaveBeenCalledWith({ throwOnError: true })
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(api.delete).toHaveBeenCalledTimes(1)
})

it("does not resume another owner's deletion and clears the departing owner on identity reset", async () => {
  const view = render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
  window.dispatchEvent(new Event('pagehide'))
  view.unmount()
  const other = render(<Harness ownerId="other" />)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(api.delete).not.toHaveBeenCalled()
  expect(screen.getByText('Row 1')).toBeInTheDocument()
  other.unmount()
  const restored = render(<Harness />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  restored.unmount()
  render(<Harness />)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(api.delete).not.toHaveBeenCalled()
  expect(screen.getByText('Row 1')).toBeInTheDocument()
})
