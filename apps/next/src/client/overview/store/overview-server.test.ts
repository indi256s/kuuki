import { afterEach, expect, it, vi } from 'vitest'
import { getOwnOverviewPrefs } from '../../../server/overview'
import { getRequestEnv, getRequestIdentity } from '../../../server/identity'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
vi.mock('server-only', () => ({}))
vi.mock('../../../server/identity', () => ({ getRequestEnv: vi.fn(), getRequestIdentity: vi.fn() }))
afterEach(() => vi.resetAllMocks())
it('guest gate precedes the preferences SELECT', async () => {
  vi.mocked(getRequestIdentity).mockResolvedValue(null)
  expect(await getOwnOverviewPrefs()).toBeNull()
  expect(getRequestEnv).not.toHaveBeenCalled()
})
it('authenticated preferences are owner-bound, normalized and tagged', async () => {
  vi.mocked(getRequestIdentity).mockResolvedValue({ id: 'owner' } as Awaited<
    ReturnType<typeof getRequestIdentity>
  >)
  const first = vi.fn().mockResolvedValue({ overview_prefs: '{' }),
    bind = vi.fn(() => ({ first })),
    prepare = vi.fn(() => ({ bind }))
  vi.mocked(getRequestEnv).mockResolvedValue({ DB: { prepare } } as unknown as Awaited<
    ReturnType<typeof getRequestEnv>
  >)
  expect(await getOwnOverviewPrefs()).toEqual({ ownerId: 'owner', prefs: DEFAULT_PREFS })
  expect(prepare).toHaveBeenCalledWith('SELECT overview_prefs FROM profiles WHERE id = ?')
  expect(bind).toHaveBeenCalledWith('owner')
  first.mockResolvedValue(null)
  await expect(getOwnOverviewPrefs()).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  first.mockRejectedValue(new Error('D1 unavailable'))
  await expect(getOwnOverviewPrefs()).rejects.toThrow('D1 unavailable')
})
