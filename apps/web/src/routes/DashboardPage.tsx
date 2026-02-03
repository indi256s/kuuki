import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useFlightStats } from '@/hooks/useStats'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import { AdvancedStats } from '@/components/stats/AdvancedStats'
import { RecentFlights } from '@/components/dashboard/RecentFlights'
import { RouteMap } from '@/components/map/RouteMap'
import { MapCollapsible } from '@/components/map/MapCollapsible'
import { FlightForm } from '@/components/flights/FlightForm'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function DashboardPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { data: stats } = useFlightStats()
  const [isFormOpen, setIsFormOpen] = useState(false)

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
      <main className="max-w-6xl mx-auto px-6 py-8 pb-safe sm:pb-8">
        {/* Welcome section */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
            {t('dashboard.welcome', { name: displayName })}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {hasFlights
              ? t('dashboard.subtitle', 'Here\'s your travel overview')
              : t('dashboard.emptySubtitle', 'Start tracking your flights')}
          </p>
        </div>

        {hasFlights ? (
          <div className="space-y-8">
            {/* Advanced Stats - Tiered stats with unlock system */}
            <AdvancedStats />

            {/* Route map */}
            <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
              {/* Mobile: Collapsed preview card */}
              <div className="sm:hidden">
                <MapCollapsible />
              </div>

              {/* Desktop: Inline map */}
              <div className="hidden sm:block rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm">
                <RouteMap height="320px" />
              </div>
            </div>

            {/* Recent & upcoming flights */}
            <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
              <RecentFlights onAddFlight={handleAddFlight} />
            </div>
          </div>
        ) : (
          <EmptyState onAddFlight={handleAddFlight} />
        )}
      </main>

      {/* Flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
      />

      {/* Mobile tab bar */}
      <MobileTabBar />
    </div>
  )
}
