import { useTranslation } from 'react-i18next'
import { sampleStats, sampleFlights, formatDistance, formatDuration } from '@/lib/sampleData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EmptyStateProps {
  onAddFlight: () => void
}

export function EmptyState({ onAddFlight: _onAddFlight }: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className="relative">
      {/* Sample dashboard preview (faded) - shows what the dashboard will look like */}
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
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.recentFlights')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {sampleFlights.slice(0, 3).map((flight) => (
                <div key={flight.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{flight.origin}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{flight.destination}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {flight.airline} · {flight.flightNumber}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-data">{formatDistance(flight.distanceKm)}</div>
                    <div className="text-muted-foreground">{formatDuration(flight.durationMinutes)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SampleStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="text-2xl font-semibold font-data">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
