// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { JournalView } from './journal'
import { api } from '../../../../web/src/lib/apiClient'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('./journal-queue', () => ({ JournalQueue: () => null }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: vi.fn() } }))

it('refetches derived readiness instead of retaining the initial ready state, even with equal revisions', async () => {
  vi.mocked(api.get).mockImplementation(async path => (path === '/api/flights' ? { flights: [], total: 0 } : { revision: 4, published_revision: 4, derived_state: 'pending' }) as never)
  render(<JournalView ownerId="journal-owner" locale="en" query="" page={1} filtered={false} initial={{ flights: [], total: 0, revision: 4, publishedRevision: 4, derivedState: 'ready', updatedAt: Date.now() }} />)
  expect(screen.queryByText('Recent changes are still being prepared.')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await screen.findByText('Recent changes are still being prepared.')
})


it('groups upcoming flights first, then awaiting and logged history by year', () => {
  const flights = [{ id: 1, date: '2025-01-01', lifecycle_state: 'logged' }, { id: 2, date: '2026-10-03', lifecycle_state: 'awaiting' }, { id: 3, date: '2026-12-01', lifecycle_state: 'upcoming' }].map(flight => ({ ...flight, origin: 'TBS', destination: 'IST', departure_utc: null, arrival_utc: null }))
  render(<JournalView ownerId="group-owner" locale="en" query="" page={1} filtered={false} initial={{ flights: flights as never, total: 3, revision: 0, publishedRevision: 0, derivedState: 'ready', updatedAt: Date.now() }} />)
  expect(within(screen.getByTestId('journal-data')).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Upcoming', '2025 · Logged', '2026 · Awaiting'])
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
})
