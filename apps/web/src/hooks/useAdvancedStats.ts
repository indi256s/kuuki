import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
 * Hook for fetching advanced stats with tier unlock information
 */
export function useAdvancedStats() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [ADVANCED_STATS_KEY, userId],
    queryFn: async (): Promise<AdvancedStats | null> => {
      if (!userId) return null

      const { data, error } = await supabase
        .from('user_advanced_stats')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If no record exists yet, return default unlocked state
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return {
        userId: data.user_id,
        aviaGeekUnlocked: data.avia_geek_unlocked ?? false,
        countryGeekUnlocked: data.country_geek_unlocked ?? false,
        durationUnlocked: data.duration_unlocked ?? false,
        manufacturerBreakdown: data.manufacturer_breakdown as Record<string, number> | null,
        aircraftBreakdown: data.aircraft_breakdown as Record<string, number> | null,
        aircraftTypeBreakdown: data.aircraft_type_breakdown as AircraftTypeBreakdown | null,
        continentBreakdown: data.continent_breakdown as Record<string, number> | null,
        regionBreakdown: data.region_breakdown as Record<string, number> | null,
        durationStats: data.duration_stats as AdvancedStats['durationStats'],
        departurePatterns: data.departure_patterns as DeparturePatterns | null,
        durationCoverage: (data.duration_coverage as number) ?? 0,
        patterns: data.patterns as Record<string, unknown> | null,
        cardInsights: (data as Record<string, unknown>).card_insights as AdvancedStats['cardInsights'],
        durationYearComparison: (data as Record<string, unknown>).duration_year_comparison as AdvancedStats['durationYearComparison'],
        featuredFact: data.featured_fact ?? null,
        featuredFactIndex: data.featured_fact_index ?? 0,
        updatedAt: data.updated_at ?? '',
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

      const { data, error } = await supabase
        .from('user_stats')
        .select('aircraft_count, countries_count, total_flights')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            aviaGeek: { current: 0, required: 5, unlocked: false },
            countryGeek: { current: 0, required: 5, unlocked: false },
            duration: { current: 0, required: 10, unlocked: false },
          }
        }
        throw error
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
