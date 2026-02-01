import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'

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

  return (
    <div className={`bg-sky-raised border border-edge rounded-lg p-4 ${isUpcoming ? 'border-l-4 border-l-runway' : ''}`}>
      {/* Header: Date & Actions */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm text-ink-muted">{formatDate(flight.date)}</div>
          {isUpcoming && (
            <div className="text-xs text-runway font-medium">
              {t('flights.daysUntil', { days: daysAway })}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(flight)}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-sky rounded"
            aria-label={t('common.edit')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(flight)}
            className="p-1.5 text-ink-muted hover:text-emergency hover:bg-emergency/10 rounded"
            aria-label={t('common.delete')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <div className="font-mono font-bold text-lg">{flight.origin}</div>
          <div className="text-xs text-ink-muted truncate max-w-20">
            {originAirport?.city || 'Unknown'}
          </div>
        </div>

        <div className="flex-1 flex items-center">
          <div className="flex-1 border-t border-dashed border-ink-muted" />
          <svg className="w-5 h-5 text-ink-muted -mx-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
          <div className="flex-1 border-t border-dashed border-ink-muted" />
        </div>

        <div className="text-center">
          <div className="font-mono font-bold text-lg">{flight.destination}</div>
          <div className="text-xs text-ink-muted truncate max-w-20">
            {destAirport?.city || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-2 text-xs">
        {airline && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky rounded">
            {airline.primaryColor && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: airline.primaryColor }}
              />
            )}
            {airline.name}
          </span>
        )}

        {flight.flight_number && (
          <span className="inline-flex items-center px-2 py-1 bg-sky rounded font-mono">
            {flight.flight_number}
          </span>
        )}

        {aircraft && (
          <span className="inline-flex items-center px-2 py-1 bg-sky rounded">
            {aircraft.name}
          </span>
        )}

        {flight.distance_km && (
          <span className="inline-flex items-center px-2 py-1 bg-sky rounded">
            {formatDistance(flight.distance_km)}
          </span>
        )}

        {flight.duration_minutes && (
          <span className="inline-flex items-center px-2 py-1 bg-sky rounded">
            {formatDuration(flight.duration_minutes)}
          </span>
        )}
      </div>

      {/* Times */}
      {(flight.departure_time || flight.arrival_time) && (
        <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between text-sm text-ink-muted">
          <div>
            {flight.departure_time && (
              <span>{flight.departure_time}</span>
            )}
          </div>
          <div>
            {flight.arrival_time && (
              <span>{flight.arrival_time}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
