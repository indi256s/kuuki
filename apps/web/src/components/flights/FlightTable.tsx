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
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Clock, MapPin } from 'lucide-react'
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
    const newOrder = isActive && currentSort?.order === 'desc' ? 'asc' : 'desc'
    onSort({ field, order: newOrder })
  }

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap',
        isActive && 'bg-muted/30',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1.5">
        {children}
        {isActive ? (
          isAsc ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  )
}

// Route visualization component - the hero element of each row
function RouteCell({ flight }: { flight: Flight }) {
  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Origin */}
      <div className="min-w-[4.5rem]">
        <div className="font-mono font-semibold text-base tracking-tight">{flight.origin}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[5rem]">
          {originAirport?.city || ''}
        </div>
      </div>

      {/* Flight path visualization */}
      <div className="flex items-center flex-1 min-w-[6rem] max-w-[10rem]">
        <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
        <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60 mx-1" />
        {/* Plane icon in the middle */}
        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 -mx-0.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-3 h-3 text-primary rotate-90"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60 mx-1" />
        <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
      </div>

      {/* Destination */}
      <div className="min-w-[4.5rem] text-right">
        <div className="font-mono font-semibold text-base tracking-tight">{flight.destination}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[5rem] ml-auto">
          {destAirport?.city || ''}
        </div>
      </div>
    </div>
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
    <Card className="border-border/50 overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-2">
              <SortableHeader
                field="date"
                currentSort={sort}
                onSort={onSortChange}
                className="w-32"
              >
                {t('flights.date', 'Date')}
              </SortableHeader>
              <SortableHeader
                field="origin"
                currentSort={sort}
                onSort={onSortChange}
                className="min-w-[16rem]"
              >
                {t('flights.route', 'Route')}
              </SortableHeader>
              <TableHead className="hidden xl:table-cell w-28">
                {t('flights.times', 'Times')}
              </TableHead>
              <SortableHeader
                field="airline_iata"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden lg:table-cell"
              >
                {t('flights.airline', 'Airline')}
              </SortableHeader>
              <SortableHeader
                field="aircraft_icao"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden xl:table-cell"
              >
                {t('flights.aircraft', 'Aircraft')}
              </SortableHeader>
              <SortableHeader
                field="distance_km"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden 3xl:table-cell text-right"
              >
                {t('flights.distance', 'Distance')}
              </SortableHeader>
              <SortableHeader
                field="duration_minutes"
                currentSort={sort}
                onSort={onSortChange}
                className="hidden 3xl:table-cell text-right"
              >
                {t('flights.duration', 'Duration')}
              </SortableHeader>
              <TableHead className="w-24 text-right">{t('common.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flights.map((flight, index) => {
              const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
              const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null
              const isUpcoming = flight.is_upcoming
              const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0
              const depTime = formatTime(flight.departure_time)
              const arrTime = formatTime(flight.arrival_time)

              return (
                <TableRow
                  key={flight.id}
                  className={cn(
                    'group transition-colors',
                    isUpcoming && 'bg-primary/[0.02]',
                    index % 2 === 0 && !isUpcoming && 'bg-muted/20'
                  )}
                >
                  {/* Date */}
                  <TableCell className="py-4">
                    <div className={cn('font-medium', isUpcoming && 'text-primary')}>
                      {formatDate(flight.date)}
                    </div>
                    {isUpcoming && (
                      <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary border-primary/20">
                        {t('flights.inDays', { days: daysAway })}
                      </Badge>
                    )}
                    {flight.flight_number && (
                      <div className="text-xs text-muted-foreground mt-1 font-mono lg:hidden">
                        {flight.airline_iata}{flight.flight_number}
                      </div>
                    )}
                  </TableCell>

                  {/* Route - the hero element */}
                  <TableCell className="py-4">
                    <RouteCell flight={flight} />
                  </TableCell>

                  {/* Times */}
                  <TableCell className="hidden xl:table-cell py-4">
                    {depTime || arrTime ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono">{depTime || '—'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono">{arrTime || '—'}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Airline */}
                  <TableCell className="hidden lg:table-cell py-4">
                    {airline ? (
                      <div className="flex items-center gap-2">
                        {airline.primaryColor && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-border/50"
                            style={{ backgroundColor: airline.primaryColor }}
                          />
                        )}
                        <div>
                          <span className="truncate max-w-36 block text-sm">{airline.name}</span>
                          {flight.flight_number && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {flight.airline_iata}{flight.flight_number}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : flight.airline_iata ? (
                      <span className="font-mono text-sm">{flight.airline_iata}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Aircraft */}
                  <TableCell className="hidden xl:table-cell py-4">
                    {aircraft ? (
                      <div>
                        <span className="truncate max-w-36 block text-sm">{aircraft.model}</span>
                        <span className="text-xs text-muted-foreground">{aircraft.manufacturer}</span>
                      </div>
                    ) : flight.aircraft_icao ? (
                      <span className="font-mono text-sm">{flight.aircraft_icao}</span>
                    ) : (
                      <AircraftPendingBadge flightId={flight.id} />
                    )}
                  </TableCell>

                  {/* Distance */}
                  <TableCell className="hidden 3xl:table-cell py-4 text-right">
                    {flight.distance_km ? (
                      <div>
                        <span className="font-data text-sm">{formatDistance(flight.distance_km)}</span>
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {Math.round(flight.distance_km / 1.852).toLocaleString()} nm
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="hidden 3xl:table-cell py-4 text-right">
                    {flight.duration_minutes ? (
                      <span className="font-data text-sm">{formatDuration(flight.duration_minutes)}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4 text-right">
                    <div className="flex gap-1 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
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
