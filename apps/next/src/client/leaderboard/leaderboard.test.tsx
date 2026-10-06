// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CategoryTabs, LeaderboardRows, recordRank } from './leaderboard'
vi.mock('../profile/badge-notifications', () => ({ BadgeNotifications: () => null }))
vi.mock('../activity', () => ({ IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('../profile/avatar', () => ({ ProfileAvatar: () => <span aria-hidden="true" /> }))
const entry = { id: 1, user_id: 'me', category: 'cities', value: 6, rank: 1, percentile: null, username: 'traveler', display_name: 'Traveler', avatar_url: null }
const own = { ownerId: 'me', status: { isPublic: true, optedIn: true, totalFlights: 5, pending: false }, rank: { entry, period: '2026-10-04' } }
afterEach(() => vi.restoreAllMocks())
let observe: IntersectionObserverCallback
beforeEach(() => { vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { observe = callback } observe() {} disconnect() {} }); window.localStorage.clear() })
it.each(['en', 'ru'] as const)('names every category and keeps the cities alias labelled Airports (%s)', async locale => {
  render(<CategoryTabs category="cities" locale={locale} />)
  const link = screen.getByRole('link', { name: locale === 'ru' ? 'Аэропорты' : 'Airports' })
  expect(link).toHaveAttribute('href', '/leaderboard?category=cities')
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('link')).toHaveLength(5)
  expect(await screen.findByRole('status')).toHaveTextContent(locale === 'ru' ? 'Аэропорты' : 'Airports')
})
it('shows numeric medal rank and units, pins only outside view and avoids duplicate accessible links', async () => {
  render(<LeaderboardRows entries={[entry]} category="cities" locale="en" own={own} />)
  expect(screen.getByText('#1', { selector: '.leaderboard-place span' })).toBeVisible()
  expect(screen.getByText('airports')).toBeVisible()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  await act(async () => observe([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(screen.getByRole('complementary', { name: 'Your leaderboard place' })).toBeVisible()
  expect(screen.getAllByRole('link', { name: 'Traveler' })).toHaveLength(1)
  await act(async () => observe([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Traveler' })).toHaveLength(1)
})
it.each([
  [{ ...own.status, totalFlights: 3 }, '2 more flights'],
  [{ ...own.status, isPublic: false }, 'Make your profile public'],
  [{ ...own.status, optedIn: false }, 'Make your profile public'],
  [{ ...own.status, pending: true }, 'still being prepared'],
  [{ ...own.status, totalFlights: null }, 'Statistics are being prepared'],
  [own.status, 'Your place: #1'],
])('shows one member eligibility message', async (status, message) => {
  render(<LeaderboardRows entries={[]} own={{ ...own, status }} category="flights" locale="en" />)
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1))
  expect(screen.getByRole('status')).toHaveTextContent(message)
})
it('baselines rank on a device and celebrates only a new improvement per account/category/period', () => {
  const storage = new Map<string, string>()
  const device = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value) } }
  expect(recordRank('rank-user', 'flights', 10, 'p1', device)).toEqual({ delta: 0, celebrate: false })
  expect(recordRank('rank-user', 'flights', 7, 'p2', device)).toEqual({ delta: 3, celebrate: true })
  expect(recordRank('rank-user', 'flights', 7, 'p2', device)).toEqual({ delta: 3, celebrate: false })
  expect(recordRank('rank-user', 'distance', 7, 'p2', device)).toEqual({ delta: 0, celebrate: false })
  expect(recordRank('rank-other', 'flights', 7, 'p2', device)).toEqual({ delta: 0, celebrate: false })
  expect(recordRank('rank-user', 'flights', 12, 'p3', device)).toEqual({ delta: -5, celebrate: false })
})

it('changing category never animates: tabs update the announcement and current page without Element.animate', async () => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }))
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
  const view = render(<CategoryTabs category="flights" locale="en" />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Leaderboard category: Flights'))
  view.rerender(<CategoryTabs category="cities" locale="en" />)
  await waitFor(() => expect(screen.getByRole('status')).not.toHaveTextContent('Flights'))
  expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/leaderboard?category=cities')
  expect(animate).not.toHaveBeenCalled()
})

