import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useFlightStats } from '@/hooks/useStats'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentFlights } from '@/components/dashboard/RecentFlights'
import { RouteMap } from '@/components/map/RouteMap'
import { FlightForm } from '@/components/flights/FlightForm'
import { EmptyState } from '@/components/dashboard/EmptyState'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const { data: stats } = useFlightStats()
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Sync upcoming flights on dashboard load
  useSyncUpcomingFlights()

  const hasFlights = (stats?.totalFlights ?? 0) > 0 || (stats?.upcomingFlights ?? 0) > 0

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User'

  const handleAddFlight = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-sky">
      {/* Header */}
      <header className="bg-sky-raised border-b border-edge">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-semibold text-ink">
            {t('common.appName')}
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/flights"
              className="text-sm text-ink-muted hover:text-ink transition-colors focus-ring rounded px-2 py-1"
            >
              {t('nav.flights', 'Flights')}
            </Link>
            <Link
              to="/import"
              className="text-sm text-ink-muted hover:text-ink transition-colors focus-ring rounded px-2 py-1"
            >
              {t('nav.import', 'Import')}
            </Link>
            <button
              onClick={toggleLanguage}
              className="text-sm text-ink-muted hover:text-ink transition-colors focus-ring rounded px-2 py-1"
            >
              {currentLanguage === 'en' ? 'RU' : 'EN'}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-ink-muted hover:text-ink transition-colors focus-ring rounded px-2 py-1"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-ink">
            {t('dashboard.welcome', { name: displayName })}
          </h1>
          {hasFlights && (
            <button
              onClick={handleAddFlight}
              className="flex items-center gap-2 px-4 py-2 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('flights.addFlight', 'Add Flight')}
            </button>
          )}
        </div>

        {hasFlights ? (
          <div className="space-y-8">
            {/* Stats grid */}
            <StatsCards />

            {/* Route map */}
            <div className="relative">
              <RouteMap height="300px" />
            </div>

            {/* Recent & upcoming flights */}
            <RecentFlights onAddFlight={handleAddFlight} />
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
    </div>
  )
}
