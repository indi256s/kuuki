import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User'

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
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {currentLanguage === 'en' ? 'RU' : 'EN'}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
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

        {/* Stats grid - placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label={t('dashboard.totalFlights')} value="0" />
          <StatCard label={t('dashboard.totalDistance')} value="0 km" />
          <StatCard label={t('dashboard.countriesVisited')} value="0" />
          <StatCard label={t('dashboard.airlinesFlown')} value="0" />
        </div>

        {/* Empty state */}
        <div className="bg-sky-raised border border-edge rounded-xl p-8 text-center">
          <p className="text-ink-muted mb-4">{t('dashboard.noFlights')}</p>
          <button className="px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors">
            {t('dashboard.addFirstFlight')}
          </button>
        </div>
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
