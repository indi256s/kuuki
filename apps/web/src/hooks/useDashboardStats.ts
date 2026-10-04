import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { findAirport, findCountry } from '@kuuki/data'
import type { FlightFilters } from '@/lib/flights'
import { queryKeys } from '@/lib/queryKeys'
import type { OverviewSummary } from '@kuuki/shared'

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

/** Upcoming-flight projection returned by the dashboard-stats fast path. */
interface ApiUpcomingFlight {
    id: number
    date: string
    origin: string
    destination: string
    airline_iata: string | null
    flight_number: string | null
}

/** Full own-flight DTO as returned by GET /api/flights/all (used by the filtered path). */
interface ApiFlight {
    id: number
    date: string
    origin: string
    destination: string
    airline_iata: string | null
    aircraft_icao: string | null
    flight_number: string | null
    distance_km: number | null
    duration_minutes: number | null
    is_upcoming: boolean | null
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

/** Client-side equivalent of the old Supabase filter chain (applied to completed flights). */
function matchesFilters(flight: ApiFlight, filters: FlightFilters): boolean {
    if (filters.year) {
        const start = `${filters.year}-01-01`
        const end = `${filters.year}-12-31`
        if (flight.date < start || flight.date > end) return false
    }

    if (filters.airlineIataCodes && filters.airlineIataCodes.length > 0) {
        if (!flight.airline_iata || !filters.airlineIataCodes.includes(flight.airline_iata)) return false
    } else if (filters.airlineIata) {
        if (flight.airline_iata !== filters.airlineIata) return false
    }

    if (filters.aircraftIcao) {
        if (flight.aircraft_icao !== filters.aircraftIcao) return false
    }

    if (filters.originCodes && filters.originCodes.length > 0) {
        const codes = filters.originCodes.map((c) => c.toUpperCase())
        if (!codes.includes(flight.origin.toUpperCase())) return false
    } else if (filters.origin) {
        if (flight.origin.toUpperCase() !== filters.origin.toUpperCase()) return false
    }

    if (filters.destinationCodes && filters.destinationCodes.length > 0) {
        const codes = filters.destinationCodes.map((c) => c.toUpperCase())
        if (!codes.includes(flight.destination.toUpperCase())) return false
    } else if (filters.destination) {
        if (flight.destination.toUpperCase() !== filters.destination.toUpperCase()) return false
    }

    return true
}

/**
 * Hook for fetching all dashboard stats with filter support.
 * When no filters are active, uses the compact Overview summary.
 * When any filter is active, queries raw flights and computes stats client-side.
 */
export function useDashboardStats() {
    const userId = useAuthStore((state) => state.user?.id)
    const filters = useDashboardStore((state) => state.filters)

    return useQuery({
        queryKey: queryKeys.dashboardStats(userId, filters),
        queryFn: async (): Promise<DashboardStats | null> => {
            if (!userId) return null

            const filtersActive = hasActiveFilters(filters)

            if (filtersActive) {
                return fetchFilteredStats(filters)
            }

            return fetchUnfilteredStats()
        },
        enabled: !!userId,
    })
}

/**
 * Fast path: one bounded Overview response, with no completed-flight history.
 */
async function fetchUnfilteredStats(): Promise<DashboardStats> {
    const summary = await api.get<OverviewSummary>('/api/me/overview?period=all')
    const { totals, topLists, nextFlight } = summary
    const favorite = (list: Array<{ id: string; count: number }>, threshold: number) => {
        const top = list[0]
        return top && top.count >= threshold
            ? { id: top.id, count: top.count, percentage: (top.count / totals.flights) * 100 }
            : null
    }
    const threshold = totals.flights * 0.3
    const airline = favorite(topLists.airlines, threshold)
    const aircraft = favorite(topLists.aircraft, threshold)
    const country = favorite(topLists.countries, threshold)

    return {
        totalFlights: totals.flights,
        totalDistance: totals.distanceKm,
        totalDuration: totals.durationMinutes,
        uniqueCountries: totals.countries,
        uniqueCities: totals.cities,
        uniqueAirlines: totals.airlines,
        uniqueAircraft: totals.aircraft,
        uniqueAirports: totals.airports,
        continentsCount: totals.continents,
        visitedCountries: summary.countryIds,
        upcomingFlights: nextFlight?.airlineIata ? [{
            id: nextFlight.id, date: nextFlight.date, origin: nextFlight.origin,
            destination: nextFlight.destination, airline_iata: nextFlight.airlineIata,
            flight_number: nextFlight.flightNumber,
        }] : [],
        percentiles: {
            countries: null,
            cities: null,
            flights: null,
            distance: null,
            airlines: null,
        },
        favorites: {
            airline: airline ? { iata: airline.id, count: airline.count, percentage: airline.percentage } : null,
            aircraft: aircraft ? { icao: aircraft.id, count: aircraft.count, percentage: aircraft.percentage } : null,
            country: country ? { code: country.id, count: country.count, percentage: country.percentage } : null,
        },
    }
}

/**
 * Filtered path: fetch all flights, apply filters + compute all stats client-side.
 */
async function fetchFilteredStats(filters: FlightFilters): Promise<DashboardStats> {
    const all = (await api.get<ApiFlight[]>('/api/flights/all')) ?? []

    const completed = all.filter((f) => !f.is_upcoming)
    const allFlights = completed.filter((f) => matchesFilters(f, filters))

    const upcoming = all
        .filter((f) => f.is_upcoming)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5)

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
        upcomingFlights: filterValidUpcoming(upcoming),
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

function filterValidUpcoming(
    upcoming: Array<{
        id: number
        date: string
        origin: string
        destination: string
        airline_iata: string | null
        flight_number: string | null
    }>
) {
    return upcoming.filter((f) => f.airline_iata !== null) as Array<{
        id: number
        date: string
        origin: string
        destination: string
        airline_iata: string
        flight_number: string | null
    }>
}
