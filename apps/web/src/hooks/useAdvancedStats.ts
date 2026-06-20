import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

export interface MostFlownAircraft {
  icao: string
  name: string
  count: number
  total_flights: number
}

export interface AircraftTypeBreakdown {
  types: Record<string, number>  // {widebody: 5, narrowbody: 20, ...}
  most_flown: MostFlownAircraft | null
}

export interface DeparturePatterns {
  red_eye: number
  early: number
  business: number
  evening: number
  total_with_time: number
}

export interface FleetInsights {
  hero: {
    icao: string
    model: string
    manufacturer: string
    name: string
    type: string
    count: number
    pct: number
    total_distance_km: number
    total_duration_minutes: number
    fun_fact: string
  }
}

export interface ManufacturerInsights {
  dominant: {
    name: string
    pct: number
    count: number
    types_count: number
    loyalty_label: string
    loyalty_quip: string
  }
}

export interface AdvancedStats {
  userId: string
  // Unlock flags
  aviaGeekUnlocked: boolean
  countryGeekUnlocked: boolean
  durationUnlocked: boolean
  // Pre-computed analytics
  manufacturerBreakdown: Record<string, number> | null
  aircraftBreakdown: Record<string, number> | null
  aircraftTypeBreakdown: AircraftTypeBreakdown | null  // NEW for Phase 5b
  continentBreakdown: Record<string, number> | null
  regionBreakdown: Record<string, number> | null  // NEW for Phase 5b
  durationStats: {
    total_minutes: number
    avg_minutes: number
    longest_minutes: number
    longest_flight_id: number | null
    shortest_minutes: number
    shortest_flight_id: number | null
    flight_count: number
  } | null
  departurePatterns: DeparturePatterns | null  // NEW for Phase 5c
  durationCoverage: number  // NEW for Phase 5c - percentage 0-100
  patterns: Record<string, unknown> | null
  cardInsights: {
    aircraft: string
    manufacturer: string
    continent: string
    duration: string
  } | null
  durationYearComparison: {
    current_year: number
    current_total_minutes: number
    previous_total_minutes: number
    delta_percent: number
  } | null
  fleetInsights: FleetInsights | null
  manufacturerInsights: ManufacturerInsights | null
  featuredFact: string | null
  featuredFactIndex: number
  updatedAt: string
}

export interface UnlockProgress {
  aviaGeek: { current: number; required: number; unlocked: boolean }
  countryGeek: { current: number; required: number; unlocked: boolean }
  duration: { current: number; required: number; unlocked: boolean }
}

const ADVANCED_STATS_KEY = 'advancedStats'

/**
 * Raw advanced-stats row as returned by GET /api/me/advanced-stats.
 * Snake_case keys mirror the old Supabase user_advanced_stats row; the API parses the
 * JSON-TEXT columns and coerces the *_unlocked flags to booleans server-side.
 */
interface ApiAdvancedStats {
  user_id: string
  avia_geek_unlocked: boolean
  country_geek_unlocked: boolean
  duration_unlocked: boolean
  manufacturer_breakdown: Record<string, number> | null
  aircraft_breakdown: Record<string, number> | null
  aircraft_type_breakdown: AircraftTypeBreakdown | null
  continent_breakdown: Record<string, number> | null
  region_breakdown: Record<string, number> | null
  duration_stats: AdvancedStats['durationStats']
  departure_patterns: DeparturePatterns | null
  duration_coverage: number | null
  patterns: Record<string, unknown> | null
  card_insights: AdvancedStats['cardInsights']
  duration_year_comparison: AdvancedStats['durationYearComparison']
  fleet_insights: FleetInsights | null
  manufacturer_insights: ManufacturerInsights | null
  featured_fact: string | null
  featured_fact_index: number | null
  updated_at: string | null
}

/**
 * Stats row consumed by useUnlockProgress (GET /api/me/stats).
 */
interface ApiUserStats {
  aircraft_count: number | null
  countries_count: number | null
  total_flights: number | null
}

/**
 * Hook for fetching advanced stats with tier unlock information
 */
export function useAdvancedStats() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [ADVANCED_STATS_KEY, userId],
    queryFn: async (): Promise<AdvancedStats | null> => {
      if (!userId) return null

      try {
        const data = await api.get<ApiAdvancedStats | null>('/api/me/advanced-stats')

        // No record exists yet — preserve the original PGRST116 null behavior.
        if (!data) return null

        return {
          userId: data.user_id,
          aviaGeekUnlocked: data.avia_geek_unlocked ?? false,
          countryGeekUnlocked: data.country_geek_unlocked ?? false,
          durationUnlocked: data.duration_unlocked ?? false,
          manufacturerBreakdown: data.manufacturer_breakdown,
          aircraftBreakdown: data.aircraft_breakdown,
          aircraftTypeBreakdown: data.aircraft_type_breakdown,
          continentBreakdown: data.continent_breakdown,
          regionBreakdown: data.region_breakdown,
          durationStats: data.duration_stats,
          departurePatterns: data.departure_patterns,
          durationCoverage: data.duration_coverage ?? 0,
          patterns: data.patterns,
          cardInsights: data.card_insights,
          durationYearComparison: data.duration_year_comparison,
          fleetInsights: data.fleet_insights,
          manufacturerInsights: data.manufacturer_insights,
          featuredFact: data.featured_fact ?? null,
          featuredFactIndex: data.featured_fact_index ?? 0,
          updatedAt: data.updated_at ?? '',
        }
      } catch (error) {
        console.error('Error fetching advanced stats:', error)
        return null
      }
    },
    enabled: !!userId,
  })
}

/**
 * Hook that combines basic stats with unlock progress calculation
 */
export function useUnlockProgress() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: ['unlockProgress', userId],
    queryFn: async (): Promise<UnlockProgress | null> => {
      if (!userId) return null

      const data = await api.get<ApiUserStats | null>('/api/me/stats')

      // No stats row yet — same default progress the PGRST116 path returned.
      if (!data) {
        return {
          aviaGeek: { current: 0, required: 5, unlocked: false },
          countryGeek: { current: 0, required: 5, unlocked: false },
          duration: { current: 0, required: 10, unlocked: false },
        }
      }

      return {
        aviaGeek: {
          current: data.aircraft_count ?? 0,
          required: 5,
          unlocked: (data.aircraft_count ?? 0) >= 5,
        },
        countryGeek: {
          current: data.countries_count ?? 0,
          required: 5,
          unlocked: (data.countries_count ?? 0) >= 5,
        },
        duration: {
          current: data.total_flights ?? 0,
          required: 10,
          unlocked: (data.total_flights ?? 0) >= 10,
        },
      }
    },
    enabled: !!userId,
  })
}

// Re-export types
export type { AdvancedStats as AdvancedStatsData }
