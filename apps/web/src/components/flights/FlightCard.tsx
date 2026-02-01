import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Clock, Calendar } from 'lucide-react'
import { AircraftPendingBadge } from './AircraftPendingBadge'
import { cn } from '@/lib/utils'

interface FlightCardProps {
  flight: Flight
  onEdit: (flight: Flight) => void
  onDelete: (flight: Flight) => void
}

export function FlightCard({ flight, onEdit, onDelete }: FlightCardProps) {
  const { t } = useTranslation()

  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)
  const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
  const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null

  const isUpcoming = flight.is_upcoming
  const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasFlightNumber = flight.flight_number && flight.airline_iata
  const hasTimes = flight.departure_time || flight.arrival_time

  return (
    <Card
      className={cn(
        'border-border/50 hover:shadow-md transition-all overflow-hidden',
        isUpcoming && 'ring-1 ring-primary/20 bg-primary/[0.02]'
      )}
    >
      <CardContent className="p-0">
        {/* Header bar */}
        <div className={cn(
          'px-4 py-2.5 flex items-center justify-between border-b border-border/50',
          isUpcoming ? 'bg-primary/5' : 'bg-muted/30'
        )}>
          <div className="flex items-center gap-2">
            <Calendar className={cn('w-4 h-4', isUpcoming ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-medium', isUpcoming && 'text-primary')}>
              {formatDate(flight.date)}
            </span>
            {isUpcoming && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 ml-1">
                {t('flights.daysUntil', { days: daysAway })}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(flight)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(flight)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Route - Hero section */}
        <div className="px-4 py-5">
          <div className="flex items-center gap-4">
            {/* Origin */}
            <div className="flex-1 min-w-0">
              <div className="font-mono font-bold text-xl tracking-tight">{flight.origin}</div>
              <div className="text-sm text-muted-foreground truncate">
                {originAirport?.city || t('flights.unknownCity', 'Unknown')}
              </div>
            </div>

            {/* Flight path visualization with duration */}
            <div className="flex items-center flex-shrink-0 w-28">
              <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
              <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent mx-1" />
              {/* Duration badge in the center */}
              <div className="px-2 py-0.5 rounded-full bg-muted/80 border border-border/50 flex-shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  {flight.duration_minutes ? formatDuration(flight.duration_minutes) : '—'}
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-primary/60 via-primary/20 to-transparent mx-1" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
            </div>

            {/* Destination */}
            <div className="flex-1 min-w-0 text-right">
              <div className="font-mono font-bold text-xl tracking-tight">{flight.destination}</div>
              <div className="text-sm text-muted-foreground truncate">
                {destAirport?.city || t('flights.unknownCity', 'Unknown')}
              </div>
            </div>
          </div>

          {/* Flight number and Times */}
          {(hasFlightNumber || hasTimes) && (
            <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-3 border-t border-border/30">
              {hasFlightNumber ? (
                <span className="font-mono font-medium">{flight.airline_iata}{flight.flight_number}</span>
              ) : (
                <span />
              )}
              {hasTimes && (
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {flight.departure_time || '—'}
                  <span className="text-muted-foreground/50">→</span>
                  {flight.arrival_time || '—'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Details */}
        <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
          <div className="flex flex-wrap gap-2">
            {airline && (
              <Badge variant="outline" className="gap-1.5 bg-background font-normal">
                {airline.primaryColor && (
                  <span
                    className="w-2 h-2 rounded-full ring-1 ring-border/50"
                    style={{ backgroundColor: airline.primaryColor }}
                  />
                )}
                {airline.name}
              </Badge>
            )}

            {aircraft ? (
              <Badge variant="outline" className="bg-background font-normal">
                {aircraft.name}
              </Badge>
            ) : !flight.aircraft_icao ? (
              <AircraftPendingBadge flightId={flight.id} />
            ) : (
              <Badge variant="outline" className="font-mono bg-background font-normal">
                {flight.aircraft_icao}
              </Badge>
            )}

            {flight.distance_km && (
              <Badge variant="outline" className="bg-background font-data font-normal">
                {formatDistance(flight.distance_km)}
              </Badge>
            )}

            {flight.duration_minutes && (
              <Badge variant="outline" className="bg-background font-normal">
                {formatDuration(flight.duration_minutes)}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
