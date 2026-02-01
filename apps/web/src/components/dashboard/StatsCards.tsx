import { useTranslation } from 'react-i18next'
import { useFlightStats } from '@/hooks/useStats'
import { formatDistance } from '@/lib/geo'

export function StatsCards() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useFlightStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-raised border border-edge rounded-xl p-4 animate-pulse">
            <div className="h-7 w-16 bg-edge rounded mb-2" />
            <div className="h-4 w-20 bg-edge rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-emergency-muted text-emergency rounded-lg text-sm">
        {t('errors.loadingStats', 'Failed to load stats')}
      </div>
    )
  }

  const statItems = [
    {
      label: t('dashboard.totalFlights', 'Total Flights'),
      value: stats?.totalFlights.toString() || '0',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      ),
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      value: stats?.totalDistance ? formatDistance(stats.totalDistance) : '0 km',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: t('dashboard.countriesVisited', 'Countries'),
      value: stats?.countriesVisited.toString() || '0',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: t('dashboard.airlinesFlown', 'Airlines'),
      value: stats?.airlinesFlown.toString() || '0',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((stat) => (
        <div
          key={stat.label}
          className="bg-sky-raised border border-edge rounded-xl p-4 hover:border-edge-strong transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="text-2xl font-semibold text-ink font-data">{stat.value}</div>
            <div className="text-ink-muted">{stat.icon}</div>
          </div>
          <div className="text-sm text-ink-muted">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
