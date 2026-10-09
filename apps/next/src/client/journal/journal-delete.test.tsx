// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import { ToastProvider } from '../ui/toast'
import { JournalDeleteProvider, useJournalDelete } from './journal-delete'

vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))

function Actions() {
  const { scheduleDelete } = useJournalDelete()
  return <>
    <button type="button" onClick={() => scheduleDelete([1])}>Delete 1</button>
    <button type="button" onClick={() => scheduleDelete([2, 3])}>Delete 2 and 3</button>
  </>
}

function Harness({ refresh = async () => {} }: { refresh?: () => Promise<void> }) {
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  return <ToastProvider><JournalDeleteProvider locale="en" refresh={refresh}
    hide={ids => setHidden(old => new Set([...old, ...ids]))} unhide={ids => setHidden(old => new Set([...old].filter(id => !ids.includes(id))))}><main>
    <h1>Journal</h1>
    {[1, 2, 3].filter(id => !hidden.has(id)).map(id => <button key={id} type="button" data-flight-row={id}>Row {id}</button>)}
    <Actions />
  </main></JournalDeleteProvider></ToastProvider>
}

const setHiddenTab = (value: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })

beforeEach(() => {
  vi.useFakeTimers()
  setHiddenTab(false)
  vi.mocked(api.post).mockReset().mockResolvedValue({ deleted: 2, derived_state: 'ready' })
  vi.mocked(api.delete).mockReset().mockResolvedValue({ derived_state: 'ready' })
})
afterEach(() => { vi.useRealTimers(); setHiddenTab(false) })

describe('Journal deferred delete', () => {
  it('keeps one pending operation: a second delete commits the first at once and only the newest can be undone', async () => {
    const refresh = vi.fn(async () => {})
    render(<Harness refresh={refresh} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    expect(api.delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 and 3' }))
    expect(api.delete).toHaveBeenCalledWith('/api/flights/1', expect.anything())
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
    expect(api.post).toHaveBeenCalledWith('/api/flights/bulk-delete', { ids: [2, 3] }, expect.anything())
    expect(refresh).toHaveBeenCalled()
    expect(changed).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    window.removeEventListener('kuuki:lifecycle-changed', changed)
  })

  it('a failed delete brings the rows back with an error that offers to try again', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new TypeError('offline'))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }))
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    expect(screen.getByText('Could not delete 1 flight. It is back in the list.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })
})
