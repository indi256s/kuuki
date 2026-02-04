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
  TravelSummaryCard,
  UpcomingFlightsCard,
  ConsolidatedMilestonesCard,
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

export function DashboardPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { data: stats } = useFlightStats()
  const [isFormOpen, setIsFormOpen] = useState(false)
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
        {/* Welcome section + Year filter (same line) */}
        <div className="mb-6 animate-fade-up flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
              {t('dashboard.welcome', { name: displayName })}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {hasFlights
                ? t('dashboard.subtitle', 'Here\'s your travel overview')
                : t('dashboard.emptySubtitle', 'Start tracking your flights')}
            </p>
          </div>

          {hasFlights && <YearFilter />}
        </div>

        {hasFlights ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
            {/* Cell 1: Hero Map (2x2) */}
            <div className="col-span-1 md:col-span-2 row-span-2 h-[400px] md:h-auto">
              <MapCard className="h-full w-full" />
            </div>

            {/* Cell 2: Scoreboard / Travel Summary (2x1) */}
            <div className="col-span-1 md:col-span-2 row-span-1 h-[200px]">
              <TravelSummaryCard className="h-full" />
            </div>

            {/* Cell 3: Next Mission / Upcoming (1x1) */}
            <div className="col-span-1 row-span-1 h-[200px]">
              <UpcomingFlightsCard />
            </div>

            {/* Cell 4: Achievements / Milestones (1x1) */}
            <div className="col-span-1 row-span-1 h-[200px]">
              <ConsolidatedMilestonesCard />
            </div>

            {/* Row 3: Analysis Deck (Full Width) */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <DashboardGrid>
                {/* Row 1: Aircraft stats */}
                <AircraftTypesCard />
                <ManufacturerCard />
                <ContinentProgressCard />

                {/* Row 2: Time stats */}
                <DeparturePatternCard />
                <DurationStatsCard />
              </DashboardGrid>
            </div>
          </div>
        ) : (
          <EmptyState onAddFlight={handleAddFlight} />
        )}
      </main>

      {/* Flight form modal */}
      < FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
      />

      {/* Mobile tab bar */}
      < MobileTabBar />
    </div >
  )
}
