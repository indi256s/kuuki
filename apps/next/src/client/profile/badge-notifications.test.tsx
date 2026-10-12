// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BadgeNotifications, unseenBadges } from './badge-notifications'
import { api } from '@kuuki/client/apiClient'
import type { EarnedBadge } from './achievements'
vi.mock('../activity', () => ({
  IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children,
  trackPrivateOperation: () => () => {},
}))
vi.mock('@kuuki/client/apiClient', () => ({ api: { get: vi.fn() }, getAuthGeneration: () => 0 }))
const award = (id: number, user = 'u'): EarnedBadge => ({
  id,
  user_id: user,
  badge_id: id,
  earned_at: `2026-10-04T12:00:0${id}Z`,
  badge: {
    id,
    code: `flights-${id}`,
    name: 'Launch Pad',
    description: null,
    category: 'flights',
    tier: 'bronze',
    icon: null,
    points: 10,
    criteria: { flights: id },
  },
})
beforeEach(() => vi.mocked(api.get).mockReset())
afterEach(() => vi.restoreAllMocks())
it('baselines a new device, aggregates actual deltas and persists them per account', () => {
  const storage = new Map<string, string>()
  const device = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  }
  expect(unseenBadges('history-account', [award(1), award(2)], device).badges).toEqual([])
  expect(unseenBadges('history-account', [award(1), award(2), award(3), award(4)], device)).toEqual(
    { badges: [award(3), award(4)], first: false },
  )
  expect(
    unseenBadges('history-account', [award(1), award(2), award(3), award(4)], device).badges,
  ).toEqual([])
  expect(unseenBadges('another-account', [award(1)], device).badges).toEqual([])
  expect(unseenBadges('first-account', [], device).badges).toEqual([])
  expect(unseenBadges('first-account', [award(1), award(2)], device).first).toBe(true)
  expect(unseenBadges('first-account', [award(1), award(2)], device).badges).toEqual([])
})
it('keeps the cabinet unboxing baseline separate from the toast, so a toast never spends the unboxing', () => {
  const storage = new Map<string, string>()
  const device = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  }
  // First profile visit: baseline only, no replay of badges earned before.
  expect(unseenBadges('cabinet-owner', [award(1)], device, 'badge-cabinet').badges).toEqual([])
  // The toast notices a new award first (its own first snapshot is a baseline too).
  unseenBadges('cabinet-owner', [award(1)], device)
  expect(unseenBadges('cabinet-owner', [award(1), award(2)], device).badges).toEqual([award(2)])
  // The next profile visit still presses it into its slot, once.
  expect(
    unseenBadges('cabinet-owner', [award(1), award(2)], device, 'badge-cabinet').badges,
  ).toEqual([award(2)])
  expect(
    unseenBadges('cabinet-owner', [award(1), award(2)], device, 'badge-cabinet').badges,
  ).toEqual([])
  expect([...storage.keys()].sort()).toEqual([
    'kuuki:badge-cabinet:cabinet-owner',
    'kuuki:badge-events:cabinet-owner',
  ])
})
it('announces a single batch, clears on identity reset and rejects late account data', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([award(1), award(2)])
  render(<BadgeNotifications ownerId="u" locale="ru" />)
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  await act(async () => {
    window.dispatchEvent(new Event('kuuki:lifecycle-changed'))
  })
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
  vi.mocked(api.get)
    .mockImplementationOnce(
      () =>
        new Promise((value) => {
          resolve = value
        }),
    )
    .mockResolvedValueOnce([])
  const view = render(<BadgeNotifications ownerId="old" locale="en" />)
  view.rerender(<BadgeNotifications ownerId="new" locale="en" />)
  await act(async () => resolve([award(1, 'old')]))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  vi.mocked(api.get).mockResolvedValueOnce([award(1, 'new')])
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(await screen.findByRole('status')).toHaveTextContent('Launch Pad')
})
it('does not turn a failed first read into a historical celebration on retry', async () => {
  vi.mocked(api.get)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([award(1, 'retry-owner')])
    .mockResolvedValueOnce([award(1, 'retry-owner'), award(2, 'retry-owner')])
  render(<BadgeNotifications ownerId="retry-owner" locale="en" />)
  await act(async () => {})
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(async () => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  const notice = await screen.findByRole('status')
  expect(notice).toHaveTextContent('Low Orbit')
  expect(notice).not.toHaveTextContent('Launch Pad')
})

it('keeps a dismissed first badge seen through focus and remount when reads work but storage writes fail', async () => {
  const ownerId = 'quota-badge-owner'
  localStorage.setItem(`kuuki:badge-events:${ownerId}`, '[]')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  const badge = award(1, ownerId)
  vi.mocked(api.get).mockResolvedValueOnce([]).mockResolvedValue([badge])
  const view = render(<BadgeNotifications ownerId={ownerId} locale="en" />)
  await act(async () => {})
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(await screen.findByRole('status')).toHaveAttribute('data-first', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  view.unmount()
  render(<BadgeNotifications ownerId={ownerId} locale="en" />)
  await act(async () => {})
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('merges another tab’s seen badge identities with the local baseline', () => {
  const ownerId = 'cross-tab-badge-owner'
  unseenBadges(ownerId, [], localStorage)
  const badge = award(1, ownerId)
  localStorage.setItem(
    `kuuki:badge-events:${ownerId}`,
    JSON.stringify([`${badge.id}:${badge.badge_id}:${badge.earned_at}`]),
  )
  expect(unseenBadges(ownerId, [badge], localStorage).badges).toEqual([])
  expect(unseenBadges(ownerId, [badge, award(2, ownerId)], localStorage).badges).toEqual([
    award(2, ownerId),
  ])
})
