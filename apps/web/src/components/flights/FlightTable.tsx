import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'

interface FlightTableProps {
  flights: Flight[]
  onEdit: (flight: Flight) => void
  onDelete: (flight: Flight) => void
}

export function FlightTable({ flights, onEdit, onDelete }: FlightTableProps) {
  const { t } = useTranslation()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge text-left">
            <th className="pb-3 font-medium text-ink-muted">{t('flights.date', 'Date')}</th>
            <th className="pb-3 font-medium text-ink-muted">{t('flights.route', 'Route')}</th>
            <th className="pb-3 font-medium text-ink-muted hidden md:table-cell">{t('flights.airline', 'Airline')}</th>
            <th className="pb-3 font-medium text-ink-muted hidden lg:table-cell">{t('flights.aircraft', 'Aircraft')}</th>
            <th className="pb-3 font-medium text-ink-muted hidden sm:table-cell">{t('flights.distance', 'Distance')}</th>
            <th className="pb-3 font-medium text-ink-muted hidden md:table-cell">{t('flights.duration', 'Duration')}</th>
            <th className="pb-3 font-medium text-ink-muted w-20">{t('common.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {flights.map((flight) => {
            const originAirport = findAirport(flight.origin)
            const destAirport = findAirport(flight.destination)
            const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
            const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null
            const isUpcoming = flight.is_upcoming
            const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0

            return (
              <tr key={flight.id} className={`hover:bg-sky-raised ${isUpcoming ? 'text-runway' : ''}`}>
                {/* Date */}
                <td className="py-3">
                  <div>{formatDate(flight.date)}</div>
                  {isUpcoming && (
                    <div className="text-xs font-medium">
                      {t('flights.inDays', { days: daysAway })}
                    </div>
                  )}
                </td>

                {/* Route */}
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <div className="font-mono font-medium">{flight.origin}</div>
                      <div className="text-xs text-ink-muted">{originAirport?.city || ''}</div>
                    </div>
                    <svg className="w-4 h-4 text-ink-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 5.5v3.5l6 3.5v1.5l-6-1.75v3.25l1.5 1v1l-2.5-.75-2.5.75v-1l1.5-1v-3.25l-6 1.75v-1.5l6-3.5v-3.5a1.5 1.5 0 013 0z" />
                    </svg>
                    <div className="text-center">
                      <div className="font-mono font-medium">{flight.destination}</div>
                      <div className="text-xs text-ink-muted">{destAirport?.city || ''}</div>
                    </div>
                  </div>
                </td>

                {/* Airline */}
                <td className="py-3 hidden md:table-cell">
                  {airline ? (
                    <div className="flex items-center gap-2">
                      {airline.primaryColor && (
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: airline.primaryColor }}
                        />
                      )}
                      <span className="truncate max-w-32">{airline.name}</span>
                    </div>
                  ) : flight.airline_iata ? (
                    <span className="font-mono">{flight.airline_iata}</span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>

                {/* Aircraft */}
                <td className="py-3 hidden lg:table-cell">
                  {aircraft ? (
                    <span className="truncate max-w-32">{aircraft.model}</span>
                  ) : flight.aircraft_icao ? (
                    <span className="font-mono">{flight.aircraft_icao}</span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>

                {/* Distance */}
                <td className="py-3 hidden sm:table-cell">
                  {flight.distance_km ? (
                    formatDistance(flight.distance_km)
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>

                {/* Duration */}
                <td className="py-3 hidden md:table-cell">
                  {flight.duration_minutes ? (
                    formatDuration(flight.duration_minutes)
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-3">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
