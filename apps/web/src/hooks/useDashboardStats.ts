import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { filterParams } from '@/lib/flights'
import { queryKeys } from '@/lib/queryKeys'
import type { OverviewSummary } from '@kuuki/shared'

export interface DashboardStats {
  derivedState: OverviewSummary['derivedState']
  totalFlights: number
  totalDistance: number
  totalDuration: number
  uniqueCountries: number
  uniqueCities: number
  uniqueAirlines: number
  uniqueAircraft: number
  uniqueAirports: number
  continentsCount: number
  visitedCountries: string[]
  upcomingFlightCount: number
  upcomingFlights: Array<{
    id: number
    date: string
    origin: string
    destination: string
    airline_iata: string | null
    flight_number: string | null
  }>
  percentiles: {
    countries: number | null
    cities: number | null
    flights: number | null
    distance: number | null
    airlines: number | null
  }
  favorites: {
    airline: { iata: string; count: number; percentage: number } | null
    country: { code: string; count: number; percentage: number } | null
    aircraft: { icao: string; count: number; percentage: number } | null
  }
}

/** The Vite dashboard keeps its detailed filters while the read stays bounded. */
export function useDashboardStats() {
  const userId = useAuthStore((state) => state.user?.id)
  const filters = useDashboardStore((state) => state.filters)

  return useQuery({
    queryKey: queryKeys.dashboardStats(userId, filters),
    queryFn: async (): Promise<DashboardStats> => {
      const summary = await api.get<OverviewSummary>('/api/me/overview', {
        period: filters.year ? String(filters.year) : 'all',
        ...filterParams(filters),
      })
      return toDashboardStats(summary)
    },
    enabled: !!userId,
  })
}

function toDashboardStats(summary: OverviewSummary): DashboardStats {
  const { totals, topLists, nextFlight } = summary
  const favorite = (list: Array<{ id: string; count: number }>) => {
    const top = list[0]
    return top && totals.flights > 0 && top.count >= totals.flights * 0.3
      ? { id: top.id, count: top.count, percentage: (top.count / totals.flights) * 100 }
      : null
  }
  const airline = favorite(topLists.airlines)
  const aircraft = favorite(topLists.aircraft)
  const country = favorite(topLists.countries)

  return {
    derivedState: summary.derivedState,
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
    upcomingFlightCount: totals.upcomingFlights,
    upcomingFlights: nextFlight ? [{
      id: nextFlight.id,
      date: nextFlight.date,
      origin: nextFlight.origin,
      destination: nextFlight.destination,
      airline_iata: nextFlight.airlineIata,
      flight_number: nextFlight.flightNumber,
    }] : [],
    percentiles: { countries: null, cities: null, flights: null, distance: null, airlines: null },
    favorites: {
      airline: airline ? { iata: airline.id, count: airline.count, percentage: airline.percentage } : null,
      aircraft: aircraft ? { icao: aircraft.id, count: aircraft.count, percentage: aircraft.percentage } : null,
      country: country ? { code: country.id, count: country.count, percentage: country.percentage } : null,
    },
  }
}
