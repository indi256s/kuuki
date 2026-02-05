import { useTranslation } from 'react-i18next'
import type { Flight, SortConfig, SortField } from '@/hooks/useFlights'
import { findAirport, findAirline, findAircraft } from '@kuuki/data'
import { formatDistance, formatDuration, daysUntilFlight } from '@/lib/geo'
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
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AircraftShimmerBadge } from './AircraftShimmerBadge'
import type { EnrichmentStatus } from '@kuuki/shared/types'

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

// Linear-style sortable column header
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
        'cursor-pointer select-none transition-colors whitespace-nowrap py-4',
        'text-xs font-medium tracking-wide uppercase text-muted-foreground',
        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive && 'text-foreground',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className={cn('transition-opacity', isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}>
          {isActive ? (
            isAsc ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </span>
      </div>
    </TableHead>
  )
}

// Linear-style minimal route cell - single line with cities inline
function RouteCell({ flight }: { flight: Flight }) {
  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)

  return (
    <div className="flex items-baseline gap-2">
      {/* Origin code */}
      <span className="font-data font-semibold text-base">{flight.origin}</span>
      {/* Origin city */}
      <span className="text-xs text-muted-foreground">
        {originAirport?.city || ''}
      </span>

      {/* Arrow */}
      <span className="text-muted-foreground/30 text-sm px-0.5">→</span>

      {/* Destination code */}
      <span className="font-data font-semibold text-base">{flight.destination}</span>
      {/* Destination city */}
      <span className="text-xs text-muted-foreground">
        {destAirport?.city || ''}
      </span>
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

  // Compact date: dd.mm.yy
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}.${month}.${year}`
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
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card/50">
      {/* Horizontally scrollable table wrapper */}
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="group hover:bg-transparent border-b border-border/40 bg-muted/20">
              {/* Selection checkbox column */}
              {selectionEnabled && (
                <TableHead className="w-10 pl-6 py-4 sticky left-0 bg-muted/20 z-10">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
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
                className={cn('w-24', !selectionEnabled && 'pl-6')}
              >
                {t('flights.date', 'Date')}
              </SortableHeader>
              <SortableHeader
                field="origin"
                currentSort={sort}
                onSort={onSortChange}
              >
                {t('flights.route', 'Route')}
              </SortableHeader>
              <SortableHeader
                field="duration_minutes"
                currentSort={sort}
                onSort={onSortChange}
              >
                {t('flights.duration', 'Duration')}
              </SortableHeader>
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
              <TableHead className="w-16 pr-6 py-4 text-right text-xs font-medium tracking-wide uppercase text-muted-foreground">
                <span className="sr-only">{t('common.actions', 'Actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flights.map((flight) => {
              const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
              const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null
              const isUpcoming = flight.is_upcoming
              const daysAway = isUpcoming ? daysUntilFlight(flight.date) : 0
              const duration = flight.duration_minutes ? formatDuration(flight.duration_minutes) : null

              const isSelected = selectedIds.has(flight.id)

              return (
                <TableRow
                  key={flight.id}
                  className={cn(
                    'group transition-[background-color,box-shadow] duration-200 border-b border-border/30 last:border-b-0',
                    'hover:bg-muted/30 hover:shadow-[inset_0_1px_0_rgba(0,0,0,0.02)]',
                    isUpcoming && 'bg-primary/[0.03] border-primary/30',
                    isSelected && 'bg-primary/5 hover:bg-primary/8'
                  )}
                >
                  {/* Selection checkbox */}
                  {selectionEnabled && (
                    <TableCell className="py-4 pl-6">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(flight.id)}
                        aria-label={t('flights.selectFlight', 'Select flight')}
                        className="data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </TableCell>
                  )}

                  {/* Date */}
                  <TableCell className={cn('py-4 align-top', !selectionEnabled && 'pl-6')}>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        'font-data text-base tabular-nums',
                        isUpcoming ? 'text-primary font-medium' : 'text-foreground'
                      )}>
                        {formatDate(flight.date)}
                      </span>
                      {isUpcoming && (
                        <span className="text-[10px] text-primary/70 font-medium">
                          +{daysAway}d
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Route */}
                  <TableCell className="py-4 align-top">
                    <RouteCell flight={flight} />
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="py-4 align-top">
                    {duration ? (
                      <span className="font-data text-base">{duration}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Airline */}
                  <TableCell className="py-4 align-top">
                    {airline ? (
                      <div className="flex items-baseline gap-2">
                        {airline.primaryColor && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 relative top-[3px]"
                            style={{ backgroundColor: airline.primaryColor }}
                          />
                        )}
                        <span className="text-sm">{airline.name}</span>
                        {flight.flight_number && (
                          <span className="text-xs text-muted-foreground font-data">
                            {flight.airline_iata}{flight.flight_number}
                          </span>
                        )}
                      </div>
                    ) : flight.airline_iata ? (
                      <span className="font-data text-sm">{flight.airline_iata}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Aircraft */}
                  <TableCell className="py-4 align-top">
                    {aircraft ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-muted-foreground">{aircraft.model}</span>
                        <span className="text-xs text-muted-foreground/70">{aircraft.manufacturer}</span>
                      </div>
                    ) : flight.aircraft_icao ? (
                      <span className="font-data text-sm">{flight.aircraft_icao}</span>
                    ) : (
                      <AircraftShimmerBadge
                        flightId={flight.id}
                        enrichmentStatus={(flight as { enrichment_status?: EnrichmentStatus }).enrichment_status ?? 'pending'}
                      />
                    )}
                  </TableCell>

                  {/* Distance */}
                  <TableCell className="py-4 align-top text-right">
                    {flight.distance_km ? (
                      <span className="font-data text-base tabular-nums">{formatDistance(flight.distance_km)}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Actions - always visible */}
                  <TableCell className="py-4 pr-6 align-top text-right">
                    <div className="flex gap-1 justify-end transition-opacity duration-150">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-95 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => onEdit(flight)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => onDelete(flight)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
