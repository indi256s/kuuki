import { useTranslation } from 'react-i18next'
import type { Flight, SortConfig, SortField } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  // Selection support
  selectedIds?: Set<number>
  onSelectionChange?: (selectedIds: Set<number>) => void
  selectionEnabled?: boolean
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

// Route visualization component with duration in the center
function RouteCell({ flight }: { flight: Flight }) {
  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)
  const duration = flight.duration_minutes ? formatDuration(flight.duration_minutes) : null

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Origin */}
      <div className="min-w-[4.5rem]">
        <div className="font-mono font-semibold text-base tracking-tight">{flight.origin}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[5rem]">
          {originAirport?.city || ''}
        </div>
      </div>

      {/* Flight path visualization with duration */}
      <div className="flex items-center flex-1 min-w-[7rem] max-w-[11rem]">
        <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
        <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent mx-1" />

        {/* Duration badge in the center */}
        <div className="px-2 py-0.5 rounded-full bg-muted/80 border border-border/50 flex-shrink-0">
          <span className="text-xs font-mono text-muted-foreground">
            {duration || '—'}
          </span>
        </div>

        <div className="flex-1 h-px bg-gradient-to-l from-primary/60 via-primary/20 to-transparent mx-1" />
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

export function FlightTable({
  flights,
  onEdit,
  onDelete,
  sort,
  onSortChange,
  selectedIds = new Set(),
  onSelectionChange,
  selectionEnabled = false,
}: FlightTableProps) {
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

  // Selection handlers
  const allSelected = flights.length > 0 && flights.every(f => selectedIds.has(f.id))
  const someSelected = flights.some(f => selectedIds.has(f.id)) && !allSelected

  const toggleSelectAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      // Deselect all visible flights
      const newSet = new Set(selectedIds)
      flights.forEach(f => newSet.delete(f.id))
      onSelectionChange(newSet)
    } else {
      // Select all visible flights
      const newSet = new Set(selectedIds)
      flights.forEach(f => newSet.add(f.id))
      onSelectionChange(newSet)
    }
  }

  const toggleSelect = (flightId: number) => {
    if (!onSelectionChange) return
    const newSet = new Set(selectedIds)
    if (newSet.has(flightId)) {
      newSet.delete(flightId)
    } else {
      newSet.add(flightId)
    }
    onSelectionChange(newSet)
  }

  return (
    <Card className="border-border/50 overflow-hidden shadow-sm">
      <CardContent className="p-0">
        {/* Horizontally scrollable table wrapper */}
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-2">
                {/* Selection checkbox column */}
                {selectionEnabled && (
                  <TableHead className="w-10 sticky left-0 bg-card z-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          // Set indeterminate state for partial selection
                          (el as unknown as HTMLInputElement).indeterminate = someSelected
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                      aria-label={t('flights.selectAll', 'Select all')}
                      className="data-[state=checked]:bg-primary"
                    />
                  </TableHead>
                )}
                <SortableHeader
                  field="date"
                  currentSort={sort}
                  onSort={onSortChange}
                  className={cn('w-28', !selectionEnabled && 'sticky left-0 bg-card z-10')}
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
                <TableHead className="w-28">
                  {t('flights.times', 'Times')}
                </TableHead>
                <SortableHeader
                  field="airline_iata"
                  currentSort={sort}
                  onSort={onSortChange}
                >
                  {t('flights.airline', 'Airline')}
                </SortableHeader>
                <SortableHeader
                  field="aircraft_icao"
                  currentSort={sort}
                  onSort={onSortChange}
                >
                  {t('flights.aircraft', 'Aircraft')}
                </SortableHeader>
                <SortableHeader
                  field="distance_km"
                  currentSort={sort}
                  onSort={onSortChange}
                  className="text-right"
                >
                  {t('flights.distance', 'Distance')}
                </SortableHeader>
                <TableHead className="w-20 text-right sticky right-0 bg-card z-10">
                  {t('common.actions', 'Actions')}
                </TableHead>
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

                const isSelected = selectedIds.has(flight.id)

                return (
                  <TableRow
                    key={flight.id}
                    className={cn(
                      'group transition-colors',
                      isUpcoming && 'bg-primary/[0.02]',
                      index % 2 === 0 && !isUpcoming && 'bg-muted/20',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    {/* Selection checkbox */}
                    {selectionEnabled && (
                      <TableCell className={cn(
                        'py-4 sticky left-0 z-10',
                        isSelected ? 'bg-primary/5' : isUpcoming ? 'bg-primary/[0.02]' : index % 2 === 0 ? 'bg-muted/20' : 'bg-card'
                      )}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(flight.id)}
                          aria-label={t('flights.selectFlight', 'Select flight')}
                          className="data-[state=checked]:bg-primary"
                        />
                      </TableCell>
                    )}
                    {/* Date - sticky on scroll when no selection */}
                    <TableCell className={cn(
                      'py-4',
                      !selectionEnabled && 'sticky left-0 z-10',
                      isSelected ? 'bg-primary/5' : isUpcoming ? 'bg-primary/[0.02]' : index % 2 === 0 ? 'bg-muted/20' : 'bg-card'
                    )}>
                      <div className={cn('font-medium', isUpcoming && 'text-primary')}>
                        {formatDate(flight.date)}
                      </div>
                      {isUpcoming && (
                        <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary border-primary/20">
                          {t('flights.inDays', { days: daysAway })}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Route with duration in center */}
                    <TableCell className="py-4">
                      <RouteCell flight={flight} />
                    </TableCell>

                    {/* Times */}
                    <TableCell className="py-4">
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
                    <TableCell className="py-4">
                      {airline ? (
                        <div className="flex items-center gap-2">
                          {airline.primaryColor && (
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-border/50"
                              style={{ backgroundColor: airline.primaryColor }}
                            />
                          )}
                          <div>
                            <span className="truncate max-w-32 block text-sm">{airline.name}</span>
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
                    <TableCell className="py-4">
                      {aircraft ? (
                        <div>
                          <span className="truncate max-w-32 block text-sm">{aircraft.model}</span>
                          <span className="text-xs text-muted-foreground">{aircraft.manufacturer}</span>
                        </div>
                      ) : flight.aircraft_icao ? (
                        <span className="font-mono text-sm">{flight.aircraft_icao}</span>
                      ) : (
                        <AircraftPendingBadge flightId={flight.id} />
                      )}
                    </TableCell>

                    {/* Distance */}
                    <TableCell className="py-4 text-right">
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

                    {/* Actions - sticky on scroll */}
                    <TableCell className={cn(
                      'py-4 text-right sticky right-0 z-10',
                      isSelected ? 'bg-primary/5' : isUpcoming ? 'bg-primary/[0.02]' : index % 2 === 0 ? 'bg-muted/20' : 'bg-card'
                    )}>
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
        </div>
      </CardContent>
    </Card>
  )
}
