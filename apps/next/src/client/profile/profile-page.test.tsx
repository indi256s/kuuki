// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProfileData } from '../../app/(public)/fly/[username]/page'
import { getPublicProfile } from '../../server/public'
import { getOptionalPublicViewer } from '../../server/identity'
import {
  getOwnProfile,
  getOwnProfileStats,
  getOwnBadges,
  getOwnStamps,
  getProfileShareUrl,
} from '../../server/profile'
import { getRequestLocale } from '../../server/locale'
vi.mock('../../server/public', () => ({ getPublicProfile: vi.fn() }))
vi.mock('../../server/identity', () => ({ getOptionalPublicViewer: vi.fn() }))
vi.mock('../../server/profile', () => ({
  getOwnProfile: vi.fn(),
  getOwnProfileStats: vi.fn(),
  getOwnBadges: vi.fn(),
  getOwnStamps: vi.fn(),
  getProfileShareUrl: vi.fn(),
}))
vi.mock('../../server/locale', () => ({ getRequestLocale: vi.fn() }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('./badge-notifications', () => ({ BadgeNotifications: () => null }))
vi.mock('./avatar', () => ({ ProfileAvatar: () => <span aria-hidden="true" /> }))
vi.mock('../activity', () => ({
  IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children,
}))
const profile = {
  id: 'owner',
  username: 'traveler',
  display_name: 'Traveler',
  bio: 'A biography',
  avatar_url: null,
  is_public: true,
  show_on_leaderboards: false,
  theme_color: null,
  created_at: '2026-10-04',
}
const stats = {
  user_id: 'owner',
  total_flights: 9,
  total_distance_km: 12345,
  total_duration_minutes: 60,
  longest_flight_minutes: 30,
  airports_count: 4,
  cities_count: 2,
  countries_count: 2,
  continents_count: 1,
  airlines_count: 0,
  aircraft_count: 0,
  time_zones_count: 0,
  most_visited_country: null,
  most_visited_count: 0,
  world_completion_pct: 0,
  has_night_departure: false,
  updated_at: '2026-10-04',
}
const owner = { id: 'owner', email: 'owner@example.test' } as Awaited<
  ReturnType<typeof getOptionalPublicViewer>
>
const privateRead = {
  profile: {
    ...profile,
    is_public: false,
    display_name: null,
    bio: null,
    created_at: null,
    avatar_url: null,
    theme_color: null,
  },
  stats: null,
  badges: [],
  rankings: [],
  countries: [],
  derivedState: 'private' as const,
}
const founding = {
  id: 1,
  user_id: 'owner',
  badge_id: 63,
  earned_at: '2026-10-12T00:00:00.000Z',
  badge: {
    id: 63,
    code: 'founding-user',
    name: 'Founding User',
    description: null,
    category: 'special',
    tier: null,
    icon: 'sparkles',
    points: 75,
    criteria: { beta_invite: true },
  },
}
beforeEach(() => {
  vi.mocked(getRequestLocale).mockResolvedValue('en')
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(null)
  vi.mocked(getPublicProfile).mockResolvedValue({
    profile,
    stats,
    badges: [],
    rankings: [],
    countries: ['NO', 'GE'],
    derivedState: 'ready',
  })
  vi.mocked(getOwnProfileStats).mockClear()
  vi.mocked(getOwnProfile).mockClear()
  vi.mocked(getOwnBadges).mockClear()
  vi.mocked(getOwnStamps).mockReset()
  vi.mocked(getOwnStamps).mockResolvedValue([
    { code: 'NO', lastVisit: '2026-09-14' },
    { code: 'GE', lastVisit: '2025-11-02' },
  ])
  vi.mocked(getProfileShareUrl).mockResolvedValue('https://configured.example/fly/traveler')
})
it('visitor sees the holder page and headline numbers, dateless stamps, the join card, and no owner or unbuilt actions', async () => {
  const view = render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Traveler' })).toBeVisible()
  expect(screen.getByText('12,345')).toBeVisible()
  expect(screen.queryByText('Airlines')).not.toBeInTheDocument()
  expect(screen.queryByText('Aircraft types')).not.toBeInTheDocument()
  // Stamps: names only, ordered by name, never the owner's dates (spec: no new disclosure).
  const stamps = within(screen.getByRole('region', { name: 'Stamps' }))
  expect(stamps.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'GeorgiaGE',
    'NorwayNO',
  ])
  expect(getOwnStamps).not.toHaveBeenCalled()
  expect(view.container.textContent).not.toMatch(/\d{2}·\d{2}/)
  // Visitors never see empty blocks, Remarks, owner controls or actions that wait for /compare.
  expect(screen.queryByRole('heading', { name: 'Achievements' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Leaderboard' })).not.toBeInTheDocument()
  expect(screen.queryByText('Remarks')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument()
  expect(view.container.textContent).not.toMatch(/compare/i)
  expect(screen.getByRole('link', { name: 'Start your own flight journal' })).toHaveAttribute(
    'href',
    '/signup',
  )
  expect(getOwnProfileStats).not.toHaveBeenCalled()
})
it('names each gate sign by rank and category and links it to its leaderboard', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({
    profile,
    stats,
    badges: [],
    countries: [],
    derivedState: 'ready',
    rankings: [
      { category: 'flights', rank: 27 },
      { category: 'distance', rank: 4 },
    ] as never,
  })
  render(await ProfileData({ username: 'traveler' }))
  const gates = screen.getAllByRole('link', { name: /^Rank / })
  expect(gates.map((gate) => gate.getAttribute('aria-label'))).toEqual([
    'Rank 4 in Distance',
    'Rank 27 in Flights',
  ])
  expect(gates[0]).toHaveAttribute('href', '/leaderboard?category=distance')
})
it.each([
  ['en', 'Founding crew', 'Thank you for being here from the start.'],
  ['ru', 'Founding crew', 'Спасибо, что были с нами с самого начала.'],
] as const)('opens the earned founding crew keepsake in %s', async (locale, label, thanks) => {
  vi.mocked(getRequestLocale).mockResolvedValue(locale)
  vi.mocked(getPublicProfile).mockResolvedValue({
    profile,
    stats,
    rankings: [],
    countries: [],
    derivedState: 'ready',
    badges: [founding],
  })
  const user = userEvent.setup()
  render(await ProfileData({ username: 'traveler' }))
  await user.click(screen.getAllByRole('button', { name: label })[0])
  const keepsake = screen.getByRole('dialog', { name: label })
  expect(within(keepsake).getByText(thanks)).toBeVisible()
})
it.each([
  [null, 'Start your own journal', '/signup'],
  [{ id: 'someone-else', email: 'x@example.test' }, 'Back to your journal', '/journal'],
] as const)(
  'a visitor on a private profile gets the closed cover, no name and no private reads (viewer %#)',
  async (viewer, link, href) => {
    vi.mocked(getOptionalPublicViewer).mockResolvedValue(viewer as never)
    vi.mocked(getPublicProfile).mockResolvedValue(privateRead)
    const view = render(await ProfileData({ username: 'traveler' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'This passport is private.' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', href)
    expect(view.container.textContent).not.toContain('Traveler')
    expect(view.container.textContent).not.toContain('@traveler')
    expect(getOwnProfile).not.toHaveBeenCalled()
    expect(getOwnProfileStats).not.toHaveBeenCalled()
    expect(getOwnBadges).not.toHaveBeenCalled()
    expect(getOwnStamps).not.toHaveBeenCalled()
  },
)
it('private owner sees the full page under a decorative PRIVATE stamp, the Private chip and dated stamps', async () => {
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(owner)
  vi.mocked(getPublicProfile).mockResolvedValue(privateRead)
  vi.mocked(getOwnProfile).mockResolvedValue({
    ownerId: 'owner',
    profile: {
      ...profile,
      is_public: false,
      gemini_api_key: 'PRIVATE-KEY',
      home_airport: null,
      locale: 'en',
      updated_at: '2026-10-04',
    },
  } as Awaited<ReturnType<typeof getOwnProfile>>)
  vi.mocked(getOwnProfileStats).mockResolvedValue(stats)
  vi.mocked(getOwnBadges).mockResolvedValue([])
  const view = render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Traveler' })).toBeVisible()
  expect(screen.getByText('12,345')).toBeVisible()
  expect(screen.getByText('PRIVATE').closest('[aria-hidden="true"]')).not.toBeNull()
  expect(screen.getByRole('link', { name: 'Private profile, change in Settings' })).toHaveAttribute(
    'href',
    '/settings',
  )
  expect(screen.getByText('Your profile is private. Others see a closed passport.')).toBeVisible()
  // No disabled Share on a private profile (audit decision).
  expect(screen.queryByRole('button', { name: 'Share profile' })).not.toBeInTheDocument()
  expect(screen.getByText('Remarks')).toBeVisible()
  expect(screen.getByText('Norway, September 2026')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open passport →' })).toHaveAttribute('href', '/passport')
  expect(
    screen.getByText(
      'Rankings appear after five flights with a public profile and participation on.',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Start your own flight journal' }),
  ).not.toBeInTheDocument()
  expect(view.container.innerHTML).not.toContain('PRIVATE-KEY')
  expect(getOwnProfileStats).toHaveBeenCalledWith('owner')
})
it('public owner gets Share profile and the Public chip instead of the old duplicate Settings links', async () => {
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(owner)
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('button', { name: 'Share profile' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Public profile, change in Settings' })).toHaveAttribute(
    'href',
    '/settings',
  )
  expect(screen.getAllByRole('link', { name: /settings/i })).toHaveLength(1)
  expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument()
})
it('missing profile shows the not-found cover with a home link; an unavailable read throws', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue(null)
  render(await ProfileData({ username: 'missing' }))
  expect(screen.getByRole('heading', { level: 1, name: 'No such passport.' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  vi.mocked(getPublicProfile).mockRejectedValueOnce(new Error('D1 unavailable'))
  await expect(ProfileData({ username: 'missing' })).rejects.toThrow('D1 unavailable')
})

it('does not show unknown distance or duration as a visitor zero after saved flights', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({
    profile,
    stats: { ...stats, total_distance_km: 0, total_duration_minutes: 0 },
    badges: [],
    rankings: [],
    countries: [],
    derivedState: 'ready',
  })
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.queryByText('0 km')).not.toBeInTheDocument()
  expect(screen.queryByText('Distance flown')).not.toBeInTheDocument()
  expect(screen.queryByText('Hours in the air')).not.toBeInTheDocument()
  expect(screen.getByText('Flights')).toBeVisible()
})
