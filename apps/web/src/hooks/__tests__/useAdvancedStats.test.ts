import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// Mock Supabase - must be defined before vi.mock
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'test-user-123' } })),
}))

// Import after mocks
import { useAdvancedStats, useUnlockProgress } from '../useAdvancedStats'
import { supabase } from '@/lib/supabase'

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
    vi.clearAllMocks()
  })

  it('returns default unlock progress when no user_stats exists', async () => {
    // Setup mock to return PGRST116 (no rows)
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          }),
        }),
      }),
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

  it('calculates unlock progress correctly when user has stats', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              aircraft_count: 7,
              countries_count: 3,
              total_flights: 15,
            },
            error: null,
          }),
        }),
      }),
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              aircraft_count: 5,
              countries_count: 4,
              total_flights: 9,
            },
            error: null,
          }),
        }),
      }),
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              aircraft_count: 2,
              countries_count: 5,
              total_flights: 5,
            },
            error: null,
          }),
        }),
      }),
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              aircraft_count: 2,
              countries_count: 3,
              total_flights: 10,
            },
            error: null,
          }),
        }),
      }),
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              aircraft_count: null,
              countries_count: null,
              total_flights: null,
            },
            error: null,
          }),
        }),
      }),
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
    vi.clearAllMocks()
  })

  it('returns null when no advanced stats record exists', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          }),
        }),
      }),
    })

    const { result } = renderHook(() => useAdvancedStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('parses advanced stats correctly from database', async () => {
    const mockData = {
      user_id: mockUserId,
      avia_geek_unlocked: true,
      country_geek_unlocked: false,
      duration_unlocked: true,
      manufacturer_breakdown: { Airbus: 5, Boeing: 3 },
      aircraft_breakdown: { A320: 3, '737': 2 },
      continent_breakdown: { EU: 10, AS: 5 },
      duration_stats: {
        total_minutes: 5000,
        avg_minutes: 120,
        longest_minutes: 600,
        longest_flight_id: 'flight-1',
        shortest_minutes: 45,
        shortest_flight_id: 'flight-2',
        flight_count: 42,
      },
      patterns: { favorite_route: 'IST-TBS' },
      featured_fact: "You've flown the length of the Amazon 3 times",
      featured_fact_index: 2,
      updated_at: '2026-02-01T00:00:00Z',
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      }),
    })

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
      continentBreakdown: { EU: 10, AS: 5 },
      durationStats: {
        total_minutes: 5000,
        avg_minutes: 120,
        longest_minutes: 600,
        longest_flight_id: 'flight-1',
        shortest_minutes: 45,
        shortest_flight_id: 'flight-2',
        flight_count: 42,
      },
      patterns: { favorite_route: 'IST-TBS' },
      featuredFact: "You've flown the length of the Amazon 3 times",
      featuredFactIndex: 2,
      updatedAt: '2026-02-01T00:00:00Z',
    })
  })

  it('handles null JSONB fields gracefully', async () => {
    const mockData = {
      user_id: mockUserId,
      avia_geek_unlocked: false,
      country_geek_unlocked: false,
      duration_unlocked: false,
      manufacturer_breakdown: null,
      aircraft_breakdown: null,
      continent_breakdown: null,
      duration_stats: null,
      patterns: null,
      featured_fact: null,
      featured_fact_index: 0,
      updated_at: null,
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      }),
    })

    const { result } = renderHook(() => useAdvancedStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.manufacturerBreakdown).toBeNull()
    expect(result.current.data?.aircraftBreakdown).toBeNull()
    expect(result.current.data?.continentBreakdown).toBeNull()
    expect(result.current.data?.durationStats).toBeNull()
    expect(result.current.data?.patterns).toBeNull()
    expect(result.current.data?.featuredFact).toBeNull()
  })
})
