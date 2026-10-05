import { createElement } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'

vi.mock('@/lib/flights', () => ({ syncUpcomingFlights: vi.fn() }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'owner' } }) }))
vi.mock('@/lib/derivedStateFeedback', () => ({ reconcileDerivedState: vi.fn() }))
import { syncUpcomingFlights } from '@/lib/flights'
import { reconcileDerivedState } from '@/lib/derivedStateFeedback'
import { useSyncUpcomingFlights } from '../useFlights'

it('reconciles a stamp-only repair even when no lifecycle rows changed', async () => {
  const ack = { synced: 0, derived_state: 'ready' as const, revision: 3 }
  vi.mocked(syncUpcomingFlights).mockResolvedValueOnce(ack)
  const client = new QueryClient()
  const hook = renderHook(() => useSyncUpcomingFlights(), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  })
  try { await waitFor(() => expect(reconcileDerivedState).toHaveBeenCalledWith(ack, client, 'owner')) }
  finally { hook.unmount(); client.clear() }
})
