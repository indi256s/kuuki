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

            {/* Flight path visualization */}
            <div className="flex items-center flex-shrink-0 w-24">
              <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
              <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60 mx-1.5 relative">
                {/* Dashed line effect */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,var(--primary)_4px,var(--primary)_8px)] opacity-20" />
              </div>
              {/* Plane icon */}
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center -mx-0.5 relative z-10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-3.5 h-3.5 text-primary rotate-90"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60 mx-1.5" />
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
