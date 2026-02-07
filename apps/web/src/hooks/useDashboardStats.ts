import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { findAirport, findCountry } from '@kuuki/data'
import type { FlightFilters } from '@/lib/flights'

export interface DashboardStats {
    // Basic stats
    totalFlights: number
    totalDistance: number
    totalDuration: number
    uniqueCountries: number
    uniqueCities: number
    uniqueAirlines: number
    uniqueAircraft: number
    uniqueAirports: number
    continentsCount: number

    // Visited country codes (for map)
    visitedCountries: string[]

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

    // Favorites (only if ≥30% threshold met)
    favorites: {
        airline: { iata: string; count: number; percentage: number } | null
        country: { code: string; count: number; percentage: number } | null
        aircraft: { icao: string; count: number; percentage: number } | null
    }
}

function hasActiveFilters(filters: FlightFilters): boolean {
    return !!(
        filters.year ||
        filters.airlineIata ||
        filters.aircraftIcao ||
        filters.isUpcoming !== undefined ||
        filters.origin ||
        filters.destination ||
        (filters.originCodes && filters.originCodes.length > 0) ||
        (filters.destinationCodes && filters.destinationCodes.length > 0) ||
        (filters.airlineIataCodes && filters.airlineIataCodes.length > 0)
    )
}

function applyFiltersToQuery(
    query: ReturnType<ReturnType<typeof supabase.from>['select']>,
    filters: FlightFilters
) {
    if (filters.year) {
        query = query
            .gte('date', `${filters.year}-01-01`)
            .lte('date', `${filters.year}-12-31`)
    }

    if (filters.airlineIataCodes && filters.airlineIataCodes.length > 0) {
        query = query.in('airline_iata', filters.airlineIataCodes)
    } else if (filters.airlineIata) {
        query = query.eq('airline_iata', filters.airlineIata)
    }

    if (filters.aircraftIcao) {
        query = query.eq('aircraft_icao', filters.aircraftIcao)
    }

    if (filters.originCodes && filters.originCodes.length > 0) {
        query = query.in('origin', filters.originCodes.map(c => c.toUpperCase()))
    } else if (filters.origin) {
        query = query.eq('origin', filters.origin.toUpperCase())
    }

    if (filters.destinationCodes && filters.destinationCodes.length > 0) {
        query = query.in('destination', filters.destinationCodes.map(c => c.toUpperCase()))
    } else if (filters.destination) {
        query = query.eq('destination', filters.destination.toUpperCase())
    }

    return query
}

/**
 * Hook for fetching all dashboard stats with filter support.
 * When no filters are active, uses the pre-computed user_stats table (fast path).
 * When any filter is active, queries raw flights and computes stats client-side.
 */
export function useDashboardStats() {
    const userId = useAuthStore((state) => state.user?.id)
    const filters = useDashboardStore((state) => state.filters)

    return useQuery({
        queryKey: ['dashboardStats', userId, filters],
        queryFn: async (): Promise<DashboardStats | null> => {
            if (!userId) return null

            const filtersActive = hasActiveFilters(filters)

            if (filtersActive) {
                return fetchFilteredStats(userId, filters)
            }

            return fetchUnfilteredStats(userId)
        },
        enabled: !!userId,
    })
}

/**
 * Fast path: no filters active, use pre-computed user_stats + separate favorites query.
 */
async function fetchUnfilteredStats(userId: string): Promise<DashboardStats> {
    const [
        { data: stats, error: statsError },
        { data: upcoming, error: upcomingError },
        { data: flights, error: flightsError },
    ] = await Promise.all([
        supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single(),
        supabase
            .from('flights')
            .select('id, date, origin, destination, airline_iata, flight_number')
            .eq('user_id', userId)
            .eq('is_upcoming', true)
            .order('date', { ascending: true })
            .limit(5),
        supabase
            .from('flights')
            .select('airline_iata, aircraft_icao, origin, destination')
            .eq('user_id', userId)
            .eq('is_upcoming', false),
    ])

    if (statsError && statsError.code !== 'PGRST116') throw statsError
    if (upcomingError) throw upcomingError
    if (flightsError) throw flightsError

    const visitedCountries = extractCountryCodes(flights || [])
    const favorites = computeFavorites(flights || [])

    return {
        totalFlights: stats?.total_flights || 0,
        totalDistance: stats?.total_distance_km || 0,
        totalDuration: stats?.total_duration_minutes || 0,
        uniqueCountries: stats?.countries_count || 0,
        uniqueCities: stats?.cities_count || 0,
        uniqueAirlines: stats?.airlines_count || 0,
        uniqueAircraft: stats?.aircraft_count || 0,
        uniqueAirports: stats?.airports_count || 0,
        continentsCount: stats?.continents_count || 0,
        visitedCountries,
        upcomingFlights: filterValidUpcoming(upcoming || []),
        percentiles: {
            countries: null,
            cities: null,
            flights: null,
            distance: null,
            airlines: null,
        },
        favorites,
    }
}

/**
 * Filtered path: query raw flights with filters applied, compute all stats client-side.
 */
