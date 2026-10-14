// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import PublicLayout from '../../app/(public)/layout'
import { ProfileData } from '../../app/(public)/fly/[username]/page'
import { getOptionalPublicViewer } from '../../server/identity'
import { getPublicPassport } from '../../server/passport'
vi.mock('../../server/identity', () => ({ getOptionalPublicViewer: vi.fn() }))
vi.mock('../../server/passport', () => ({ getPublicPassport: vi.fn() }))
vi.mock('../../server/locale', () => ({ getRequestLocale: () => Promise.resolve('en') }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/fly/B',
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`)
  },
}))
vi.mock('next/link', async () => ({
  default: (await import('../../test/next-link')).linkStandIn(() => {}),
}))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('../route-transitions', () => ({
  RouteStage: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../shell', () => ({
  MemberShell: ({ children }: { children: React.ReactNode }) => children,
  BrandShell: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('./badge-notifications', () => ({
  BadgeNotifications: ({ ownerId }: { ownerId: string }) => (
    <span data-testid="notification-account">{ownerId}</span>
  ),
}))
vi.mock('./avatar', () => ({ ProfileAvatar: () => null }))
vi.mock('../activity', () => ({
  IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children,
}))
const profile = {
  id: 'B',
  username: 'B',
  display_name: 'Traveler B',
  bio: null,
  avatar_url: null,
  is_public: true,
  show_on_leaderboards: false,
  theme_color: null,
  created_at: null,
}
beforeEach(() =>
  vi
    .mocked(getOptionalPublicViewer)
    .mockResolvedValue({ id: 'A', email: 'a@example.test' } as Awaited<
      ReturnType<typeof getOptionalPublicViewer>
    >),
)
it.each(['public', 'private', 'missing'] as const)(
  'keeps one account A notification manager while A visits B’s %s profile',
  async (state) => {
    vi.mocked(getPublicPassport).mockResolvedValue(
      state === 'missing'
        ? null
        : state === 'private'
          ? {
              profile: { ...profile, display_name: null, is_public: false },
              stats: null,
              badges: [],
              rankings: [],
              countries: [],
              derivedState: 'private',
              publication: null,
            }
          : {
              profile,
              stats: null,
              badges: [],
              rankings: [],
              countries: [],
              derivedState: 'ready',
              publication: 'flights',
            },
    )
    render(await PublicLayout({ children: await ProfileData({ username: 'B' }) }))
    expect(screen.getAllByTestId('notification-account')).toHaveLength(1)
    expect(screen.getByTestId('notification-account')).toHaveTextContent('A')
    expect(screen.getByTestId('notification-account')).not.toHaveTextContent('B')
  },
)
it('does not duplicate notifications on own public profile or mount private notifications for guests', async () => {
  vi.mocked(getPublicPassport).mockResolvedValue({
    profile,
    stats: null,
    badges: [],
    rankings: [],
    countries: [],
    derivedState: 'ready',
    publication: 'flights',
  })
  vi.mocked(getOptionalPublicViewer).mockResolvedValue({
    id: 'B',
    email: 'b@example.test',
  } as Awaited<ReturnType<typeof getOptionalPublicViewer>>)
  const view = render(await PublicLayout({ children: await ProfileData({ username: 'B' }) }))
  expect(screen.getAllByTestId('notification-account')).toHaveLength(1)
  expect(screen.getByTestId('notification-account')).toHaveTextContent('B')
  view.unmount()
  vi.mocked(getOptionalPublicViewer).mockResolvedValue(null)
  render(await PublicLayout({ children: await ProfileData({ username: 'B' }) }))
  expect(screen.queryByTestId('notification-account')).not.toBeInTheDocument()
})
