import { beforeEach, expect, it, vi } from 'vitest'
import { getOwnLeaderboardEligibility } from '../../server/public'
import { getRequestEnv, getRequestIdentity } from '../../server/identity'
import {
  readOwnLeaderboardEligibility,
  readOwnLeaderboardRank,
} from '../../../../../functions/api/_services/publicLeaderboard'
vi.mock('server-only', () => ({}))
vi.mock('../../server/identity', () => ({ getRequestEnv: vi.fn(), getRequestIdentity: vi.fn() }))
vi.mock('../../../../../functions/api/_services/publicLeaderboard', () => ({
  readOwnLeaderboardEligibility: vi.fn(),
  readOwnLeaderboardRank: vi.fn(),
}))
beforeEach(() => {
  vi.mocked(getRequestEnv).mockReset()
  vi.mocked(getRequestIdentity).mockResolvedValue(null)
  vi.mocked(readOwnLeaderboardRank).mockClear()
})
it('guest cannot read own rank or eligibility bindings', async () => {
  expect(await getOwnLeaderboardEligibility('cities')).toBeNull()
  expect(getRequestEnv).not.toHaveBeenCalled()
  expect(readOwnLeaderboardRank).not.toHaveBeenCalled()
})
it.each([
  { isPublic: false, optedIn: true, totalFlights: 5, pending: false },
  { isPublic: true, optedIn: false, totalFlights: 5, pending: false },
  { isPublic: true, optedIn: true, totalFlights: null, pending: false },
  { isPublic: true, optedIn: true, totalFlights: 4, pending: false },
  { isPublic: true, optedIn: true, totalFlights: 5, pending: true },
])(
  'does not return own place for ineligible snapshot even if concurrent rank read returned data',
  async (status) => {
    vi.mocked(getRequestIdentity).mockResolvedValue({ id: 'owner' } as Awaited<
      ReturnType<typeof getRequestIdentity>
    >)
    vi.mocked(getRequestEnv).mockResolvedValue({ DB: {} } as Awaited<
      ReturnType<typeof getRequestEnv>
    >)
    vi.mocked(readOwnLeaderboardEligibility).mockResolvedValue(status)
    vi.mocked(readOwnLeaderboardRank).mockResolvedValue({
      entry: {
        id: 1,
        user_id: 'owner',
        category: 'cities',
        value: 20,
        rank: 1,
        percentile: null,
        username: 'owner',
        display_name: null,
        avatar_url: null,
      },
      period: 'publication',
    })
    expect((await getOwnLeaderboardEligibility('cities'))?.rank).toBeNull()
  },
)