async function fetchFilteredStats(userId: string, filters: FlightFilters): Promise<DashboardStats> {
    let flightsQuery = supabase
        .from('flights')
        .select('origin, destination, distance_km, duration_minutes, airline_iata, aircraft_icao, date')
        .eq('user_id', userId)
        .eq('is_upcoming', false)

    flightsQuery = applyFiltersToQuery(flightsQuery, filters)

    const [
        { data: flights, error: flightsError },
        { data: upcoming, error: upcomingError },
    ] = await Promise.all([
        flightsQuery,
        supabase
            .from('flights')
            .select('id, date, origin, destination, airline_iata, flight_number')
            .eq('user_id', userId)
            .eq('is_upcoming', true)
            .order('date', { ascending: true })
            .limit(5),
    ])

    if (flightsError) throw flightsError
    if (upcomingError) throw upcomingError

    const allFlights = flights || []

    // Compute stats from raw flights
    let totalDistance = 0
    let totalDuration = 0
    const countries = new Set<string>()
    const cities = new Set<string>()
    const airlines = new Set<string>()
    const aircraft = new Set<string>()
    const airports = new Set<string>()
    const continents = new Set<string>()

    for (const f of allFlights) {
        totalDistance += f.distance_km ?? 0
        totalDuration += f.duration_minutes ?? 0

        airports.add(f.origin)
        airports.add(f.destination)

        if (f.airline_iata) airlines.add(f.airline_iata)
        if (f.aircraft_icao) aircraft.add(f.aircraft_icao)

        const originAirport = findAirport(f.origin)
        const destAirport = findAirport(f.destination)

        if (originAirport?.countryCode) {
            countries.add(originAirport.countryCode)
            const country = findCountry(originAirport.countryCode)
            if (country?.continent) continents.add(country.continent)
        }
        if (destAirport?.countryCode) {
            countries.add(destAirport.countryCode)
            const country = findCountry(destAirport.countryCode)
            if (country?.continent) continents.add(country.continent)
        }

        if (originAirport?.city) cities.add(`${originAirport.countryCode}-${originAirport.city}`)
        if (destAirport?.city) cities.add(`${destAirport.countryCode}-${destAirport.city}`)
    }

    const visitedCountries = Array.from(countries)
    const favorites = computeFavorites(allFlights)

    return {
        totalFlights: allFlights.length,
        totalDistance: Math.round(totalDistance),
        totalDuration: Math.round(totalDuration),
        uniqueCountries: countries.size,
        uniqueCities: cities.size,
        uniqueAirlines: airlines.size,
        uniqueAircraft: aircraft.size,
        uniqueAirports: airports.size,
        continentsCount: continents.size,
        visitedCountries,
        upcomingFlights: filterValidUpcoming(upcoming || []),
        percentiles: {
            countries: null,
            cities: null,
            flights: null,
            distance: null,
            airlines: null,
        },
        favorites,
    }
}

function extractCountryCodes(flights: Array<{ origin: string; destination: string }>): string[] {
    const codes = new Set<string>()
    for (const f of flights) {
        const orig = findAirport(f.origin)
        const dest = findAirport(f.destination)
        if (orig?.countryCode) codes.add(orig.countryCode)
        if (dest?.countryCode) codes.add(dest.countryCode)
    }
    return Array.from(codes)
}

function computeFavorites(flights: Array<{ airline_iata: string | null; aircraft_icao: string | null; origin: string; destination: string }>) {
    const total = flights.length
    const threshold = total * 0.3

    // Airline favorite
    const airlineCounts: Record<string, number> = {}
    const aircraftCounts: Record<string, number> = {}
    const countryCounts: Record<string, number> = {}

    for (const f of flights) {
        if (f.airline_iata) airlineCounts[f.airline_iata] = (airlineCounts[f.airline_iata] || 0) + 1
        if (f.aircraft_icao) aircraftCounts[f.aircraft_icao] = (aircraftCounts[f.aircraft_icao] || 0) + 1

        const orig = findAirport(f.origin)
        const dest = findAirport(f.destination)
        if (orig?.countryCode) countryCounts[orig.countryCode] = (countryCounts[orig.countryCode] || 0) + 1
        if (dest?.countryCode) countryCounts[dest.countryCode] = (countryCounts[dest.countryCode] || 0) + 1
    }

    const topAirline = Object.entries(airlineCounts).sort(([, a], [, b]) => b - a)[0]
    const topAircraft = Object.entries(aircraftCounts).sort(([, a], [, b]) => b - a)[0]
    const topCountry = Object.entries(countryCounts).sort(([, a], [, b]) => b - a)[0]

    return {
        airline: topAirline && topAirline[1] >= threshold
            ? { iata: topAirline[0], count: topAirline[1], percentage: (topAirline[1] / total) * 100 }
            : null,
        aircraft: topAircraft && topAircraft[1] >= threshold
            ? { icao: topAircraft[0], count: topAircraft[1], percentage: (topAircraft[1] / total) * 100 }
            : null,
        country: topCountry && topCountry[1] >= threshold
            ? { code: topCountry[0], count: topCountry[1], percentage: (topCountry[1] / total) * 100 }
            : null,
    }
}

function filterValidUpcoming(upcoming: Array<Record<string, unknown>>) {
    return upcoming.filter((f) => f.airline_iata !== null) as Array<{
        id: number
        date: string
        origin: string
        destination: string
        airline_iata: string
        flight_number: string | null
    }>
}
