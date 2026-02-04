import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import { FlightFilters } from './FlightFilters'
import { AircraftEnrichButton } from './AircraftEnrichButton'
import {
  useFlights,
  useDeleteFlight,
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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plane, Sparkles, CheckSquare, CheckCheck, Trash2, X } from 'lucide-react'

interface FlightListProps {
  onEdit: (flight: Flight) => void
  // Layout mode for different screen sizes
  showSidebar?: boolean
}

export function FlightList({ onEdit, showSidebar = false }: FlightListProps) {
  const { t } = useTranslation()
  const deleteFlight = useDeleteFlight()
  const batchDeleteFlights = useBatchDeleteFlights()
  const { data: years = [] } = useFlightYears()
  const { data: airlines = [] } = useFlightAirlines()
  const { data: aircraftCodes = [] } = useFlightAircraft()

  // Filters
  const [filters, setFilters] = useState<FiltersType>({})
  const [sort, setSort] = useState<SortConfig>({ field: 'date', order: 'desc' })
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

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

  const handleDelete = (flight: Flight) => {
    setDeleteConfirmId(flight.id)
  }

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteFlight.mutateAsync(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmId(null)
  }

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
        {!showSidebar && (
          <div className="flex gap-3 flex-wrap">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        )}
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
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
      {/* Empty state - Linear-style minimal */}
      {flights.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-muted/40 flex items-center justify-center">
            <Plane className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {t('flights.noFlightsTitle', 'No flights found')}
          </p>
          <p className="text-muted-foreground text-sm">
            {hasActiveFilters
              ? t('flights.noFlightsFiltered', 'Try adjusting your filters')
              : t('flights.noFlightsYet', 'Add your first flight to get started')}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearAllFilters}
              className="mt-3 text-sm"
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
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Table: visible on desktop (≥640px) */}
          <div className="hidden sm:block">
            <FlightTable
              flights={flights}
              onEdit={onEdit}
              onDelete={handleDelete}
              sort={sort}
              onSortChange={handleSortChange}
              selectionEnabled={selectionMode}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>

          {/* Load more - Linear-style subtle */}
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

  // Two-column layout with sidebar
  if (showSidebar) {
    return (
      <>
        <div className="flex gap-8">
          {/* Sidebar filters */}
          <aside className="w-72 flex-shrink-0">
            <FlightFilters
              layout="vertical"
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

            {/* Aircraft enrichment section */}
            {flightsMissingAircraft.length > 0 && (
              <Card className="mt-4 border-border/50 bg-primary/[0.02]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t('enrich.missingAircraft', 'Missing Aircraft')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('enrich.missingAircraftDesc', '{{count}} flights have no aircraft type', {
                          count: flightsMissingAircraft.length,
                        })}
                      </p>
                      <AircraftEnrichButton
                        flights={flightsMissingAircraft.slice(0, 20)}
                        variant="outline"
                        className="mt-3 w-full"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Selection toolbar for sidebar layout */}
            {flights.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                {!selectionMode ? (
                  <Button
                    variant="outline"
                    onClick={toggleSelectionMode}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {t('flights.select', 'Select')}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={toggleSelectionMode}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t('common.cancel')}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={toggleSelectAll}
                      disabled={isFetchingAllIds}
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      {isFetchingAllIds
                        ? t('common.loading')
                        : allSelected
                          ? t('flights.deselectAll', 'Deselect All')
                          : t('flights.selectAll', 'Select All ({count})', { count: totalCount })}
                    </Button>

                    <Badge variant="secondary" className="text-sm">
                      {t('flights.selectedCount', '{{count}} selected', { count: selectedIds.size })}
                    </Badge>

                    <div className="flex-1" />

                    <Button
                      variant="destructive"
                      onClick={handleBatchDeleteClick}
                      disabled={selectedIds.size === 0}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('flights.deleteSelected', 'Delete Selected')}
                    </Button>
                  </>
                )}
              </div>
            )}
            {flightContent}
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && cancelDelete()}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>{t('flights.deleteConfirmTitle', 'Delete Flight?')}</DialogTitle>
              <DialogDescription>
                {t('flights.deleteConfirmMessage', 'This action cannot be undone. The flight will be permanently removed from your log.')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDelete}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteFlight.isPending}
              >
                {deleteFlight.isPending ? t('common.loading') : t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </>
    )
  }

  // Horizontal filters layout (default)
  return (
    <div className="space-y-4">
      {/* Horizontal filters and toolbar - Linear-style minimal */}
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

            {/* Action buttons - right aligned, subtle */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Aircraft enrichment - compact */}
              {flightsMissingAircraft.length > 0 && (
                <AircraftEnrichButton
                  flights={flightsMissingAircraft.slice(0, 20)}
                  variant="ghost"
                />
              )}

              {/* Select mode toggle - icon only on smaller screens */}
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
          /* Selection mode toolbar - Linear-style inline */
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('flights.deleteConfirmTitle', 'Delete Flight?')}</DialogTitle>
            <DialogDescription>
              {t('flights.deleteConfirmMessage', 'This action cannot be undone. The flight will be permanently removed from your log.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteFlight.isPending}
            >
              {deleteFlight.isPending ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
