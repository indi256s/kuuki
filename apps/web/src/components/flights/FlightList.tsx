import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import { FlightFilters } from './FlightFilters'
import { AircraftEnrichButton } from './AircraftEnrichButton'
import {
  useFlights,
  useBatchDeleteFlights,
  useFlightYears,
  useFlightAirlines,
  useFlightAircraft,
  useAllFlightIds,
  type Flight,
  type FlightFilters as FiltersType,
  type SortConfig,
} from '@/hooks/useFlights'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plane, CheckSquare, Trash2 } from 'lucide-react'

interface FlightListProps {
  onEdit: (flight: Flight) => void
}

export function FlightList({ onEdit }: FlightListProps) {
  const { t } = useTranslation()
  const batchDeleteFlights = useBatchDeleteFlights()
  const { data: years = [] } = useFlightYears()
  const { data: airlines = [] } = useFlightAirlines()
  const { data: aircraftCodes = [] } = useFlightAircraft()

  // Filters
  const [filters, setFilters] = useState<FiltersType>({})
  const [sort, setSort] = useState<SortConfig>({ field: 'date', order: 'desc' })

  // Selection state for batch operations
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)

  // Airport search inputs
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')

  // Fetch flights with infinite scroll
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useFlights(filters, sort)

  // For "Select All" - fetch all IDs matching current filters
  const { refetch: fetchAllIds, isFetching: isFetchingAllIds } = useAllFlightIds(filters)

  // Flatten pages into single array
  const flights = useMemo(() => data?.pages.flatMap((page) => page.flights) ?? [], [data])
  const totalCount = data?.pages[0]?.total ?? 0

  // Find flights missing aircraft info (for enrichment button)
  const flightsMissingAircraft = useMemo(
    () => flights.filter(f => !f.aircraft_icao && f.airline_iata && f.flight_number),
    [flights]
  )

  const handleOriginSubmit = () => {
    const code = originSearch.toUpperCase().trim()
    if (code.length === 3 || code.length === 0) {
      setFilters((prev) => ({
        ...prev,
        origin: code || undefined,
      }))
    }
  }

  const handleDestSubmit = () => {
    const code = destSearch.toUpperCase().trim()
    if (code.length === 3 || code.length === 0) {
      setFilters((prev) => ({
        ...prev,
        destination: code || undefined,
      }))
    }
  }

  const handleSortChange = (newSort: SortConfig) => {
    setSort(newSort)
  }

  const hasActiveFilters = Object.keys(filters).some(
    (k) => filters[k as keyof FiltersType] !== undefined
  )

  const clearAllFilters = () => {
    setFilters({})
    setOriginSearch('')
    setDestSearch('')
  }

  // Selection mode handlers
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode, clear selections
      setSelectedIds(new Set())
    }
    setSelectionMode(!selectionMode)
  }

  // Select/Deselect all flights (not just visible)
  const allSelected = totalCount > 0 && selectedIds.size === totalCount
  const toggleSelectAll = async () => {
    if (allSelected) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      // Select ALL flights matching current filters (fetch IDs from server)
      const result = await fetchAllIds()
      if (result.data) {
        setSelectedIds(new Set(result.data))
      }
    }
  }

  const handleBatchDeleteClick = () => {
    if (selectedIds.size > 0) {
      setBatchDeleteConfirm(true)
    }
  }

  const confirmBatchDelete = async () => {
    if (selectedIds.size > 0) {
      await batchDeleteFlights.mutateAsync(Array.from(selectedIds))
      setSelectedIds(new Set())
      setSelectionMode(false)
      setBatchDeleteConfirm(false)
    }
  }

  const cancelBatchDelete = () => {
    setBatchDeleteConfirm(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  // Main content (table or cards)
  const flightContent = (
    <>
      {/* Empty state - Kuuki branded */}
      {flights.length === 0 && (
        <div className="py-24 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-muted/30 flex items-center justify-center">
            <Plane className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <p className="text-base font-semibold mb-1">
            {t('flights.noFlightsTitle', 'No flights found')}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {hasActiveFilters
              ? t('flights.noFlightsFiltered', 'Try adjusting your filters to see more flights')
              : t('flights.noFlightsYet', 'Add your first flight to start building your history')}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearAllFilters}
              className="mt-4"
            >
              {t('flights.clearFilters', 'Clear filters')}
            </Button>
          )}
        </div>
      )}

      {/* Flight list - CSS-only card/table switch at sm (640px) breakpoint */}
      {flights.length > 0 && (
        <>
          {/* Cards: visible on mobile (<640px) */}
          <div className="sm:hidden space-y-2">
            {flights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
                onEdit={onEdit}
              />
            ))}
          </div>

          {/* Table: visible on desktop (≥640px) */}
          <div className="hidden sm:block">
            <FlightTable
              flights={flights}
              onEdit={onEdit}
              sort={sort}
              onSortChange={handleSortChange}
              selectionEnabled={selectionMode}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center pt-4">
              <Button
                variant="ghost"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-muted-foreground hover:text-foreground"
              >
                {isFetchingNextPage ? t('common.loading') : t('common.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )

  return (
    <div className="space-y-4">
      {/* Filters and toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {!selectionMode ? (
          <>
            <FlightFilters
              layout="horizontal"
              filters={filters}
              onFiltersChange={setFilters}
              years={years}
              airlines={airlines}
              aircraftCodes={aircraftCodes}
              totalCount={totalCount}
              originSearch={originSearch}
              destSearch={destSearch}
              onOriginSearchChange={setOriginSearch}
              onDestSearchChange={setDestSearch}
              onOriginSubmit={handleOriginSubmit}
              onDestSubmit={handleDestSubmit}
            />

            {/* Action buttons - right aligned */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Aircraft enrichment - compact */}
              {flightsMissingAircraft.length > 0 && (
                <AircraftEnrichButton
                  flights={flightsMissingAircraft.slice(0, 20)}
                  variant="ghost"
                />
              )}

              {/* Select mode toggle */}
              {flights.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={toggleSelectionMode}
                  className="hidden sm:flex h-8 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <CheckSquare className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden md:inline text-sm">{t('flights.select', 'Select')}</span>
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Selection mode toolbar */
          <div className="flex items-center gap-2 w-full py-1.5 px-3 -mx-3 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground font-data">
              {selectedIds.size}
            </span>
            <span className="text-sm text-muted-foreground">
              {t('flights.selected', 'selected')}
            </span>

            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={isFetchingAllIds}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
            >
              {isFetchingAllIds
                ? t('common.loading')
                : allSelected
                  ? t('flights.deselectAll', 'Deselect All')
                  : t('flights.selectAll', 'Select All ({count})', { count: totalCount })}
            </button>

            <div className="flex-1" />

            <Button
              variant="ghost"
              onClick={handleBatchDeleteClick}
              disabled={selectedIds.size === 0}
              className="h-8 px-2.5 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('common.delete', 'Delete')}
            </Button>

            <Button
              variant="ghost"
              onClick={toggleSelectionMode}
              className="h-8 px-2.5 text-sm text-muted-foreground"
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>

      {flightContent}

      {/* Batch delete confirmation dialog */}
      <Dialog open={batchDeleteConfirm} onOpenChange={(open) => !open && cancelBatchDelete()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('flights.batchDeleteTitle', 'Delete {{count}} Flights?', { count: selectedIds.size })}</DialogTitle>
            <DialogDescription>
              {t('flights.batchDeleteMessage', 'This action cannot be undone. All selected flights will be permanently removed from your log.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelBatchDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBatchDelete}
              disabled={batchDeleteFlights.isPending}
            >
              {batchDeleteFlights.isPending ? t('common.loading') : t('flights.deleteCount', 'Delete {{count}}', { count: selectedIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
