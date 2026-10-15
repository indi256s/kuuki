// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  advanceAuthGeneration,
  api,
  beginIdentityOperation,
  setUnauthorizedHandler,
} from '@kuuki/client/apiClient'

let resolveResponse: ((response: Response) => void) | undefined
const fetchMock = vi.fn<typeof fetch>(
  () =>
    new Promise<Response>((resolve) => {
      resolveResponse = resolve
    }),
)

beforeEach(() => {
  advanceAuthGeneration()
  setUnauthorizedHandler(null)
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

it('never retries a previous user mutation under the new cookie identity', async () => {
  const request = api.patch('/api/flights/old', { notes: 'from A' })
  advanceAuthGeneration()
  resolveResponse?.(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(['json', 'response'] as const)(
  'does not return an old user %s read after an identity switch',
  async (kind) => {
    const request =
      kind === 'json' ? api.get('/api/flights') : api.getResponse('/api/me/overview/data')
    advanceAuthGeneration()
    resolveResponse?.(new Response(JSON.stringify([{ id: 'private-a' }]), { status: 200 }))

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  },
)

it.each(['mutation', 'response'] as const)(
  'rejects a %s queued behind another tab changing the session cookie',
  async (kind) => {
    let releaseLock!: () => void
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, _options: unknown, callback: () => Promise<unknown>) =>
          new Promise((resolve, reject) => {
            releaseLock = () => {
              void Promise.resolve().then(callback).then(resolve, reject)
            }
          }),
      },
    })
    const immediateFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', immediateFetch)
    document.cookie = 'kuuki_csrf=account-a; path=/'
    try {
      const mutation =
        kind === 'mutation'
          ? api.patch('/api/flights/old', { notes: 'from A' })
          : api.getResponse('/api/me/overview/data')
      // The peer broadcast has not arrived, so this tab's auth generation is unchanged.
      document.cookie = 'kuuki_csrf=account-b; path=/'
      releaseLock()
      await expect(mutation).rejects.toMatchObject({ name: 'AbortError' })
      expect(immediateFetch).not.toHaveBeenCalled()
    } finally {
      document.cookie = 'kuuki_csrf=; Max-Age=0; path=/'
    }
  },
)

it('drains a bootstrap response before sending sign-in under a new cookie identity', async () => {
  const bootstrap = api.get('/api/auth/me')
  const operation = beginIdentityOperation()
  await expect(api.get('/api/flights')).rejects.toMatchObject({ name: 'AbortError' })
  await Promise.resolve()
  expect(fetchMock).toHaveBeenCalledTimes(1)

  resolveResponse?.(new Response(JSON.stringify({ user: { id: 'old' } }), { status: 200 }))
  await expect(bootstrap).resolves.toMatchObject({ user: { id: 'old' } })
  await operation.ready
  const signin = api.post(
    '/api/auth/signin',
    { email: 'new@example.com' },
    { identityToken: operation.token },
  )
  expect(fetchMock).toHaveBeenCalledTimes(2)
  resolveResponse?.(new Response(JSON.stringify({ user: { id: 'new' } }), { status: 200 }))
  await expect(signin).resolves.toMatchObject({ user: { id: 'new' } })
  operation.release()
})

it('bounds a stalled refresh so a later account action can enter', async () => {
  vi.useFakeTimers()
  let operation: ReturnType<typeof beginIdentityOperation> | undefined
  try {
    const timedFetch = vi.fn((url: string, init?: RequestInit): Promise<Response> => {
      if (url !== '/api/auth/refresh') {
        return Promise.resolve(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
      }
      return new Promise((_, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    })
    vi.stubGlobal('fetch', timedFetch)
    const oldRequest = api.get('/api/flights')
    await vi.advanceTimersByTimeAsync(0)
    expect(timedFetch).toHaveBeenCalledTimes(2)
    operation = beginIdentityOperation()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(oldRequest).rejects.toMatchObject({ status: 401 })
    await operation.ready
  } finally {
    operation?.release()
    vi.useRealTimers()
  }
})

it('returns conditional HTTP responses untouched and keeps the caller abort connected after headers', async () => {
  const controller = new AbortController()
  const request = api.getResponse('/api/me/overview/data', {
    headers: { 'If-None-Match': 'W/"overview"' },
    cache: 'no-store',
    signal: controller.signal,
  })
  const response = new Response(null, { status: 304, headers: { ETag: 'W/"overview"' } })
  resolveResponse?.(response)
  expect(await request).toBe(response)
  expect(response.status).toBe(304)
  expect(response.headers.get('ETag')).toBe('W/"overview"')
  expect(response.bodyUsed).toBe(false)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/me/overview/data',
    expect.objectContaining({
      cache: 'no-store',
      headers: { 'If-None-Match': 'W/"overview"' },
    }),
  )
  const signal = fetchMock.mock.calls[0][1]?.signal
  controller.abort()
  expect(signal?.aborted).toBe(true)
})
