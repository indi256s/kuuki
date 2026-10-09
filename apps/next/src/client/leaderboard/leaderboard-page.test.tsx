// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { Ranking } from '../../app/(public)/leaderboard/page'
import { getLeaderboard, getOwnLeaderboardEligibility } from '../../server/public'
import { getOptionalPublicViewer } from '../../server/identity'
vi.mock('../../server/public', () => ({
  getLeaderboard: vi.fn(),
  getOwnLeaderboardEligibility: vi.fn(),
}))
vi.mock('../../server/identity', () => ({ getOptionalPublicViewer: vi.fn() }))
vi.mock('../../server/locale', () => ({ getRequestLocale: () => Promise.resolve('en') }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('../profile/badge-notifications', () => ({ BadgeNotifications: () => null }))
vi.mock('../activity', () => ({
  IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../profile/avatar', () => ({ ProfileAvatar: () => <span /> }))
beforeEach(() => {
  vi.mocked(getLeaderboard).mockResolvedValue({ entries: [], total: 0, updatedAt: null })
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(null)
  vi.mocked(getOwnLeaderboardEligibility).mockClear()
})
it('guest gets empty published ranking plus one invite, no private read', async () => {
  render(await Ranking({ category: 'cities' }))
  expect(screen.getByText('Ranked by airports. At least 5 flights required.')).toBeVisible()
  expect(screen.getByText('No published ranking is available in this category yet.')).toBeVisible()
  expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(1)
  expect(getOwnLeaderboardEligibility).not.toHaveBeenCalled()
})
it('unavailable read propagates to retry boundary instead of empty/invite', async () => {
  vi.mocked(getLeaderboard).mockRejectedValueOnce(new Error('unavailable'))
  await expect(Ranking({ category: 'flights' })).rejects.toThrow('unavailable')
})
