import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/dashboard/EmptyState'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()

  // TODO: Replace with actual flight data from API
  const [flights] = useState<unknown[]>([])
  const hasFlights = flights.length > 0

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User'

  const handleAddFlight = useCallback(() => {
    // TODO: Navigate to add flight page or open modal
    console.log('Add flight clicked')
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
        <h1 className="text-2xl font-semibold text-ink mb-6">
          {t('dashboard.welcome', { name: displayName })}
        </h1>

        {hasFlights ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label={t('dashboard.totalFlights')} value="0" />
              <StatCard label={t('dashboard.totalDistance')} value="0 km" />
              <StatCard label={t('dashboard.countriesVisited')} value="0" />
              <StatCard label={t('dashboard.airlinesFlown')} value="0" />
            </div>

            {/* Flight list will go here */}
            <div className="bg-sky-raised border border-edge rounded-xl p-8 text-center">
              <p className="text-ink-muted">{t('dashboard.recentFlights')}</p>
            </div>
          </>
        ) : (
          <EmptyState onAddFlight={handleAddFlight} />
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sky-raised border border-edge rounded-xl p-4">
      <div className="text-2xl font-semibold text-ink font-data">{value}</div>
      <div className="text-sm text-ink-muted">{label}</div>
    </div>
  )
}
