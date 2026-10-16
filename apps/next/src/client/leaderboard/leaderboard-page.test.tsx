// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../profile/avatar', () => ({
  ProfileAvatar: () => <span />,
  avatarInk: () => 'var(--stamp-ink-teal)',
}))

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
  avatar_face: null,
  aircraft: null,
  vehicle: null,
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
  expect(screen.getByRole('link', { name: 'Cars, no place yet' })).toBeVisible()
  cleanup()
  render(
    board(
      payload({ guest: true, boards: { flights: { all: { top: [entry(1, 61)], total: 1 } } } }),
    ),
  )
  expect(screen.getByRole('link', { name: 'Flights, leader 61' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Distance, no leader yet' })).toBeVisible()
})

it('links an empty board to the action that fills it', () => {
  render(
    <LeaderboardBoard payload={fixture()} locale="en" initialCategory="rail" initialPeriod="all" />,
  )
  expect(screen.getByRole('link', { name: /^Free/ })).toHaveAttribute('href', '/ground-travel/new')
  cleanup()
  render(
    <LeaderboardBoard
      payload={payload({ guest: true })}
      locale="en"
      initialCategory="flights"
      initialPeriod="all"
    />,
  )
  expect(screen.getByRole('link', { name: /^Free/ })).toHaveAttribute('href', '/signin')
})

it('numbers lanes with real ranks across the gap and puts medals on the top three', () => {
  const { container } = render(board(fixture()))
  const lanes = [...container.querySelectorAll<HTMLLIElement>('.lanes > li')]
  const visible = lanes.filter((lane) => lane.getAttribute('aria-hidden') !== 'true')
  expect(visible.map((lane) => lane.value)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17,
  ])
  const gap = lanes.find((lane) => lane.getAttribute('aria-hidden') === 'true')
  expect(gap).toHaveTextContent('· · ·')
  expect(screen.getByText('Places 13 to 17')).toBeInTheDocument()
  expect(screen.getByText('1 flight to @user14')).toBeVisible()
  expect(
    [...container.querySelectorAll('.lane-medal')].map((medal) => medal.getAttribute('data-medal')),
  ).toEqual(['gold', 'silver', 'bronze'])
})

it('flies each member’s own aircraft in the sky and their longer mode across ground countries', async () => {
  const user = userEvent.setup()
  const data = fixture()
  data.boards.flights.all.top[0] = { ...data.boards.flights.all.top[0], aircraft: 'B738' }
  data.boards.flights.all.top[1] = { ...data.boards.flights.all.top[1], aircraft: 'B739' }
  data.boards.road.all = { top: ranks(1, 2), total: 2 }
  const [rail, unknown] = ranks(1, 2)
  data.boards.ground_countries.all = { top: [{ ...rail, vehicle: 'rail' }, unknown], total: 2 }
  const { container } = render(board(data))
  const vehicles = () =>
    [...container.querySelectorAll('.lane use')].map(
      (use) => use.getAttribute('href')?.split('#')[1],
    )
  expect(vehicles().slice(0, 2)).toEqual(['lane-B738', 'lane-GENERIC'])
  expect(screen.getByText('B738')).toBeVisible()
  await user.click(screen.getByRole('link', { name: /^Cars/ }))
  expect(vehicles()).toEqual(['lane-road', 'lane-road'])
  await user.click(screen.getByRole('link', { name: /^Countries by land/ }))
  expect(vehicles()).toEqual(['lane-rail', 'lane-road'])
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
    json: () =>
      Promise.resolve({ entries: [...ranks(1, 10), ...more], total: 60, updatedAt: null }),
  })
  vi.stubGlobal('fetch', fetchMock)
  render(board(fixture()))
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  await waitFor(() => expect(screen.getByRole('link', { name: '@more11' })).toHaveFocus())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/leaderboard?category=flights&period=all&offset=0&limit=50',
  )
  expect(screen.queryByText('Places 13 to 17')).toBeNull()
})

it('reads the shown places again when the board changes between pages', async () => {
  const user = userEvent.setup()
  const reply = (entries: LeaderboardEntry[], total: number) => ({
    ok: true,
    json: () => Promise.resolve({ entries, total, updatedAt: null }),
  })
  // Page two arrives after #20 left: its total moved, so the client re-reads from the top instead of appending.
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply(ranks(1, 50), 60))
    .mockResolvedValueOnce(reply(ranks(52, 60), 59))
    .mockResolvedValueOnce(
      reply(
        ranks(1, 59).filter((item) => item.rank !== 20),
        59,
      ),
    )
  vi.stubGlobal('fetch', fetchMock)
  render(board(fixture()))
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  await user.click(await screen.findByRole('button', { name: 'Show more' }))
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/leaderboard?category=flights&period=all&offset=0&limit=100',
    ),
  )
  expect(await screen.findByRole('link', { name: '@user51' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '@user20' })).toBeNull()
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

it('offers Show all when every loaded lane is tied for first', () => {
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

it('drops a Show all read that lands after the board was switched', async () => {
  const user = userEvent.setup()
  let land: (value: unknown) => void = () => {}
  vi.stubGlobal(
    'fetch',
    vi.fn().mockReturnValue(
      new Promise((resolve) => {
        land = resolve
      }),
    ),
  )
  const data = fixture()
  data.boards.distance.all = { top: ranks(1, 10, 9000), total: 25 }
  render(board(data))
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  await user.click(screen.getByRole('link', { name: /^Distance/ }))
  // The new board offers its own Show all at once, not a spinner left over from Flights.
  expect(screen.getByRole('button', { name: 'Show all' })).toBeEnabled()
  land({
    ok: true,
    json: () => Promise.resolve({ entries: ranks(1, 50), total: 60, updatedAt: null }),
  })
  await user.click(screen.getByRole('link', { name: /^Flights/ }))
  expect(screen.queryByRole('link', { name: '@user50' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Show all' })).toBeEnabled()
})

it.each(['success', 'failure'])(
  'keeps newer rows and pending pagination after switching away and back when an obsolete read returns %s',
  async (outcome) => {
    const user = userEvent.setup()
    const lands: Array<(value: unknown) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise((resolve) => lands.push(resolve))),
    )
    const data = fixture()
    data.boards.distance.all = { top: ranks(1, 10, 9000), total: 25 }
    render(board(data))
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    await user.click(screen.getByRole('link', { name: /^Distance/ }))
    await user.click(screen.getByRole('link', { name: /^Flights/ }))
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    lands[1]({
      ok: true,
      json: () => Promise.resolve({ entries: ranks(1, 50), total: 60, updatedAt: 'new' }),
    })
    await waitFor(() => expect(screen.getByRole('link', { name: '@user50' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await act(async () =>
      lands[0]({
        ok: outcome === 'success',
        json: () => Promise.resolve({ entries: ranks(1, 25), total: 25, updatedAt: 'old' }),
      }),
    )
    await waitFor(() => expect(screen.getByRole('link', { name: '@user50' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Show more' })).toHaveAttribute('aria-busy', 'true')
    // The active read still blocks another click after the obsolete read finalizes.
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(lands).toHaveLength(3)
    expect(screen.queryByText('Couldn’t load more places. Try again.')).toBeNull()
    await act(async () =>
      lands[2]({
        ok: true,
        json: () => Promise.resolve({ entries: ranks(51, 60), total: 60, updatedAt: 'new' }),
      }),
    )
    expect(screen.getByRole('link', { name: '@user60' })).toBeInTheDocument()
  },
)
