// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LeaderboardData } from '../../app/(public)/leaderboard/page'
import { getLeaderboardBoard, getOwnLeaderboardEligibility } from '../../server/public'
import type {
  LeaderboardBoardPayload,
  LeaderboardEntry,
  ViewerPlace,
} from '../../../../../functions/api/_services/publicLeaderboard'
import { LEADERBOARD_CATEGORIES } from '../../../../../functions/api/_lib/leaderboard'
import { LeaderboardBoard } from './leaderboard'

vi.mock('../../server/public', () => ({
  getLeaderboardBoard: vi.fn(),
  getOwnLeaderboardEligibility: vi.fn(),
}))
vi.mock('../../server/locale', () => ({ getRequestLocale: () => Promise.resolve('en') }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('../activity', () => ({
  IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../profile/avatar', () => ({ ProfileAvatar: () => <span /> }))

const entry = (rank: number, value: number, name = `user${rank}`): LeaderboardEntry => ({
  id: rank,
  user_id: `id-${name}`,
  category: 'flights',
  value,
  rank,
  percentile: null,
  username: name,
  display_name: null,
  avatar_url: null,
})
const ranks = (from: number, to: number, base = 100) =>
  Array.from({ length: to - from + 1 }, (_, index) => entry(from + index, base - from - index))
const empty = { top: [] as LeaderboardEntry[], total: 0 }

function payload(
  overrides: {
    boards?: Record<string, Record<string, { top: LeaderboardEntry[]; total: number }>>
    places?: Record<string, Record<string, ViewerPlace>>
    guest?: boolean
  } = {},
): LeaderboardBoardPayload {
  const boards = Object.fromEntries(
    LEADERBOARD_CATEGORIES.map((category) => [category, { all: empty, '2026': empty }]),
  )
  const places = Object.fromEntries(
    LEADERBOARD_CATEGORIES.map((category) => [
      category,
      { all: { state: 'unranked' }, '2026': { state: 'unranked' } },
    ]),
  )
  return {
    year: '2026',
    periods: ['all', '2026'],
    boards: { ...boards, ...overrides.boards },
    viewer: overrides.guest
      ? null
      : { userId: 'id-me', places: { ...places, ...overrides.places } },
    updatedAt: '2026-10-15T10:00:00.000Z',
  } as unknown as LeaderboardBoardPayload
}

const me = entry(15, 85, 'me')
const viewerAt15: ViewerPlace = {
  state: 'ranked',
  entry: me,
  neighbours: [...ranks(13, 14), me, ...ranks(16, 17)],
  next: { entry: entry(14, 86), gap: 1 },
}
const fixture = () =>
  payload({
    boards: {
      flights: {
        all: { top: ranks(1, 10), total: 25 },
        '2026': { top: ranks(1, 2), total: 2 },
      },
      distance: {
        all: { top: [...ranks(1, 3, 9000), entry(4, 100, 'dana')], total: 4 },
        '2026': { top: ranks(1, 2, 500), total: 2 },
      },
    },
    places: {
      flights: { all: viewerAt15, '2026': { state: 'unranked' } },
      cities: { all: { state: 'progress', have: 3, need: 5 } },
      rail: { all: { state: 'blocked' } },
    },
  })

const board = (data: LeaderboardBoardPayload) => (
  <LeaderboardBoard payload={data} locale="en" initialCategory="flights" initialPeriod="all" />
)

beforeEach(() => {
  window.history.replaceState(null, '', '/leaderboard')
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('switching category and period never shows a skeleton and mirrors the URL', async () => {
  const user = userEvent.setup()
  render(board(fixture()))
  await user.click(screen.getByRole('link', { name: /^Distance/ }))
  expect(screen.queryByText('Loading rankings…')).toBeNull()
  expect(screen.getByRole('link', { name: '@dana' })).toBeVisible()
  expect(screen.getByRole('link', { name: /^Distance/ })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /^Flights/ })).not.toHaveAttribute('aria-current')
  expect(window.location.search).toContain('category=distance')
  await user.click(screen.getByRole('radio', { name: '2026' }))
  expect(screen.queryByText('Loading rankings…')).toBeNull()
  expect(window.location.search).toContain('period=2026')
  expect(window.location.search).toContain('category=distance')
})

it('names tiles by the viewer state: ranked, progress, blocked, guest', () => {
  render(board(fixture()))
  expect(screen.getByRole('link', { name: 'Flights, your place 15' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Airports, 3 of 5 to join' })).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Trains, locked until all countries are published' }),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'Road trips, no place yet' })).toBeVisible()
  cleanup()
  render(
    board(
      payload({ guest: true, boards: { flights: { all: { top: [entry(1, 61)], total: 1 } } } }),
    ),
  )
  expect(screen.getByRole('link', { name: 'Flights, leader 61' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Distance, no leader yet' })).toBeVisible()
})

it('lists the podium in rank order and links a missing place to the right action', () => {
  render(board(fixture()))
  const podium = screen.getByRole('list', { name: 'Top three' })
  const signs = within(podium).getAllByRole('listitem')
  expect(signs.map((sign) => sign.getAttribute('value'))).toEqual(['1', '2', '3'])
  cleanup()
  render(
    <LeaderboardBoard
      payload={fixture()}
      locale="en"
      initialCategory="distance"
      initialPeriod="2026"
    />,
  )
  expect(screen.getByRole('link', { name: /^Free/ })).toHaveAttribute('href', '/add')
  cleanup()
  render(
    <LeaderboardBoard
      payload={payload({ guest: true })}
      locale="en"
      initialCategory="rail"
      initialPeriod="all"
    />,
  )
  const free = screen.getAllByRole('link', { name: /^Free/ })
  expect(free).toHaveLength(3)
  expect(free[0]).toHaveAttribute('href', '/signin')
})

it('numbers board rows with real ranks across the gap', () => {
  const { container } = render(board(fixture()))
  const rows = [...container.querySelectorAll<HTMLLIElement>('.leaderboard-rows > li')]
  const visible = rows.filter((row) => row.getAttribute('aria-hidden') !== 'true')
  expect(visible.map((row) => row.value)).toEqual([4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17])
  const gap = rows.find((row) => row.getAttribute('aria-hidden') === 'true')
  expect(gap).toHaveTextContent('· · ·')
  expect(screen.getByText('Places 13 to 17')).toBeInTheDocument()
  expect(screen.getByText('1 flight to @user14')).toBeVisible()
})

it('moves focus to the first new row after Show all', async () => {
  const user = userEvent.setup()
  const more = ranks(11, 60).map((item) => ({
    ...item,
    user_id: `more-${item.rank}`,
    username: `more${item.rank}`,
  }))
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ entries: more, total: 25, updatedAt: null }),
  })
  vi.stubGlobal('fetch', fetchMock)
  render(board(fixture()))
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  await waitFor(() => expect(screen.getByRole('link', { name: '@more11' })).toHaveFocus())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/leaderboard?category=flights&period=all&offset=10&limit=50',
  )
  expect(screen.queryByText('Places 13 to 17')).toBeNull()
})

it('reads only the board for a guest and lets an unavailable read reach the retry boundary', async () => {
  vi.mocked(getLeaderboardBoard).mockResolvedValue(payload({ guest: true }))
  render(
    await LeaderboardData({
      searchParams: Promise.resolve({ category: 'bogus', period: '1999' }),
    }),
  )
  expect(getLeaderboardBoard).toHaveBeenCalledTimes(1)
  expect(getOwnLeaderboardEligibility).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /^Flights/ })).toHaveAttribute('aria-current', 'page')
  vi.mocked(getLeaderboardBoard).mockRejectedValueOnce(new Error('unavailable'))
  await expect(LeaderboardData({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    'unavailable',
  )
})

it('offers Show all when every loaded row stands on the podium', () => {
  const tied = Array.from({ length: 10 }, (_, index) => entry(1, 50, `tied${index}`))
  render(board(payload({ guest: true, boards: { flights: { all: { top: tied, total: 25 } } } })))
  expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument()
})

it('keeps the gap on the viewer row when the member to beat is outside the list', () => {
  const tiedWithMe = [
    entry(15, 80, 'p'),
    entry(15, 80, 'q'),
    me,
    entry(15, 80, 'r'),
    entry(15, 80, 's'),
  ]
  const data = fixture()
  data.viewer!.places.flights!.all = {
    state: 'ranked',
    entry: { ...me, value: 80 },
    neighbours: tiedWithMe,
    next: { entry: entry(12, 81, 'ahead'), gap: 1 },
  }
  const { container } = render(board(data))
  const own = container.querySelector('[data-own]')
  expect(own).toHaveTextContent('1 flight to @ahead')
})
