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
        'cursor-pointer select-none transition-colors whitespace-nowrap',
        'text-xs font-medium tracking-wide uppercase text-muted-foreground',
        'hover:text-foreground',
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
    <div className="flex items-baseline gap-1.5">
      {/* Origin code */}
      <span className="font-data font-semibold text-sm">{flight.origin}</span>
      {/* Origin city */}
      <span className="text-[11px] text-muted-foreground truncate max-w-[4rem]">
        {originAirport?.city || ''}
      </span>

      {/* Arrow */}
      <span className="text-muted-foreground/40 text-xs px-0.5">→</span>

      {/* Destination code */}
      <span className="font-data font-semibold text-sm">{flight.destination}</span>
      {/* Destination city */}
      <span className="text-[11px] text-muted-foreground truncate max-w-[4rem]">
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
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
      {/* Horizontally scrollable table wrapper */}
      <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="group hover:bg-transparent border-b border-border/40 bg-muted/30">
              {/* Selection checkbox column */}
              {selectionEnabled && (
                <TableHead className="w-10 pl-4 sticky left-0 bg-muted/30 z-10">
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
                className={cn('w-24', !selectionEnabled && 'pl-4')}
              >
                {t('flights.date', 'Date')}
              </SortableHeader>
              <SortableHeader
                field="origin"
                currentSort={sort}
                onSort={onSortChange}
                className="min-w-[11rem]"
              >
                {t('flights.route', 'Route')}
              </SortableHeader>
              <SortableHeader
                field="duration_minutes"
                currentSort={sort}
                onSort={onSortChange}
                className="w-20"
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
              <TableHead className="w-16 pr-4 text-right text-xs font-medium tracking-wide uppercase text-muted-foreground">
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
                    'group transition-colors border-b border-border/30 last:border-b-0',
                    'hover:bg-muted/40',
                    isUpcoming && 'bg-primary/[0.02]',
                    isSelected && 'bg-primary/5 hover:bg-primary/8'
                  )}
                >
                  {/* Selection checkbox */}
                  {selectionEnabled && (
                    <TableCell className="py-2.5 pl-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(flight.id)}
                        aria-label={t('flights.selectFlight', 'Select flight')}
                        className="data-[state=checked]:bg-primary"
                      />
                    </TableCell>
                  )}

                  {/* Date */}
                  <TableCell className={cn('py-2.5 align-top', !selectionEnabled && 'pl-4')}>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        'font-data text-sm tabular-nums',
                        isUpcoming ? 'text-primary font-medium' : 'text-foreground'
                      )}>
                        {formatDate(flight.date)}
                      </span>
                      {isUpcoming && (
                        <span className="text-[10px] text-primary/70">
                          +{daysAway}d
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Route */}
                  <TableCell className="py-2.5 align-top">
                    <RouteCell flight={flight} />
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="py-2.5 align-top">
                    {duration ? (
                      <span className="font-data text-sm text-muted-foreground">{duration}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Airline */}
                  <TableCell className="py-2.5 align-top">
                    {airline ? (
                      <div className="flex items-baseline gap-1.5">
                        {airline.primaryColor && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 relative top-[3px]"
                            style={{ backgroundColor: airline.primaryColor }}
                          />
                        )}
                        <span className="truncate text-sm max-w-[7rem]">{airline.name}</span>
                        {flight.flight_number && (
                          <span className="text-[11px] text-muted-foreground font-data">
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
                  <TableCell className="py-2.5 align-top">
                    {aircraft ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm max-w-[6rem]">{aircraft.model}</span>
                        <span className="text-[11px] text-muted-foreground">{aircraft.manufacturer}</span>
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
                  <TableCell className="py-2.5 align-top text-right">
                    {flight.distance_km ? (
                      <span className="font-data text-sm tabular-nums">{formatDistance(flight.distance_km)}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Actions - hidden until hover */}
                  <TableCell className="py-2.5 pr-4 align-top text-right">
                    <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(flight)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(flight)}
                      >
                        <Trash2 className="w-3 h-3" />
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
