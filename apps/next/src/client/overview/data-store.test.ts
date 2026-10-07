// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import fixture from '../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { attachRevalidation, createOverviewDataStore, scopeFor } from './data-store'

const initial = fixture as OverviewPayload
const updated = { ...initial, etag: 'W/"ov3-fixture-2-1"', rows: initial.rows.slice(0, 1) }
const response = (payload: OverviewPayload) => new Response(JSON.stringify(payload), { status: 200 })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('304 keeps payload without reading a body or notifying', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }))
  const store = createOverviewDataStore(initial, fetcher)
  const notified = vi.fn()
  store.subscribe(notified)
  expect(await store.revalidate()).toBe('unchanged')
  expect(store.get()).toBe(initial)
  expect(notified).not.toHaveBeenCalled()
  const [url, options] = fetcher.mock.calls[0]
  expect(url).toBe('/api/me/overview/data')
  expect(options?.credentials).toBe('same-origin')
  expect(options?.cache).toBe('no-store')
  expect(new Headers(options?.headers).get('If-None-Match')).toBe(initial.etag)
})

it('v3 refresh replaces and notifies; unsubscribe stops notifications', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(updated))
  const store = createOverviewDataStore(initial, fetcher)
  const notified = vi.fn(() => expect(store.get()?.etag).toBe(updated.etag))
  const unsubscribe = store.subscribe(notified)
  expect(await store.revalidate()).toBe('updated')
  expect(store.get()).toEqual(updated)
  expect(store.get()?.schemaVersion).toBe(3)
  expect(notified).toHaveBeenCalledTimes(1)
  unsubscribe()
  await store.revalidate()
  expect(notified).toHaveBeenCalledTimes(1)
  expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('If-None-Match')).toBe(updated.etag)
})

it('an empty store loads its first payload without a conditional header', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(initial))
  const store = createOverviewDataStore(null, fetcher)
  expect(scopeFor(store, {})).toBeNull()
  expect(await store.revalidate()).toBe('updated')
  expect(store.get()).toEqual(initial)
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('If-None-Match')).toBe(false)
})

it.each(['network', 'http', 'invalid json'])('failure keeps payload and subscribers unchanged: %s', async kind => {
  const fetcher = vi.fn<typeof fetch>()
  if (kind === 'network') fetcher.mockRejectedValue(new Error('offline'))
  else fetcher.mockResolvedValue(kind === 'http' ? new Response('denied', { status: 401 }) : new Response('{', { status: 200 }))
  const store = createOverviewDataStore(initial, fetcher)
  const notified = vi.fn()
  store.subscribe(notified)
  expect(await store.revalidate()).toBe('failed')
  expect(store.get()).toBe(initial)
  expect(notified).not.toHaveBeenCalled()
})

it('concurrent revalidations share one request, and a later attempt can recover', async () => {
  let resolve!: (response: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
  const store = createOverviewDataStore(initial, fetcher)
  const first = store.revalidate(), second = store.revalidate()
  expect(fetcher).toHaveBeenCalledTimes(1)
  resolve(new Response(null, { status: 503 }))
  expect(await Promise.all([first, second])).toEqual(['failed', 'failed'])
  fetcher.mockResolvedValue(response(updated))
  expect(await store.revalidate()).toBe('updated')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('focus and visible-tab bursts share a two-second throttle, and detach removes both listeners', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T00:00:00Z'))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 304 }))
  const store = createOverviewDataStore(initial, fetcher)
  const detach = attachRevalidation(store, window)
  try {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    await store.revalidate()
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1999)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetcher).toHaveBeenCalledTimes(1)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await store.revalidate()
    expect(fetcher).toHaveBeenCalledTimes(2)
    detach()
    vi.advanceTimersByTime(2000)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  } finally { detach() }
})

it('memoizes scope by store, etag and serialized filter, and invalidates after an update', async () => {
  const store = createOverviewDataStore(initial, vi.fn<typeof fetch>().mockResolvedValue(response(updated)))
  const tk = scopeFor(store, { airlines: ['TK'] })!
  expect(tk.figures.flights).toBe(4)
  expect(scopeFor(store, { airlines: ['BA'] })?.figures.flights).toBe(3)
  expect(scopeFor(store, { airlines: ['TK'] })).toBe(tk)
  expect(scopeFor(createOverviewDataStore(initial), { airlines: ['TK'] })).not.toBe(tk)
  await store.revalidate()
  expect(scopeFor(store, { airlines: ['TK'] })).not.toBe(tk)
  expect(scopeFor(store, { airlines: ['TK'] })?.figures.flights).toBe(1)
})

it('never touches persistent storage while creating, revalidating or computing a scope', async () => {
  const storage = ['getItem', 'setItem', 'removeItem', 'clear', 'key'].map(method =>
    vi.spyOn(Storage.prototype, method as 'getItem').mockImplementation(() => { throw new Error('persistent storage touched') }))
  const indexed = vi.fn(() => { throw new Error('IndexedDB touched') })
  const cache = vi.fn(() => { throw new Error('Cache API touched') })
  vi.stubGlobal('indexedDB', { open: indexed })
  vi.stubGlobal('caches', { open: cache, match: cache })
  const store = createOverviewDataStore(initial, vi.fn<typeof fetch>().mockResolvedValue(response(updated)))
  scopeFor(store, {})
  expect(await store.revalidate()).toBe('updated')
  scopeFor(store, {})
  for (const spy of [...storage, indexed, cache]) expect(spy).not.toHaveBeenCalled()
})
