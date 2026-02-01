import { useTranslation } from 'react-i18next'
import type { Flight, SortConfig, SortField } from '@/hooks/useFlights'
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
import { Pencil, Trash2, Plane, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AircraftPendingBadge } from './AircraftPendingBadge'

interface FlightTableProps {
  flights: Flight[]
  onEdit: (flight: Flight) => void
  onDelete: (flight: Flight) => void
  sort?: SortConfig
  onSortChange?: (sort: SortConfig) => void
}

// Sortable column header component
function SortableHeader({
  field,
  currentSort,
  onSort,
  children,
  className,
}: {
  field: SortField
  currentSort?: SortConfig
  onSort?: (sort: SortConfig) => void
  children: React.ReactNode
  className?: string
}) {
  const isActive = currentSort?.field === field
  const isAsc = isActive && currentSort?.order === 'asc'

  const handleClick = () => {
    if (!onSort) return
    // Toggle order if same field, otherwise default to desc (newest first for date)
    const newOrder = isActive && currentSort?.order === 'desc' ? 'asc' : 'desc'
    onSort({ field, order: newOrder })
  }

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-muted/50 transition-colors',
        isActive && 'bg-muted/30',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive ? (
          isAsc ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </TableHead>
  )
}

export function FlightTable({ flights, onEdit, onDelete, sort, onSortChange }: FlightTableProps) {
  const { t } = useTranslation()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return null
    return time
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHeader field="date" currentSort={sort} onSort={onSortChange}>
                {t('flights.date', 'Date')}
              </SortableHeader>
              <SortableHeader field="origin" currentSort={sort} onSort={onSortChange}>
                {t('flights.route', 'Route')}
              </SortableHeader>
              <TableHead className="hidden lg:table-cell">{t('flights.times', 'Times')}</TableHead>
              <SortableHeader
                field="airline_iata"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden md:table-cell"
              >
                {t('flights.airline', 'Airline')}
              </SortableHeader>
              <SortableHeader
                field="aircraft_icao"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden lg:table-cell"
              >
                {t('flights.aircraft', 'Aircraft')}
              </SortableHeader>
              <SortableHeader
                field="distance_km"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden sm:table-cell"
              >
                {t('flights.distance', 'Distance')}
              </SortableHeader>
              <SortableHeader
                field="duration_minutes"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden md:table-cell"
              >
                {t('flights.duration', 'Duration')}
              </SortableHeader>
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
              const depTime = formatTime(flight.departure_time)
              const arrTime = formatTime(flight.arrival_time)

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

                  {/* Route + Flight Number */}
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
                    {flight.flight_number && (
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        {flight.airline_iata}{flight.flight_number}
                      </div>
                    )}
                  </TableCell>

                  {/* Times */}
                  <TableCell className="hidden lg:table-cell">
                    {depTime || arrTime ? (
                      <div className="text-sm">
                        <span className="font-mono">{depTime || '—'}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="font-mono">{arrTime || '—'}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
                      <AircraftPendingBadge flightId={flight.id} />
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
