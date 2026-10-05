// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { BadgeNotifications, unseenBadges } from './badge-notifications'
import { api } from '../../../../web/src/lib/apiClient'
import type { EarnedBadge } from './achievements'
vi.mock('../activity', () => ({ IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children, trackPrivateOperation: () => () => {} }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: vi.fn() }, getAuthGeneration: () => 0 }))
const award = (id: number, user = 'u'): EarnedBadge => ({ id, user_id: user, badge_id: id, earned_at: `2026-10-04T12:00:0${id}Z`, badge: { id, code: `flights-${id}`, name: 'Launch Pad', description: null, category: 'flights', tier: 'bronze', icon: null, points: 10, criteria: { flights: id } } })
beforeEach(() => vi.mocked(api.get).mockReset())
it('baselines a new device, aggregates actual deltas and persists them per account', () => {
  const storage = new Map<string, string>()
  const device = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value) } }
  expect(unseenBadges('history-account', [award(1), award(2)], device).badges).toEqual([])
  expect(unseenBadges('history-account', [award(1), award(2), award(3), award(4)], device)).toEqual({ badges: [award(3), award(4)], first: false })
  expect(unseenBadges('history-account', [award(1), award(2), award(3), award(4)], device).badges).toEqual([])
  expect(unseenBadges('another-account', [award(1)], device).badges).toEqual([])
  expect(unseenBadges('first-account', [], device).badges).toEqual([])
  expect(unseenBadges('first-account', [award(1), award(2)], device).first).toBe(true)
  expect(unseenBadges('first-account', [award(1), award(2)], device).badges).toEqual([])
})
it('announces a single batch, clears on identity reset and rejects late account data', async () => {
  vi.mocked(api.get).mockResolvedValueOnce([]).mockResolvedValueOnce([award(1), award(2)])
  render(<BadgeNotifications ownerId="u" locale="ru" />)
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  await act(async () => { window.dispatchEvent(new Event('kuuki:lifecycle-changed')) })
  const notice = await screen.findByRole('status')
  expect(notice).toHaveTextContent('Новые достижения')
  expect(notice).toHaveTextContent('Стартовая площадка')
  expect(notice).toHaveTextContent('Низкая орбита')
  expect(notice).toHaveAttribute('data-first', 'true')
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('does not baseline failures or accept a previous account response after rerender', async () => {
  let resolve!: (data: EarnedBadge[]) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(value => { resolve = value })).mockResolvedValueOnce([])
  const view = render(<BadgeNotifications ownerId="old" locale="en" />)
  view.rerender(<BadgeNotifications ownerId="new" locale="en" />)
  await act(async () => resolve([award(1, 'old')]))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  vi.mocked(api.get).mockResolvedValueOnce([award(1, 'new')])
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(await screen.findByRole('status')).toHaveTextContent('Launch Pad')
})
it('does not turn a failed first read into a historical celebration on retry', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([award(1, 'retry-owner')]).mockResolvedValueOnce([award(1, 'retry-owner'), award(2, 'retry-owner')])
  render(<BadgeNotifications ownerId="retry-owner" locale="en" />)
  await act(async () => {})
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(async () => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  const notice = await screen.findByRole('status')
  expect(notice).toHaveTextContent('Low Orbit')
  expect(notice).not.toHaveTextContent('Launch Pad')
})
