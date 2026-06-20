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
import { useAdvancedStats, useUnlockProgress } from '../useAdvancedStats'
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

describe('useUnlockProgress', () => {
  beforeEach(() => {
    resetApiMock()
  })

  it('returns default unlock progress when no user_stats exists', async () => {
    // No stats row yet -> API returns null
    vi.mocked(api.get).mockResolvedValue(null)

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.get).toHaveBeenCalledWith('/api/me/stats')
    expect(result.current.data).toEqual({
      aviaGeek: { current: 0, required: 5, unlocked: false },
      countryGeek: { current: 0, required: 5, unlocked: false },
      duration: { current: 0, required: 10, unlocked: false },
    })
  })

  it('calculates unlock progress correctly when user has stats', async () => {
    vi.mocked(api.get).mockResolvedValue({
      aircraft_count: 7,
      countries_count: 3,
      total_flights: 15,
    })

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      aviaGeek: { current: 7, required: 5, unlocked: true },
      countryGeek: { current: 3, required: 5, unlocked: false },
      duration: { current: 15, required: 10, unlocked: true },
    })
  })

  it('unlocks aviaGeek at exactly 5 aircraft', async () => {
    vi.mocked(api.get).mockResolvedValue({
      aircraft_count: 5,
      countries_count: 4,
      total_flights: 9,
    })

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.aviaGeek.unlocked).toBe(true)
    expect(result.current.data?.countryGeek.unlocked).toBe(false)
    expect(result.current.data?.duration.unlocked).toBe(false)
  })

  it('unlocks countryGeek at exactly 5 countries', async () => {
    vi.mocked(api.get).mockResolvedValue({
      aircraft_count: 2,
      countries_count: 5,
      total_flights: 5,
    })

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.aviaGeek.unlocked).toBe(false)
    expect(result.current.data?.countryGeek.unlocked).toBe(true)
    expect(result.current.data?.duration.unlocked).toBe(false)
  })

  it('unlocks duration at exactly 10 flights', async () => {
    vi.mocked(api.get).mockResolvedValue({
      aircraft_count: 2,
      countries_count: 3,
      total_flights: 10,
    })

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.aviaGeek.unlocked).toBe(false)
    expect(result.current.data?.countryGeek.unlocked).toBe(false)
    expect(result.current.data?.duration.unlocked).toBe(true)
  })

  it('handles null values in stats gracefully', async () => {
    vi.mocked(api.get).mockResolvedValue({
      aircraft_count: null,
      countries_count: null,
      total_flights: null,
    })

    const { result } = renderHook(() => useUnlockProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      aviaGeek: { current: 0, required: 5, unlocked: false },
      countryGeek: { current: 0, required: 5, unlocked: false },
      duration: { current: 0, required: 10, unlocked: false },
    })
  })
})

describe('useAdvancedStats', () => {
  beforeEach(() => {
    resetApiMock()
  })

  it('returns null when no advanced stats record exists', async () => {
    // No record -> API returns null
    vi.mocked(api.get).mockResolvedValue(null)

    const { result } = renderHook(() => useAdvancedStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.get).toHaveBeenCalledWith('/api/me/advanced-stats')
    expect(result.current.data).toBeNull()
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

  it('handles null JSON fields gracefully', async () => {
    const mockData = {
      user_id: mockUserId,
      avia_geek_unlocked: false,
      country_geek_unlocked: false,
      duration_unlocked: false,
      manufacturer_breakdown: null,
      aircraft_breakdown: null,
      aircraft_type_breakdown: null,
      continent_breakdown: null,
      region_breakdown: null,
      duration_stats: null,
      departure_patterns: null,
      duration_coverage: null,
      patterns: null,
      card_insights: null,
      duration_year_comparison: null,
      fleet_insights: null,
      manufacturer_insights: null,
      featured_fact: null,
      featured_fact_index: 0,
      updated_at: null,
    }

    vi.mocked(api.get).mockResolvedValue(mockData)

    const { result } = renderHook(() => useAdvancedStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.manufacturerBreakdown).toBeNull()
    expect(result.current.data?.aircraftBreakdown).toBeNull()
    expect(result.current.data?.aircraftTypeBreakdown).toBeNull()
    expect(result.current.data?.continentBreakdown).toBeNull()
    expect(result.current.data?.regionBreakdown).toBeNull()
    expect(result.current.data?.durationStats).toBeNull()
    expect(result.current.data?.departurePatterns).toBeNull()
    expect(result.current.data?.durationCoverage).toBe(0)
    expect(result.current.data?.patterns).toBeNull()
    expect(result.current.data?.featuredFact).toBeNull()
  })
})
