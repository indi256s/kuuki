import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useAllBadgeTiers } from '@/hooks/useBadgeTier'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import {
  useFlightRoutes,
  useFlightFilterOptions,
} from '@/hooks/useFlights'
import { usePassportCountries } from '@/hooks/usePassport'
import { useDashboardStore } from '@/stores/dashboardStore'
import { searchAirports } from '@kuuki/data'
import {
  UpcomingFlightsBanner,
  MicroBadgeStatCard,
  EmptyState
} from '@/components/dashboard'
import { MapCard } from '@/components/map/MapCard'
import { FlightFilters } from '@/components/flights/FlightFilters'
import { Skeleton } from '@/components/ui/skeleton'
import { FlightForm } from '@/components/flights/FlightForm'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LazyAnalysisDeck = lazy(() => import('@/components/dashboard/AnalysisDeck'))

function AnalysisDeckSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:auto-rows-auto">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-40" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { data: dashStats, isLoading: isDashLoading, error: dashError, refetch: refetchDash } = useDashboardStats()
  const allBadgeTiers = useAllBadgeTiers()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)

  // Dashboard filters from store
  const filters = useDashboardStore((state) => state.filters)
  const setFilters = useDashboardStore((state) => state.setFilters)

  // Airport search local state
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')

  // Dropdown data for filters (single combined query)
  const { data: filterOptions } = useFlightFilterOptions()
  const years = filterOptions?.years ?? []
  const airlineCodes = filterOptions?.airlines ?? []
  const aircraftCodes = filterOptions?.aircraft ?? []

  // Flight routes for map
  const { data: allFlights = [] } = useFlightRoutes()
  const { data: passportCountries } = usePassportCountries()

  // Filter flights client-side using dashboard filters
  const filteredFlights = useMemo(() => {
    let result = allFlights
    if (filters.year) {
      const yearStr = String(filters.year)
      result = result.filter(f => f.date.startsWith(yearStr))
    }
    if (filters.airlineIata) {
      result = result.filter(f => f.airline_iata === filters.airlineIata)
    }
    if (filters.airlineIataCodes && filters.airlineIataCodes.length > 0) {
      const set = new Set(filters.airlineIataCodes)
      result = result.filter(f => f.airline_iata && set.has(f.airline_iata))
    }
    if (filters.originCodes && filters.originCodes.length > 0) {
      const set = new Set(filters.originCodes)
      result = result.filter(f => set.has(f.origin))
    }
    if (filters.destinationCodes && filters.destinationCodes.length > 0) {
      const set = new Set(filters.destinationCodes)
      result = result.filter(f => set.has(f.destination))
    }
    if (filters.isUpcoming !== undefined) {
      result = result.filter(f => f.is_upcoming === filters.isUpcoming)
    }
    return result
  }, [allFlights, filters])

  // Sync upcoming flights on dashboard load
  useSyncUpcomingFlights()

  const hasFlights = (dashStats?.totalFlights ?? 0) > 0 || (dashStats?.upcomingFlights?.length ?? 0) > 0

  const displayName = profile?.display_name || profile?.username || 'User'

  const handleAddFlight = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  // Resolve airport search to matching IATA codes
  const resolveAirportCodes = useCallback((query: string): string[] => {
    const trimmed = query.trim()
    if (!trimmed) return []
    const matches = searchAirports(trimmed)
    return matches.map(a => a.iata)
  }, [])

  // Auto-apply origin filter with debounce
  useEffect(() => {
    const trimmed = originSearch.trim()
    if (trimmed.length === 0) {
      const current = useDashboardStore.getState().filters
      setFilters({ ...current, origin: undefined, originCodes: undefined })
      return
    }
    const timer = setTimeout(() => {
      const current = useDashboardStore.getState().filters
      const codes = resolveAirportCodes(trimmed)
      if (codes.length > 0) {
        setFilters({ ...current, origin: undefined, originCodes: codes })
      } else {
        setFilters({ ...current, origin: undefined, originCodes: undefined })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [originSearch, resolveAirportCodes, setFilters])

  // Auto-apply destination filter with debounce
  useEffect(() => {
    const trimmed = destSearch.trim()
    if (trimmed.length === 0) {
      const current = useDashboardStore.getState().filters
      setFilters({ ...current, destination: undefined, destinationCodes: undefined })
      return
    }
    const timer = setTimeout(() => {
      const current = useDashboardStore.getState().filters
      const codes = resolveAirportCodes(trimmed)
      if (codes.length > 0) {
        setFilters({ ...current, destination: undefined, destinationCodes: codes })
      } else {
        setFilters({ ...current, destination: undefined, destinationCodes: undefined })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [destSearch, resolveAirportCodes, setFilters])

  return (
    <div className="min-h-screen bg-gradient-soft">

      {/* Mobile header */}
      <MobileHeader
        action={
          hasFlights ? (
            <Button onClick={handleAddFlight} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{t('nav.addFlight')}</span>
            </Button>
          ) : undefined
        }
      />

      {/* Desktop header */}
      <AppHeader
        onAddFlight={handleAddFlight}
        showAddButton={hasFlights}
      />

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main className="max-w-7xl 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6">

        {isDashLoading && !dashStats ? (
          <div className="space-y-4 animate-fade-up">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2 min-h-[400px]">
                <Skeleton className="h-full w-full rounded-2xl" />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 grid-rows-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        ) : dashError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
            <p className="text-sm text-muted-foreground mb-4">
              {t('errors.loadingStats', 'Failed to load stats')}
            </p>
            <Button variant="outline" onClick={() => refetchDash()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t('common.retry', 'Try again')}
            </Button>
          </div>
        ) : hasFlights ? (
          <div className="space-y-4 animate-fade-up stagger-children">
            {/* Upcoming flights banner */}
            <UpcomingFlightsBanner />

            {/* Welcome section */}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
                {t('dashboard.welcomePrefix', 'Welcome,')}{' '}
                <span className="text-primary animate-name-highlight inline-block">
                  {displayName}
                </span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('dashboard.subtitle', 'Here\'s your travel overview')}
              </p>
            </div>

            {/* Filters */}
            <FlightFilters
              filters={filters}
              onFiltersChange={setFilters}
              years={years}
              airlineCodes={airlineCodes}
              aircraftCodes={aircraftCodes}
              totalCount={dashStats?.totalFlights ?? 0}
              originSearch={originSearch}
              destSearch={destSearch}
              onOriginSearchChange={setOriginSearch}
              onDestSearchChange={setDestSearch}
            />

            {/* Hero section: Map + 6 stat cards */}
            <div className={cn(
              'grid grid-cols-1 gap-4',
              mapExpanded
                ? 'md:grid-cols-1'
                : 'md:grid-cols-2 lg:grid-cols-4'
            )}>
              {/* Map (2 cols on desktop) */}
              <div className={cn(
                'min-h-[400px] md:h-auto',
                mapExpanded
                  ? 'col-span-1'
                  : 'md:col-span-2'
              )}>
                <MapCard
                  flights={filteredFlights}
                  passportEntries={passportCountries ?? []}
                  className="h-full w-full"
                  isExpanded={mapExpanded}
                  onExpandChange={setMapExpanded}
                />
              </div>

              {/* 6 stat cards in 2-col grid beside map (hidden when map expanded) */}
              {!mapExpanded && (
                <div className="md:col-span-2 grid grid-cols-2 grid-rows-3 gap-4 h-full">
                  <MicroBadgeStatCard trackId="flights" tierData={allBadgeTiers.flights} />
                  <MicroBadgeStatCard trackId="distance" tierData={allBadgeTiers.distance} />
                  <MicroBadgeStatCard trackId="countries" tierData={allBadgeTiers.countries} />
                  <MicroBadgeStatCard trackId="time_in_air" tierData={allBadgeTiers.time_in_air} />
                  <MicroBadgeStatCard trackId="airlines" tierData={allBadgeTiers.airlines} />
                  <MicroBadgeStatCard trackId="aircraft" tierData={allBadgeTiers.aircraft} />
                </div>
              )}
            </div>

            {/* Secondary stat row: airports, cities, continents */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MicroBadgeStatCard trackId="airports" tierData={allBadgeTiers.airports} />
              <MicroBadgeStatCard trackId="cities" tierData={allBadgeTiers.cities} />
              <MicroBadgeStatCard trackId="continents" tierData={allBadgeTiers.continents} />
            </div>

            {/* Analysis Deck (lazy-loaded) */}
            <Suspense fallback={<AnalysisDeckSkeleton />}>
              <LazyAnalysisDeck />
            </Suspense>
          </div>
        ) : (
          <div className="animate-fade-up">
            {/* Welcome section for empty state */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
                  {t('dashboard.welcomePrefix', 'Welcome,')}{' '}
                  <span className="text-primary animate-name-highlight inline-block">
                    {displayName}
                  </span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.emptySubtitle', 'Start tracking your flights')}
                </p>
              </div>
            </div>
            <EmptyState onAddFlight={handleAddFlight} />
          </div>
        )}
      </main>

      {/* Flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
      />

      {/* Mobile tab bar */}
      <MobileTabBar />
    </div >
  )
}
