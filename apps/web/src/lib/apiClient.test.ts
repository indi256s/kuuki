import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { advanceAuthGeneration, api, beginIdentityOperation, setUnauthorizedHandler } from './apiClient'

let resolveResponse: ((response: Response) => void) | undefined
const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve }))

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

it('does not return an old user read after an identity switch', async () => {
  const request = api.get('/api/flights')
  advanceAuthGeneration()
  resolveResponse?.(new Response(JSON.stringify([{ id: 'private-a' }]), { status: 200 }))

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
})

it('drains a bootstrap response before sending sign-in under a new cookie identity', async () => {
  const bootstrap = api.get('/api/auth/me')
  const operation = beginIdentityOperation()
  await expect(api.get('/api/flights')).rejects.toMatchObject({ name: 'AbortError' })
  await Promise.resolve()
  expect(fetchMock).toHaveBeenCalledTimes(1)

  resolveResponse?.(new Response(JSON.stringify({ user: { id: 'old' } }), { status: 200 }))
  await expect(bootstrap).resolves.toMatchObject({ user: { id: 'old' } })
  await operation.ready
  const signin = api.post('/api/auth/signin', { email: 'new@example.com' }, operation.token)
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
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
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
