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
  onDelete: (flight: Flight) => void
}

export function FlightCard({ flight, onEdit, onDelete }: FlightCardProps) {

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
        'group rounded-lg border border-border/40 bg-card/50 p-3',
        'transition-[transform,box-shadow,background-color] duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        'active:translate-y-0 active:shadow-sm active:bg-muted/40',
        isUpcoming && 'border-primary/20 bg-primary/[0.02]'
      )}
    >
      {/* Top row: Route + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Route - primary content */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-data font-semibold text-base">{flight.origin}</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[4rem]">
              {originAirport?.city || ''}
            </span>
            <span className="text-muted-foreground/40 text-xs">→</span>
            <span className="font-data font-semibold text-base">{flight.destination}</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[4rem]">
              {destAirport?.city || ''}
            </span>
          </div>

          {/* Meta line: Date, flight number */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className={cn(
              'font-data text-xs tabular-nums',
              isUpcoming ? 'text-primary' : 'text-muted-foreground'
            )}>
              {formatDate(flight.date)}
            </span>
            {isUpcoming && (
              <span className="text-[10px] text-primary/70">+{daysAway}d</span>
            )}
            {hasFlightNumber && (
              <span className="text-xs text-muted-foreground font-data">
                {flight.airline_iata}{flight.flight_number}
              </span>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <FlightCardActions
          onEdit={() => onEdit(flight)}
          onDelete={() => onDelete(flight)}
        />
      </div>

      {/* Bottom row: Details - all baseline aligned */}
      <div className="flex items-baseline gap-2 mt-2 pt-2 border-t border-border/20 text-xs text-muted-foreground">
        {/* Duration */}
        {duration && (
          <span className="font-data">{duration}</span>
        )}

        {/* Airline with color dot */}
        {airline && (
          <span className="flex items-baseline gap-1">
            {airline.primaryColor && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 relative top-[1px]"
                style={{ backgroundColor: airline.primaryColor }}
              />
            )}
            <span className="truncate max-w-[5rem]">{airline.name}</span>
          </span>
        )}

        {/* Aircraft */}
        {aircraft ? (
          <span className="truncate max-w-[5rem]">{aircraft.model}</span>
        ) : !flight.aircraft_icao ? (
          <AircraftShimmerBadge
            flightId={flight.id}
            enrichmentStatus={(flight as { enrichment_status?: EnrichmentStatus }).enrichment_status ?? 'pending'}
          />
        ) : (
          <span className="font-data">{flight.aircraft_icao}</span>
        )}

        {/* Distance - pushed right */}
        {flight.distance_km && (
          <span className="font-data tabular-nums ml-auto">
            {formatDistance(flight.distance_km)}
          </span>
        )}
      </div>
    </div>
  )
}
