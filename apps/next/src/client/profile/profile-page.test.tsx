// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProfileData } from '../../app/(public)/fly/[username]/page'
import { getPublicProfile } from '../../server/public'
import { getOptionalPublicViewer } from '../../server/identity'
import { getOwnProfile, getOwnProfileStats, getOwnBadges, getProfileShareUrl } from '../../server/profile'
import { getRequestLocale } from '../../server/locale'
vi.mock('../../server/public', () => ({ getPublicProfile: vi.fn() }))
vi.mock('../../server/identity', () => ({ getOptionalPublicViewer: vi.fn() }))
vi.mock('../../server/profile', () => ({ getOwnProfile: vi.fn(), getOwnProfileStats: vi.fn(), getOwnBadges: vi.fn(), getProfileShareUrl: vi.fn() }))
vi.mock('../../server/locale', () => ({ getRequestLocale: vi.fn() }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('./badge-notifications', () => ({ BadgeNotifications: () => null }))
vi.mock('../avatar', () => ({ ProfileAvatar: () => <span aria-hidden="true" /> }))
vi.mock('../activity', () => ({ IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children }))
const profile = { id: 'owner', username: 'traveler', display_name: 'Traveler', bio: 'A biography', avatar_url: null, is_public: true, show_on_leaderboards: false, theme_color: null, created_at: '2026-10-04' }
const stats = { user_id: 'owner', total_flights: 9, total_distance_km: 12345, total_duration_minutes: 60, longest_flight_minutes: 30, airports_count: 4, cities_count: 2, countries_count: 2, continents_count: 1, airlines_count: 0, aircraft_count: 0, time_zones_count: 0, most_visited_country: null, most_visited_count: 0, world_completion_pct: 0, has_night_departure: false, updated_at: '2026-10-04' }
beforeEach(() => { vi.mocked(getRequestLocale).mockResolvedValue('en'); vi.mocked(getOptionalPublicViewer).mockResolvedValue(null); vi.mocked(getPublicProfile).mockResolvedValue({ profile, stats, badges: [], rankings: [], derivedState: 'ready' }); vi.mocked(getOwnProfileStats).mockClear(); vi.mocked(getOwnProfile).mockClear(); vi.mocked(getOwnBadges).mockClear(); vi.mocked(getProfileShareUrl).mockResolvedValue('https://configured.example/fly/traveler') })
it('visitor sees public identity, headings, real metrics and signup; missing aircraft/airline metrics stay hidden', async () => {
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('heading', { name: 'Traveler' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Achievements' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Leaderboard place' })).toBeVisible()
  expect(screen.getByText('12,345 km', { exact: false })).toBeVisible()
  expect(screen.queryByText('Aircraft types')).not.toBeInTheDocument()
  expect(screen.queryByText('Airlines')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Start your own flight journal' })).toHaveAttribute('href', '/signup')
  expect(getOwnProfileStats).not.toHaveBeenCalled()
  expect(screen.queryByText('Founding crew')).not.toBeInTheDocument()
})
it('private visitor has one privacy message and no identity, stats, badges, signup or private reads', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({ profile: { ...profile, is_public: false, display_name: null, bio: null, created_at: null, avatar_url: null }, stats: null, badges: [], rankings: [], derivedState: 'private' })
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('status')).toHaveTextContent('This profile is private.')
  expect(screen.queryByText('Traveler')).not.toBeInTheDocument()
  expect(screen.queryByText('@traveler')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Statistics' })).not.toBeInTheDocument()
  expect(getOwnProfile).not.toHaveBeenCalled()
  expect(getOwnProfileStats).not.toHaveBeenCalled()
  expect(getOwnBadges).not.toHaveBeenCalled()
})
it('private owner sees gated actual full statistics, visibility explanation and owner share/settings actions', async () => {
  vi.mocked(getOptionalPublicViewer).mockResolvedValue({ id: 'owner', email: 'owner@example.test' } as Awaited<ReturnType<typeof getOptionalPublicViewer>>)
  vi.mocked(getPublicProfile).mockResolvedValue({ profile: { ...profile, is_public: false, display_name: null, bio: null, created_at: null, avatar_url: null, theme_color: null }, stats: null, badges: [], rankings: [], derivedState: 'private' })
  vi.mocked(getOwnProfile).mockResolvedValue({ ownerId: 'owner', profile: { ...profile, is_public: false, gemini_api_key: 'PRIVATE-KEY', home_airport: null, locale: 'en', updated_at: '2026-10-04' } } as Awaited<ReturnType<typeof getOwnProfile>>)
  vi.mocked(getOwnProfileStats).mockResolvedValue(stats)
  vi.mocked(getOwnBadges).mockResolvedValue([])
  const view = render(await ProfileData({ username: 'traveler' }))
  expect(screen.getByRole('heading', { name: 'Your statistics' })).toBeVisible()
  expect(screen.getByText('12,345 km', { exact: false })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Your profile is private')
  expect(screen.getByRole('button', { name: 'Copy profile link' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Settings and profile' })).toHaveAttribute('href', '/settings')
  expect(screen.getByRole('link', { name: 'View leaderboard' })).toHaveAttribute('href', '/leaderboard')
  expect(view.container.innerHTML).not.toContain('PRIVATE-KEY')
  expect(getOwnProfileStats).toHaveBeenCalledWith('owner')
})
it('missing profile retains home link and an unavailable read throws to the error boundary', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue(null)
  render(await ProfileData({ username: 'missing' }))
  expect(screen.getByRole('heading', { name: 'Profile not found' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  vi.mocked(getPublicProfile).mockRejectedValueOnce(new Error('D1 unavailable'))
  await expect(ProfileData({ username: 'missing' })).rejects.toThrow('D1 unavailable')
})

it('does not show unknown distance or duration as a visitor zero after saved flights', async () => {
  vi.mocked(getPublicProfile).mockResolvedValue({ profile, stats: { ...stats, total_distance_km: 0, total_duration_minutes: 0 }, badges: [], rankings: [], derivedState: 'ready' })
  render(await ProfileData({ username: 'traveler' }))
  expect(screen.queryByText('0 km')).not.toBeInTheDocument()
  expect(screen.queryByText('Around the world')).not.toBeInTheDocument()
  expect(screen.queryByText('Air time, h')).not.toBeInTheDocument()
  expect(screen.getByText('Flights')).toBeVisible()
})
