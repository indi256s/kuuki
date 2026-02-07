import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useFlightStats } from '@/hooks/useStats'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import { useDashboardStore } from '@/stores/dashboardStore'
import {
  YearFilter,
  MapCard,
  UpcomingFlightsBanner,
  MicroBadgeStatCard,
  EmptyState
} from '@/components/dashboard'
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
  const { data: stats } = useFlightStats()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const setAvailableYears = useDashboardStore((state) => state.setAvailableYears)

  // Sync upcoming flights on dashboard load
  useSyncUpcomingFlights()

  const hasFlights = (stats?.totalFlights ?? 0) > 0 || (stats?.upcomingFlights ?? 0) > 0

  const displayName = profile?.display_name || profile?.username || 'User'

  const handleAddFlight = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  // TODO: Fetch available years from flights and populate dashboard store
  useEffect(() => {
    // Placeholder - will be implemented when we have year filtering in backend
    const currentYear = new Date().getFullYear()
    setAvailableYears([currentYear, currentYear - 1])
  }, [setAvailableYears])

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

        {hasFlights ? (
          <div className="space-y-4 animate-fade-up stagger-children">
            {/* Upcoming flights banner */}
            <UpcomingFlightsBanner />

            {/* Welcome section + Year filter */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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
              <YearFilter />
            </div>

            {/* Hero section: Map + 6 stat cards */}
            <div className={cn(
              'grid grid-cols-1 gap-4',
              mapExpanded
                ? 'md:grid-cols-1'
                : 'md:grid-cols-2 lg:grid-cols-4'
            )}>
              {/* Map (2 cols, 2 rows on desktop) */}
              <div className={cn(
                'min-h-[400px] md:h-auto',
                mapExpanded
                  ? 'col-span-1'
                  : 'md:col-span-2 md:row-span-2'
              )}>
                <MapCard
                  className="h-full w-full"
                  isExpanded={mapExpanded}
                  onExpandChange={setMapExpanded}
                />
              </div>

              {/* 6 stat cards in 2-col grid beside map (hidden when map expanded) */}
              {!mapExpanded && (
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <MicroBadgeStatCard trackId="flights" />
                  <MicroBadgeStatCard trackId="distance" />
                  <MicroBadgeStatCard trackId="countries" />
                  <MicroBadgeStatCard trackId="time_in_air" />
                  <MicroBadgeStatCard trackId="airlines" />
                  <MicroBadgeStatCard trackId="aircraft" />
                </div>
              )}
            </div>

            {/* Secondary stat row: airports, cities, continents */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MicroBadgeStatCard trackId="airports" />
              <MicroBadgeStatCard trackId="cities" />
              <MicroBadgeStatCard trackId="continents" />
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
