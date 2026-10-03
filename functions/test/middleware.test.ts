import { expect, it, vi } from 'vitest'
import { onRequest } from '../_middleware'

it('blocks API requests in maintenance before DB access or next', async () => {
  const next = vi.fn(async () => new Response('unexpected'))
  const db = { prepare: vi.fn(() => { throw Error('DB touched') }) }
  const response = await onRequest({
    request: new Request('https://kuuki.pages.dev/api/flights'),
    env: { DB: db, MAINTENANCE_MODE: 'true' },
    data: {}, next,
  } as never)
  expect(response.status).toBe(503)
  expect(response.headers.get('Retry-After')).toBeTruthy()
  expect(db.prepare).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()

  const absentDb = await onRequest({
    request: new Request('https://kuuki.pages.dev/api/flights'),
    env: { MAINTENANCE_MODE: 'true' },
    data: {}, next,
  } as never)
  expect(absentDb.status).toBe(503)
  expect(next).not.toHaveBeenCalled()
})

it('lets static assets through in maintenance', async () => {
  const next = vi.fn(async () => new Response('asset'))
  const response = await onRequest({
    request: new Request('https://kuuki.pages.dev/logo.svg'),
    env: { MAINTENANCE_MODE: 'true' },
    data: {}, next,
  } as never)
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('asset')
  expect(next).toHaveBeenCalledOnce()
})
