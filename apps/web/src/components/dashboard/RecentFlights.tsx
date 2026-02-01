import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useRecentFlights, useUpcomingFlights } from '@/hooks/useFlights'
import { findAirport, findAirline } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'

interface RecentFlightsProps {
  onAddFlight: () => void
}

export function RecentFlights({ onAddFlight }: RecentFlightsProps) {
  const { t } = useTranslation()
  const { data: recentFlights = [], isLoading: loadingRecent } = useRecentFlights(5)
  const { data: upcomingFlights = [], isLoading: loadingUpcoming } = useUpcomingFlights(3)

  const isLoading = loadingRecent || loadingUpcoming

  if (isLoading) {
    return (
      <div className="bg-sky-raised border border-edge rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-edge">
          <div className="h-5 w-32 bg-edge rounded animate-pulse" />
        </div>
        <div className="divide-y divide-edge">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-5 w-24 bg-edge rounded mb-2" />
              <div className="h-4 w-32 bg-edge rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Upcoming flights */}
      {upcomingFlights.length > 0 && (
        <div className="bg-runway/5 border border-runway/20 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-runway/20 flex items-center gap-2">
            <svg className="w-5 h-5 text-runway" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-medium text-runway">{t('dashboard.upcomingFlights', 'Upcoming Flights')}</h3>
          </div>
          <div className="divide-y divide-runway/10">
            {upcomingFlights.map((flight) => {
              const originAirport = findAirport(flight.origin)
              const destAirport = findAirport(flight.destination)
              const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
              const daysAway = daysUntilFlight(flight.date)

              return (
                <div key={flight.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-ink font-medium">
                      <span className="font-mono">{flight.origin}</span>
                      <svg className="w-4 h-4 text-ink-faint" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 5.5v3.5l6 3.5v1.5l-6-1.75v3.25l1.5 1v1l-2.5-.75-2.5.75v-1l1.5-1v-3.25l-6 1.75v-1.5l6-3.5v-3.5a1.5 1.5 0 013 0z" />
                      </svg>
                      <span className="font-mono">{flight.destination}</span>
                    </div>
                    <div className="text-sm text-ink-muted truncate">
                      {airline?.name || flight.airline_iata} · {originAirport?.city} → {destAirport?.city}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-runway font-medium">
                      {t('dashboard.inDays', { days: daysAway })}
                    </div>
                    <div className="text-ink-muted">{formatDate(flight.date)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent flights */}
      <div className="bg-sky-raised border border-edge rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <h3 className="font-medium text-ink">{t('dashboard.recentFlights', 'Recent Flights')}</h3>
          {recentFlights.length > 0 && (
            <Link to="/flights" className="text-sm text-runway hover:underline">
              {t('common.viewAll', 'View all')}
            </Link>
          )}
        </div>

        {recentFlights.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
            <p className="text-ink-muted mb-3">{t('dashboard.noFlightsYet', 'No flights logged yet')}</p>
            <button
              onClick={onAddFlight}
              className="px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors text-sm font-medium"
            >
              {t('flights.addFirstFlight', 'Add your first flight')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {recentFlights.map((flight) => {
              const originAirport = findAirport(flight.origin)
              const destAirport = findAirport(flight.destination)
              const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null

              return (
                <div key={flight.id} className="px-4 py-3 flex items-center gap-4 hover:bg-sky transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-ink font-medium">
                      <span className="font-mono">{flight.origin}</span>
                      <span className="text-ink-faint">→</span>
                      <span className="font-mono">{flight.destination}</span>
                      {flight.flight_number && (
                        <span className="text-xs text-ink-muted font-mono">{flight.flight_number}</span>
                      )}
                    </div>
                    <div className="text-sm text-ink-muted truncate">
                      {airline?.name || flight.airline_iata}
                      {originAirport && destAirport && ` · ${originAirport.city} → ${destAirport.city}`}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {flight.distance_km && (
                      <div className="text-ink font-data">{formatDistance(flight.distance_km)}</div>
                    )}
                    {flight.duration_minutes && (
                      <div className="text-ink-muted">{formatDuration(flight.duration_minutes)}</div>
                    )}
                    {!flight.distance_km && !flight.duration_minutes && (
                      <div className="text-ink-muted">{formatDate(flight.date)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
