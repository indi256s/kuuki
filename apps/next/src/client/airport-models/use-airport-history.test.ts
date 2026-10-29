// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AirportHistory } from '@kuuki/shared/airportHistory'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { useAirportHistory } from './use-airport-history'

vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
afterEach(() => vi.unstubAllGlobals())

const first: AirportHistory = {
  ownerId: 'owner',
  revision: 1,
  publishedRevision: 1,
  scopeFingerprint: 'scope',
  derivedState: 'ready',
  status: 'ready',
  total: 2,
  items: [
    {
      id: 1,
      date: '2026-01-02',
      origin: 'TBS',
      destination: 'IST',
      airline: 'TK',
      flightNumber: '381',
      state: 'logged',
    },
  ],
  nextCursor: 'page-2',
}

it('keeps loaded history pageable after closing the panel during a pending next page', async () => {
  const fetchPage = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(first))
    .mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Panel closed', 'AbortError')),
          )
        }),
    )
    .mockResolvedValueOnce(
      Response.json({ ...first, items: [{ ...first.items[0]!, id: 2 }], nextCursor: null }),
    )
  vi.stubGlobal('fetch', fetchPage)
  const { result, rerender } = renderHook(
    ({ open }) => useAirportHistory('owner', 'TBS', null, open, false),
    { initialProps: { open: true } },
  )
  await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
  act(() => void result.current.more())
  await waitFor(() => expect(result.current.loading).toBe(true))
  rerender({ open: false })
  await waitFor(() => expect(result.current.loading).toBe(false))
  rerender({ open: true })
  expect(result.current.data?.items).toHaveLength(1)
  await act(() => result.current.more())
  expect(result.current.data?.items.map(({ id }) => id)).toEqual([1, 2])
  expect(result.current.data?.nextCursor).toBeNull()
})

it('remembers lifecycle invalidation while closed without discarding unchanged cached pages', async () => {
  let finish: ((response: Response) => void) | undefined
  const fetchPage = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(first))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
  vi.stubGlobal('fetch', fetchPage)
  const { result, rerender } = renderHook(
    ({ open }) => useAirportHistory('owner', 'TBS', null, open, false),
    { initialProps: { open: true } },
  )
  await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
  rerender({ open: false })
  rerender({ open: true })
  expect(result.current.data?.items).toHaveLength(1)
  expect(fetchPage).toHaveBeenCalledTimes(1)
  rerender({ open: false })
  act(() => window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT)))
  expect(fetchPage).toHaveBeenCalledTimes(1)
  rerender({ open: true })
  await waitFor(() => expect(result.current.updating).toBe(true))
  expect(result.current.data?.total).toBe(2)
  await act(async () =>
    finish?.(Response.json({ ...first, total: 3, revision: 2, publishedRevision: 2 })),
  )
  expect(result.current.data?.total).toBe(3)
  expect(result.current.updating).toBe(false)
})
