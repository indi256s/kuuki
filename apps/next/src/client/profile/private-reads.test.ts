import { beforeEach, expect, it, vi } from 'vitest'
import { getOwnBadges, getOwnProfileStats, getProfileShareUrl } from '../../server/profile'
import { getRequestEnv, getRequestIdentity } from '../../server/identity'
import { readOwnBadges } from '../../../../../functions/api/_services/ownBadges'
vi.mock('server-only', () => ({}))
vi.mock('../../server/identity', () => ({ getRequestEnv: vi.fn(), getRequestIdentity: vi.fn() }))
vi.mock('../../../../../functions/api/_services/ownBadges', () => ({ readOwnBadges: vi.fn() }))
beforeEach(() => { vi.mocked(getRequestEnv).mockReset(); vi.mocked(readOwnBadges).mockReset() })
it('gates full private stats and badges before binding access for guests and another account', async () => {
  for (const identity of [null, { id: 'other', email: 'other@example.test' }]) {
    vi.mocked(getRequestIdentity).mockResolvedValue(identity as Awaited<ReturnType<typeof getRequestIdentity>>)
    expect(await getOwnProfileStats('owner')).toBeNull()
    expect(await getOwnBadges('owner')).toEqual([])
    expect(getRequestEnv).not.toHaveBeenCalled()
    expect(readOwnBadges).not.toHaveBeenCalled()
  }
})
it('uses exact configured origin with encoded username', async () => {
  vi.mocked(getRequestEnv).mockResolvedValue({ PAGES_ORIGIN: 'https://configured.example' } as Awaited<ReturnType<typeof getRequestEnv>>)
  expect(await getProfileShareUrl('a/b ü')).toBe('https://configured.example/fly/a%2Fb%20%C3%BC')
})
