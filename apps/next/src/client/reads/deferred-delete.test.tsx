// @vitest-environment jsdom
import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../../../web/src/lib/apiClient'
import { useDeferredDelete } from './deferred-delete'

vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { delete: vi.fn(), post: vi.fn() } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('defers deletion, pauses visible Undo time when hidden, and Undo cancels the write', async () => {
  vi.useFakeTimers()
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const committed = vi.fn()
  const { result } = renderHook(() => useDeferredDelete(committed))
  act(() => result.current.schedule([12]))
  act(() => vi.advanceTimersByTime(2000))
  expect(result.current.pending?.seconds).toBe(4)
  hidden = true; fireEvent(document, new Event('visibilitychange'))
  act(() => vi.advanceTimersByTime(20000))
  expect(result.current.pending?.seconds).toBe(4)
  expect(api.delete).not.toHaveBeenCalled()
  hidden = false; fireEvent(document, new Event('visibilitychange'))
  act(() => result.current.undo())
  act(() => vi.advanceTimersByTime(10000))
  expect(result.current.pending).toBeNull()
  expect(api.delete).not.toHaveBeenCalled()
})

it('unmount cancels an unsubmitted delete; a failed submitted delete restores IDs for retry', async () => {
  vi.useFakeTimers()
  vi.mocked(api.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ derived_state: 'ready' })
  const committed = vi.fn()
  const first = renderHook(() => useDeferredDelete(committed))
  act(() => first.result.current.schedule([1, 2]))
  first.unmount()
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(api.post).not.toHaveBeenCalled()
  const second = renderHook(() => useDeferredDelete(committed))
  act(() => second.result.current.schedule([1, 2]))
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(second.result.current.pending).toBeNull()
  expect(second.result.current.failed).toEqual([1, 2])
  act(() => second.result.current.schedule(second.result.current.failed!))
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(committed).toHaveBeenCalledWith({ derived_state: 'ready' }, [1, 2])
})


it('ignores a second pending schedule and reports the IDs actually submitted', async () => {
  vi.useFakeTimers()
  vi.mocked(api.delete).mockResolvedValueOnce({ derived_state: 'ready' })
  const committed = vi.fn()
  const { result } = renderHook(() => useDeferredDelete(committed))
  act(() => { result.current.schedule([4]); result.current.schedule([5]) })
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(api.delete).toHaveBeenLastCalledWith('/api/flights/4', expect.anything())
  expect(committed).toHaveBeenCalledWith({ derived_state: 'ready' }, [4])
})
