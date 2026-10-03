import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// Mock the apiClient - must be defined before importing the hooks under test
vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'test-user-123' } })),
}))

// Import after mocks
import { useAdvancedStats } from '../useAdvancedStats'
import { api, resetApiMock } from '@/test/mocks/apiClient'

const mockUserId = 'test-user-123'

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useAdvancedStats', () => {
  beforeEach(() => {
    resetApiMock()
  })

  it('parses advanced stats correctly from the API', async () => {
    // Snake_case DTO: the API already parses JSON columns and coerces *_unlocked to booleans.
    const mockData = {
      user_id: mockUserId,
      avia_geek_unlocked: true,
      country_geek_unlocked: false,
      duration_unlocked: true,
      manufacturer_breakdown: { Airbus: 5, Boeing: 3 },
      aircraft_breakdown: { A320: 3, '737': 2 },
      aircraft_type_breakdown: { types: { widebody: 5, narrowbody: 10 }, most_flown: null },
      continent_breakdown: { EU: 10, AS: 5 },
      region_breakdown: { europe: 10, asia: 5 },
      duration_stats: {
        total_minutes: 5000,
        avg_minutes: 120,
        longest_minutes: 600,
        longest_flight_id: 1,
        shortest_minutes: 45,
        shortest_flight_id: 2,
        flight_count: 42,
      },
      departure_patterns: { red_eye: 5, early: 10, business: 20, evening: 7, total_with_time: 42 },
      duration_coverage: 95.5,
      patterns: { favorite_route: 'IST-TBS' },
      card_insights: null,
      duration_year_comparison: null,
      fleet_insights: null,
      manufacturer_insights: null,
      featured_fact: "You've flown the length of the Amazon 3 times",
      featured_fact_index: 2,
      updated_at: '2026-02-01T00:00:00Z',
    }

    vi.mocked(api.get).mockResolvedValue(mockData)

    const { result } = renderHook(() => useAdvancedStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      userId: mockUserId,
      aviaGeekUnlocked: true,
      countryGeekUnlocked: false,
      durationUnlocked: true,
      manufacturerBreakdown: { Airbus: 5, Boeing: 3 },
      aircraftBreakdown: { A320: 3, '737': 2 },
      aircraftTypeBreakdown: { types: { widebody: 5, narrowbody: 10 }, most_flown: null },
      continentBreakdown: { EU: 10, AS: 5 },
      regionBreakdown: { europe: 10, asia: 5 },
      durationStats: {
        total_minutes: 5000,
        avg_minutes: 120,
        longest_minutes: 600,
        longest_flight_id: 1,
        shortest_minutes: 45,
        shortest_flight_id: 2,
        flight_count: 42,
      },
      departurePatterns: { red_eye: 5, early: 10, business: 20, evening: 7, total_with_time: 42 },
      durationCoverage: 95.5,
      patterns: { favorite_route: 'IST-TBS' },
      cardInsights: null,
      durationYearComparison: null,
      fleetInsights: null,
      manufacturerInsights: null,
      featuredFact: "You've flown the length of the Amazon 3 times",
      featuredFactIndex: 2,
      updatedAt: '2026-02-01T00:00:00Z',
    })
  })
})
