import { useTranslation } from 'react-i18next'
import type { Flight } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, Plane } from 'lucide-react'

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
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('flights.date', 'Date')}</TableHead>
              <TableHead>{t('flights.route', 'Route')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('flights.airline', 'Airline')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('flights.aircraft', 'Aircraft')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('flights.distance', 'Distance')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('flights.duration', 'Duration')}</TableHead>
              <TableHead className="w-20">{t('common.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flights.map((flight) => {
              const originAirport = findAirport(flight.origin)
              const destAirport = findAirport(flight.destination)
              const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
              const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null
              const isUpcoming = flight.is_upcoming
              const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0

              return (
                <TableRow key={flight.id} className={isUpcoming ? 'text-primary' : ''}>
                  {/* Date */}
                  <TableCell>
                    <div>{formatDate(flight.date)}</div>
                    {isUpcoming && (
                      <div className="text-xs font-medium">
                        {t('flights.inDays', { days: daysAway })}
                      </div>
                    )}
                  </TableCell>

                  {/* Route */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="font-mono font-medium">{flight.origin}</div>
                        <div className="text-xs text-muted-foreground">{originAirport?.city || ''}</div>
                      </div>
                      <Plane className="w-4 h-4 text-muted-foreground flex-shrink-0 rotate-90" />
                      <div className="text-center">
                        <div className="font-mono font-medium">{flight.destination}</div>
                        <div className="text-xs text-muted-foreground">{destAirport?.city || ''}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Airline */}
                  <TableCell className="hidden md:table-cell">
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
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Aircraft */}
                  <TableCell className="hidden lg:table-cell">
                    {aircraft ? (
                      <span className="truncate max-w-32">{aircraft.model}</span>
                    ) : flight.aircraft_icao ? (
                      <span className="font-mono">{flight.aircraft_icao}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Distance */}
                  <TableCell className="hidden sm:table-cell">
                    {flight.distance_km ? (
                      <span className="font-data">{formatDistance(flight.distance_km)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="hidden md:table-cell">
                    {flight.duration_minutes ? (
                      formatDuration(flight.duration_minutes)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
