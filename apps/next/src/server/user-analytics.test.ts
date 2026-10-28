import { afterEach, expect, it, vi } from 'vitest'
import { getUserAnalytics } from './user-analytics'
import { getRequestEnv, getRequestIdentity } from './identity'

vi.mock('server-only', () => ({}))
vi.mock('./identity', () => ({ getRequestEnv: vi.fn(), getRequestIdentity: vi.fn() }))

afterEach(() => vi.resetAllMocks())

it('redirects guests and hides statistics from non-admin members before aggregate reads', async () => {
  vi.mocked(getRequestIdentity).mockResolvedValue(null)
  await expect(getUserAnalytics(30)).rejects.toThrow('NEXT_REDIRECT')
  expect(getRequestEnv).not.toHaveBeenCalled()

  vi.mocked(getRequestIdentity).mockResolvedValue({ id: 'member', email: 'member@example.test' })
  for (const ownerId of [undefined, 'admin']) {
    vi.mocked(getRequestEnv).mockResolvedValue({
      ADMIN_USER_ID: ownerId,
      get DB(): D1Database {
        throw new Error('Unauthorized aggregate read')
      },
    } as Awaited<ReturnType<typeof getRequestEnv>>)
    await expect(getUserAnalytics(30)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  }
})
