import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { sampleStats, sampleFlights, formatDistance, formatDuration } from '@/lib/sampleData'

interface EmptyStateProps {
  onAddFlight: () => void
}

export function EmptyState({ onAddFlight }: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className="relative">
      {/* Sample dashboard preview (faded) */}
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SampleStatCard
            label={t('dashboard.totalFlights')}
            value={sampleStats.totalFlights.toString()}
          />
          <SampleStatCard
            label={t('dashboard.totalDistance')}
            value={formatDistance(sampleStats.totalDistanceKm)}
          />
          <SampleStatCard
            label={t('dashboard.countriesVisited')}
            value={sampleStats.countriesVisited.toString()}
          />
          <SampleStatCard
            label={t('dashboard.airlinesFlown')}
            value={sampleStats.airlinesFlown.toString()}
          />
        </div>

        {/* Recent flights */}
        <div className="bg-sky-raised border border-edge rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-edge">
            <h3 className="font-medium text-ink">{t('dashboard.recentFlights')}</h3>
          </div>
          <div className="divide-y divide-edge">
            {sampleFlights.slice(0, 3).map((flight) => (
              <div key={flight.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-ink font-medium">
                    <span>{flight.origin}</span>
                    <span className="text-ink-faint">→</span>
                    <span>{flight.destination}</span>
                  </div>
                  <div className="text-sm text-ink-muted truncate">
                    {flight.airline} · {flight.flightNumber}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-ink font-data">{formatDistance(flight.distanceKm)}</div>
                  <div className="text-ink-muted">{formatDuration(flight.durationMinutes)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay with CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-sky-raised border border-edge rounded-xl p-8 text-center shadow-lg max-w-sm">
          {/* Sample badge */}
          <div className="inline-block px-2 py-1 bg-runway-muted text-runway text-xs font-medium rounded mb-4">
            {t('emptyState.sampleLabel')}
          </div>

          <h2 className="text-xl font-semibold text-ink mb-2">
            {t('emptyState.title')}
          </h2>
          <p className="text-ink-muted mb-1">
            {t('emptyState.subtitle')}
          </p>
          <p className="text-sm text-ink-faint mb-6">
            {t('emptyState.description')}
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onAddFlight}
              className="px-6 py-3 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors focus-ring font-medium"
            >
              {t('emptyState.addFlight')}
            </button>

            <Link to="/import" className="text-sm text-runway hover:text-runway-hover transition-colors">
              {t('emptyState.orImport', 'or import from document')}
            </Link>
          </div>

          <div className="mt-6 p-3 bg-sky-sunken/50 rounded-lg">
            <p className="text-xs text-ink-muted">
              {t('emptyState.geminiTip', 'Have flight emails? Ask Google Gemini to search your Gmail and paste the results.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SampleStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sky-raised border border-edge rounded-xl p-4">
      <div className="text-2xl font-semibold text-ink font-data">{value}</div>
      <div className="text-sm text-ink-muted">{label}</div>
    </div>
  )
}
