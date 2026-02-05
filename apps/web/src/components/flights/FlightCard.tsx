import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { FlightCardActions } from './FlightCardActions'
import { AircraftShimmerBadge } from './AircraftShimmerBadge'
import { cn } from '@/lib/utils'
import type { EnrichmentStatus } from '@kuuki/shared/types'

interface FlightCardProps {
  flight: Flight
  onEdit: (flight: Flight) => void
}

export function FlightCard({ flight, onEdit }: FlightCardProps) {

  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)
  const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
  const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null

  const isUpcoming = flight.is_upcoming
  const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0
  const duration = flight.duration_minutes ? formatDuration(flight.duration_minutes) : null

  // Compact date: dd.mm.yy
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}.${month}.${year}`
  }

  const hasFlightNumber = flight.flight_number && flight.airline_iata

  return (
    <div
      className={cn(
        'group rounded-xl border border-border/60 bg-card shadow-sm p-4 sm:p-5',
        'transition-[transform,box-shadow,background-color] duration-200',
        'hover:-translate-y-1 hover:shadow-lg hover:border-border/60',
        'active:-translate-y-0.5 active:shadow-md active:bg-muted/40',
        isUpcoming && 'border-primary/30 bg-primary/[0.03]'
      )}
    >
      {/* Top row: Route + Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Route - primary content */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono font-semibold text-lg">{flight.origin}</span>
            <span className="text-xs text-muted-foreground">
              {originAirport?.city || ''}
            </span>
            <span className="text-muted-foreground/40">→</span>
            <span className="font-mono font-semibold text-lg">{flight.destination}</span>
            <span className="text-xs text-muted-foreground">
              {destAirport?.city || ''}
            </span>
          </div>

          {/* Meta line: Date, flight number */}
          <div className="flex items-baseline gap-3 mt-2">
            <span className={cn(
              'font-mono text-sm tabular-nums',
              isUpcoming ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {formatDate(flight.date)}
            </span>
            {isUpcoming && (
              <span className="text-[10px] text-primary/70 font-medium">+{daysAway}d</span>
            )}
            {hasFlightNumber && (
              <span className="text-xs text-muted-foreground font-mono">
                {flight.airline_iata}{flight.flight_number}
              </span>
            )}
          </div>
        </div>

        {/* Edit button - delete moved to edit modal */}
        <FlightCardActions onEdit={() => onEdit(flight)} />
      </div>

      {/* Bottom row: Details */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/30 text-sm">
        {/* Duration */}
        {duration && (
          <span className="font-mono text-foreground">{duration}</span>
        )}

        {/* Airline badge */}
        {airline && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-white"
            style={{
              backgroundColor: airline.primaryColor || 'oklch(0.97 0.003 250)'
            }}
          >
            {airline.name}
          </span>
        )}

        {/* Aircraft */}
        {aircraft ? (
          <span className="text-foreground">{aircraft.model}</span>
        ) : flight.aircraft_icao ? (
          <span className="font-mono text-foreground">{flight.aircraft_icao}</span>
        ) : (
          <AircraftShimmerBadge
            flightId={flight.id}
            enrichmentStatus={(flight as { enrichment_status?: EnrichmentStatus }).enrichment_status ?? 'pending'}
          />
        )}

        {/* Distance - pushed right */}
        {flight.distance_km && (
          <span className="font-mono tabular-nums ml-auto text-foreground">
            {formatDistance(flight.distance_km)}
          </span>
        )}
      </div>
    </div>
  )
}