it.each([['en', 1, '1 more flight'], ['ru', 1, '1 перелёт'], ['ru', 2, '2 перелёта'], ['ru', 5, '5 перелётов']] as const)('uses real eligibility plurals (%s %i)', async (locale, remaining, label) => {
  render(<LeaderboardRows entries={[]} category="flights" locale={locale} own={{ ...own, rank: null, status: { ...own.status, totalFlights: 5 - remaining } }} />)
  expect(screen.getByRole('status')).toHaveTextContent(label)
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', String(5 - remaining))
})
it('pins the authenticated published place outside the first page without inventing a list entry', () => {
  render(<LeaderboardRows entries={[]} category="cities" locale="en" own={{ ...own, rank: { ...own.rank, entry: { ...entry, rank: 60 } } }} />)
  expect(screen.getByRole('complementary', { name: 'Your leaderboard place' })).toHaveTextContent('#60')
  expect(screen.getByRole('list').children).toHaveLength(0)
})

it('does not repeat the rank celebration on remount while persisted storage stays readable but stale', async () => {
  const ownerId = 'quota-rank-owner'
  const p1 = '2026-10-01T00:00:00Z', p2 = '2026-10-02T00:00:00Z'
  localStorage.setItem(`kuuki:rank:${ownerId}:flights`, JSON.stringify({ rank: 10, period: p1, delta: 0, seen: [p1] }))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
  const snapshot = { ...own, ownerId, rank: { entry: { ...entry, user_id: ownerId, rank: 7 }, period: p2 } }
  const view = render(<LeaderboardRows entries={[]} category="flights" locale="en" own={snapshot} />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveAttribute('data-celebrate', 'true'))
  expect(screen.getByRole('status')).toHaveTextContent('Up by 3')
  view.unmount()
  render(<LeaderboardRows entries={[]} category="flights" locale="en" own={snapshot} />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Up by 3'))
  expect(screen.getByRole('status')).not.toHaveAttribute('data-celebrate')
})
it('ignores an older publication before comparing the next newer rank', () => {
  const ownerId = 'replayed-rank-owner'
  const p1 = '2026-10-01T00:00:00Z', p2 = '2026-10-02T00:00:00Z', p3 = '2026-10-03T00:00:00Z'
  expect(recordRank(ownerId, 'flights', 10, p1, localStorage).delta).toBe(0)
  expect(recordRank(ownerId, 'flights', 7, p2, localStorage).delta).toBe(3)
  expect(recordRank(ownerId, 'flights', 10, p1, localStorage)).toEqual({ delta: 0, celebrate: false })
  expect(recordRank(ownerId, 'flights', 5, p3, localStorage)).toEqual({ delta: 2, celebrate: true })
})
it('merges a newer publication from another tab without replaying it or losing its comparison baseline', () => {
  const ownerId = 'cross-tab-rank-owner'
  const p1 = '2026-10-01T00:00:00Z', p2 = '2026-10-02T00:00:00Z', p3 = '2026-10-03T00:00:00Z'
  recordRank(ownerId, 'flights', 10, p1, localStorage)
  localStorage.setItem(`kuuki:rank:${ownerId}:flights`, JSON.stringify({ rank: 7, period: p2, delta: 3, seen: [p1, p2] }))
  expect(recordRank(ownerId, 'flights', 7, p2, localStorage)).toEqual({ delta: 3, celebrate: false })
  expect(recordRank(ownerId, 'flights', 5, p3, localStorage)).toEqual({ delta: 2, celebrate: true })
})
it('ignores an unseen older timestamp instead of treating it as a new rank publication', () => {
  const ownerId = 'unseen-old-rank-owner'
  recordRank(ownerId, 'flights', 7, '2026-10-02T00:00:00Z', localStorage)
  expect(recordRank(ownerId, 'flights', 10, '2026-10-01T00:00:00Z', localStorage)).toEqual({ delta: 0, celebrate: false })
  expect(recordRank(ownerId, 'flights', 5, '2026-10-03T00:00:00Z', localStorage)).toEqual({ delta: 2, celebrate: true })
})
