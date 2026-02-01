import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plane } from 'lucide-react'
import { AircraftPendingBadge } from './AircraftPendingBadge'

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
    <Card className={`border-border/50 hover:shadow-md transition-all ${isUpcoming ? 'border-l-4 border-l-primary' : ''}`}>
      <CardContent className="p-4">
        {/* Header: Date & Actions */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm text-muted-foreground">{formatDate(flight.date)}</div>
            {isUpcoming && (
              <div className="text-xs text-primary font-medium">
                {t('flights.daysUntil', { days: daysAway })}
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(flight)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(flight)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-3 mb-2">
          <div className="text-center">
            <div className="font-mono font-bold text-lg">{flight.origin}</div>
            <div className="text-xs text-muted-foreground truncate max-w-20">
              {originAirport?.city || 'Unknown'}
            </div>
          </div>

          <div className="flex-1 flex items-center">
            <div className="flex-1 border-t border-dashed border-muted-foreground/50" />
            <Plane className="w-5 h-5 text-muted-foreground -mx-1 rotate-90" />
            <div className="flex-1 border-t border-dashed border-muted-foreground/50" />
          </div>

          <div className="text-center">
            <div className="font-mono font-bold text-lg">{flight.destination}</div>
            <div className="text-xs text-muted-foreground truncate max-w-20">
              {destAirport?.city || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Flight number and Times - more prominent placement */}
        {(hasFlightNumber || hasTimes) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
            {hasFlightNumber ? (
              <span className="font-mono">{flight.airline_iata}{flight.flight_number}</span>
            ) : (
              <span />
            )}
            {hasTimes && (
              <div className="font-mono">
                {flight.departure_time || '—'}
                <span className="mx-1">→</span>
                {flight.arrival_time || '—'}
              </div>
            )}
          </div>
        )}

        {/* Details */}
        <div className="flex flex-wrap gap-2 text-xs">
          {airline && (
            <Badge variant="secondary" className="gap-1">
              {airline.primaryColor && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: airline.primaryColor }}
                />
              )}
              {airline.name}
            </Badge>
          )}

          {aircraft ? (
            <Badge variant="secondary">
              {aircraft.name}
            </Badge>
          ) : !flight.aircraft_icao ? (
            <AircraftPendingBadge flightId={flight.id} />
          ) : (
            <Badge variant="secondary" className="font-mono">
              {flight.aircraft_icao}
            </Badge>
          )}

          {flight.distance_km && (
            <Badge variant="secondary">
              {formatDistance(flight.distance_km)}
            </Badge>
          )}

          {flight.duration_minutes && (
            <Badge variant="secondary">
              {formatDuration(flight.duration_minutes)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
