import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, ArrowRight } from 'lucide-react'
import { FlightCardActions } from './FlightCardActions'
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
        {/* Header: Date + Actions */}
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
          {/* Overflow menu for actions */}
          <FlightCardActions
            onEdit={() => onEdit(flight)}
            onDelete={() => onDelete(flight)}
          />
        </div>

        {/* Route - 2-line Hero Section */}
        <div className="px-4 py-4">
          {/* Primary: Airport codes with arrow */}
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xl tracking-tight">{flight.origin}</span>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <span className="font-mono font-bold text-xl tracking-tight">{flight.destination}</span>
          </div>
          {/* Secondary: City names */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
            <span className="truncate">
              {originAirport?.city || t('flights.unknownCity', 'Unknown')}
            </span>
            <span className="text-muted-foreground/50 flex-shrink-0">→</span>
            <span className="truncate">
              {destAirport?.city || t('flights.unknownCity', 'Unknown')}
            </span>
          </div>

          {/* Flight info row */}
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {hasFlightNumber && (
              <span className="font-mono font-medium">{flight.airline_iata}{flight.flight_number}</span>
            )}
            {hasTimes && (
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {flight.departure_time || '—'}
                <span className="text-muted-foreground/50">→</span>
                {flight.arrival_time || '—'}
              </div>
            )}
            {flight.duration_minutes && (
              <span className="font-mono">{formatDuration(flight.duration_minutes)}</span>
            )}
          </div>
        </div>

        {/* Footer: Details badges */}
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
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
