import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useUnlockProgress } from './useAdvancedStats'

export interface DashboardStats {
    // Basic stats
    totalFlights: number
    totalDistance: number
    totalDuration: number
    uniqueCountries: number
    uniqueCities: number
    uniqueAirlines: number
    uniqueAircraft: number

    // Unlock status
    unlocks: {
        aviaGeek: boolean
        countryGeek: boolean
        timeGeek: boolean
    }

    // Upcoming flights
    upcomingFlights: Array<{
        id: number
        date: string
        origin: string
        destination: string
        airline_iata: string
        flight_number: string | null
    }>

    // Leaderboard percentiles (if opted in)
    percentiles: {
        countries: number | null
        cities: number | null
        flights: number | null
        distance: number | null
        airlines: number | null
    }

    // Milestones
    milestones: {
        moonProgress: number // percentage to 384,400 km
        earthTrips: number // trips around Earth (40,075 km each)
        timeInAir: { days: number; hours: number }
    }

    // Favorites (only if ≥30% threshold met)
    favorites: {
        airline: { iata: string; count: number; percentage: number } | null
        country: { code: string; count: number; percentage: number } | null
        aircraft: { icao: string; count: number; percentage: number } | null
    }
}

/**
 * Hook for fetching all dashboard stats with year filtering
 */
export function useDashboardStats() {
    const userId = useAuthStore((state) => state.user?.id)
    const selectedYear = useDashboardStore((state) => state.selectedYear)
    const { data: unlockProgress } = useUnlockProgress()

    return useQuery({
        queryKey: ['dashboardStats', userId, selectedYear],
        queryFn: async (): Promise<DashboardStats | null> => {
            if (!userId) return null

            // Build year filter
            const yearFilter = selectedYear === 'all'
                ? undefined
                : {
                    gte: `${selectedYear}-01-01`,
                    lte: `${selectedYear}-12-31`,
                }

            // Fetch basic stats
            const { data: stats, error: statsError } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (statsError && statsError.code !== 'PGRST116') {
                throw statsError
            }

            // Fetch upcoming flights
            const { data: upcoming, error: upcomingError } = await supabase
                .from('flights')
                .select('id, date, origin, destination, airline_iata, flight_number')
                .eq('user_id', userId)
                .eq('is_upcoming', true)
                .order('date', { ascending: true })
                .limit(3)

            if (upcomingError) throw upcomingError

            // Fetch year-filtered flights for favorites calculation
            let favoritesQuery = supabase
                .from('flights')
                .select('airline_iata, aircraft_icao')
                .eq('user_id', userId)

            if (yearFilter) {
                favoritesQuery = favoritesQuery
                    .gte('date', yearFilter.gte)
                    .lte('date', yearFilter.lte)
            }

            const { data: flights, error: flightsError } = await favoritesQuery

            if (flightsError) throw flightsError

            // Calculate favorites (≥30% threshold)
            const totalFlights = flights?.length || 0
            const threshold = totalFlights * 0.3

            // Airline favorite
            const airlineCounts = flights?.reduce((acc, f) => {
                if (f.airline_iata) {
                    acc[f.airline_iata] = (acc[f.airline_iata] || 0) + 1
                }
                return acc
            }, {} as Record<string, number>) || {}

            const topAirline = Object.entries(airlineCounts)
                .sort(([, a], [, b]) => b - a)[0]

            const airlineFavorite = topAirline && topAirline[1] >= threshold
                ? {
                    iata: topAirline[0],
                    count: topAirline[1],
                    percentage: (topAirline[1] / totalFlights) * 100,
                }
                : null

            // Aircraft favorite
            const aircraftCounts = flights?.reduce((acc, f) => {
                if (f.aircraft_icao) {
                    acc[f.aircraft_icao] = (acc[f.aircraft_icao] || 0) + 1
                }
                return acc
            }, {} as Record<string, number>) || {}

            const topAircraft = Object.entries(aircraftCounts)
                .sort(([, a], [, b]) => b - a)[0]

            const aircraftFavorite = topAircraft && topAircraft[1] >= threshold
                ? {
                    icao: topAircraft[0],
                    count: topAircraft[1],
                    percentage: (topAircraft[1] / totalFlights) * 100,
                }
                : null

            // Calculate milestones
            const totalDistance = stats?.total_distance_km || 0
            // Note: total_duration_minutes might not exist in user_stats yet
            // We'll use 0 as fallback for now
            const totalDuration = 0 // TODO: Calculate from flights or add to user_stats

            const moonDistance = 384400 // km
            const earthCircumference = 40075 // km

            const moonProgress = (totalDistance / moonDistance) * 100
            const earthTrips = totalDistance / earthCircumference
            const days = Math.floor(totalDuration / (60 * 24))
            const hours = Math.floor((totalDuration % (60 * 24)) / 60)

            return {
                totalFlights: stats?.total_flights || 0,
                totalDistance: stats?.total_distance_km || 0,
                totalDuration: totalDuration,
                uniqueCountries: stats?.countries_count || 0,
                uniqueCities: stats?.cities_count || 0,
                uniqueAirlines: stats?.airlines_count || 0,
                uniqueAircraft: stats?.aircraft_count || 0,

                unlocks: {
                    aviaGeek: unlockProgress?.aviaGeek.unlocked || false,
                    countryGeek: unlockProgress?.countryGeek.unlocked || false,
                    timeGeek: unlockProgress?.duration.unlocked || false,
                },

                upcomingFlights: (upcoming || []).filter(f => f.airline_iata !== null) as Array<{
                    id: number
                    date: string
                    origin: string
                    destination: string
                    airline_iata: string
                    flight_number: string | null
                }>,

                percentiles: {
                    // Note: percentile fields might not exist in user_stats yet
                    // Using null as fallback
                    countries: null,
                    cities: null,
                    flights: null,
                    distance: null,
                    airlines: null,
                },

                milestones: {
                    moonProgress,
                    earthTrips,
                    timeInAir: { days, hours },
                },

                favorites: {
                    airline: airlineFavorite,
                    country: null, // TODO: Calculate from airport countries
                    aircraft: aircraftFavorite,
                },
            }
        },
        enabled: !!userId,
    })
}
