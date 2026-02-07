import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useFlightStats } from '@/hooks/useStats'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import { useDashboardStore } from '@/stores/dashboardStore'
import {
  DashboardGrid,
  YearFilter,
  MapCard,
  UpcomingFlightsBanner,
  MicroBadgeStatCard,
  AircraftTypesCard,
  ManufacturerCard,
  ContinentProgressCard,
  DeparturePatternCard,
  DurationStatsCard,
  EmptyState
} from '@/components/dashboard'
import { FlightForm } from '@/components/flights/FlightForm'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

            {/* Analysis Deck */}
            <DashboardGrid>
              <AircraftTypesCard />
              <ManufacturerCard />
              <ContinentProgressCard />
              <DeparturePatternCard />
              <DurationStatsCard />
            </DashboardGrid>
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
