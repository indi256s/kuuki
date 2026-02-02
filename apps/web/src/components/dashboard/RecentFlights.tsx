import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useRecentFlights, useUpcomingFlights } from '@/hooks/useFlights'
import { findAirport, findAirline } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Plane, Plus } from 'lucide-react'

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
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
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
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Clock className="w-5 h-5" />
              {t('dashboard.upcomingFlights', 'Upcoming Flights')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-primary/10">
              {upcomingFlights.map((flight) => {
                const originAirport = findAirport(flight.origin)
                const destAirport = findAirport(flight.destination)
                const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
                const daysAway = daysUntilFlight(flight.date)

                return (
                  <div key={flight.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-mono">{flight.origin}</span>
                        <Plane className="w-4 h-4 text-muted-foreground rotate-90" />
                        <span className="font-mono">{flight.destination}</span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {airline?.name || flight.airline_iata} · {originAirport?.city} → {destAirport?.city}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-primary font-medium">
                        {t('dashboard.inDays', { days: daysAway })}
                      </div>
                      <div className="text-muted-foreground">{formatDate(flight.date)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent flights */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {t('dashboard.recentFlights', 'Recent Flights')}
          </CardTitle>
          {recentFlights.length > 0 && (
            <Link to="/flights" className="text-sm text-primary hover:underline">
              {t('common.viewAll', 'View all')}
            </Link>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {recentFlights.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Plane className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">{t('dashboard.noFlightsYet', 'No flights logged yet')}</p>
              <Button onClick={onAddFlight} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('flights.addFirstFlight', 'Add your first flight')}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentFlights.map((flight) => {
                const originAirport = findAirport(flight.origin)
                const destAirport = findAirport(flight.destination)
                const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null

                return (
                  <div key={flight.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4 hover:bg-muted/50 -mx-4 px-4 transition-colors rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-mono">{flight.origin}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono">{flight.destination}</span>
                        {flight.flight_number && (
                          <span className="text-xs text-muted-foreground font-mono">{flight.flight_number}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {airline?.name || flight.airline_iata}
                        {originAirport && destAirport && ` · ${originAirport.city} → ${destAirport.city}`}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {flight.distance_km && (
                        <div className="font-data">{formatDistance(flight.distance_km)}</div>
                      )}
                      {flight.duration_minutes && (
                        <div className="text-muted-foreground">{formatDuration(flight.duration_minutes)}</div>
                      )}
                      {!flight.distance_km && !flight.duration_minutes && (
                        <div className="text-muted-foreground">{formatDate(flight.date)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
