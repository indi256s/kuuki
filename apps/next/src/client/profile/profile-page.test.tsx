// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProfileData } from '../../app/(public)/fly/[username]/page'
import { getPublicPassport } from '../../server/passport'
import { getOptionalPublicViewer } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'
vi.mock('../../server/passport', () => ({ getPublicPassport: vi.fn() }))
vi.mock('../../server/identity', () => ({ getOptionalPublicViewer: vi.fn() }))
vi.mock('../../server/locale', () => ({ getRequestLocale: vi.fn() }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => '/fly/traveler',
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`)
  },
}))
vi.mock('next/link', async () => ({
  default: (await import('../../test/next-link')).linkStandIn(() => {}),
}))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
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
  publication: null,
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
  vi.mocked(getPublicPassport).mockResolvedValue({
    profile,
    stats,
    badges: [],
    rankings: [],
    countries: ['NO', 'GE'],
    derivedState: 'ready',
    publication: 'flights',
  })
})
it('visitor sees the identity, the permitted stamps by name only, the flight block and the join card, and no owner controls', async () => {
  const view = render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Traveler' })).toBeVisible()
  expect(screen.getByText('@traveler')).toBeVisible()
  expect(screen.getByText('A biography')).toBeVisible()
  // The flight block is labelled and keeps only the stats the public read carries.
  const flights = within(screen.getByRole('region', { name: 'On flights' }))
  expect(flights.getByText('12,345')).toBeVisible()
  expect(screen.queryByText('Airlines')).not.toBeInTheDocument()
  expect(screen.queryByText('Aircraft types')).not.toBeInTheDocument()
  // Stamps: names only, ordered by name, never the owner's dates (spec: no new disclosure).
  const stamps = within(screen.getByRole('list', { name: 'Stamps' }))
  expect(stamps.getAllByRole('button').map((item) => item.textContent)).toEqual([
    'Georgia',
    'Norway',
  ])
  expect(screen.getByText('Visited 2 countries')).toBeVisible()
  // Visitors never see empty blocks, Remarks, owner controls or actions that wait for /compare.
  expect(screen.queryByRole('heading', { name: 'Achievements' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Leaderboard' })).not.toBeInTheDocument()
  expect(screen.queryByText('Only you see this')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Passport menu' })).not.toBeInTheDocument()
  expect(view.container.textContent).not.toMatch(/compare/i)
  expect(screen.getByRole('link', { name: 'Start your own flight journal' })).toHaveAttribute(
    'href',
    '/signup',
  )
})
it('names each gate sign by rank and category and links it to its leaderboard', async () => {
  vi.mocked(getPublicPassport).mockResolvedValue({
    profile,
    stats,
    badges: [],
    countries: [],
    derivedState: 'ready',
    publication: 'flights',
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
  vi.mocked(getPublicPassport).mockResolvedValue({
    profile,
    stats,
    rankings: [],
    countries: [],
    derivedState: 'ready',
    publication: 'flights',
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
  'a visitor on a private profile gets the closed cover and no name (viewer %#)',
  async (viewer, link, href) => {
    vi.mocked(getOptionalPublicViewer).mockResolvedValue(viewer as never)
    vi.mocked(getPublicPassport).mockResolvedValue(privateRead)
    const view = render(await ProfileData({ username: 'traveler' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'This passport is private.' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', href)
    expect(view.container.textContent).not.toContain('Traveler')
    expect(view.container.textContent).not.toContain('@traveler')
  },
)
it('sends a private owner to the visitor preview instead of a closed cover', async () => {
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(owner)
  vi.mocked(getPublicPassport).mockResolvedValue(privateRead)
  await expect(ProfileData({ username: 'traveler' })).rejects.toThrow(
    'NEXT_REDIRECT /passport?as=visitor',
  )
})
it('shows the owner on their own public page the same public read, with a slim link back to the passport', async () => {
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(owner)
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByText('This is your public page.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Back to my passport' })).toHaveAttribute(
    'href',
    '/passport',
  )
  // No owner controls and no private reads: the page is the visitor projection.
  expect(screen.queryByRole('button', { name: 'Share profile' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Passport menu' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /change in Settings/ })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Start your own flight journal' }),
  ).not.toBeInTheDocument()
})
it('missing profile shows the not-found cover with a home link; an unavailable read throws', async () => {
  vi.mocked(getPublicPassport).mockResolvedValue(null)
  render(await ProfileData({ username: 'missing' }))
  expect(screen.getByRole('heading', { level: 1, name: 'No such passport.' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  vi.mocked(getPublicPassport).mockRejectedValueOnce(new Error('D1 unavailable'))
  await expect(ProfileData({ username: 'missing' })).rejects.toThrow('D1 unavailable')
})

it('does not show unknown distance or duration as a visitor zero after saved flights', async () => {
  vi.mocked(getPublicPassport).mockResolvedValue({
    profile,
    stats: { ...stats, total_distance_km: 0, total_duration_minutes: 0 },
    badges: [],
    rankings: [],
    countries: [],
    derivedState: 'ready',
    publication: 'flights',
  })
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.queryByText('0 km')).not.toBeInTheDocument()
  expect(screen.queryByText('Distance flown')).not.toBeInTheDocument()
  expect(screen.queryByText('Hours in the air')).not.toBeInTheDocument()
  expect(screen.getByText('Flights')).toBeVisible()
})
