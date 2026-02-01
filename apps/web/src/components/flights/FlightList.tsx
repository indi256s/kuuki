import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import { FlightFilters } from './FlightFilters'
import {
  useFlights,
  useDeleteFlight,
  useFlightYears,
  useFlightAirlines,
  useFlightAircraft,
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
import { Plane } from 'lucide-react'

interface FlightListProps {
  onEdit: (flight: Flight) => void
  // Layout mode for different screen sizes
  showSidebar?: boolean
}

export function FlightList({ onEdit, showSidebar = false }: FlightListProps) {
  const { t } = useTranslation()
  const deleteFlight = useDeleteFlight()
  const { data: years = [] } = useFlightYears()
  const { data: airlines = [] } = useFlightAirlines()
  const { data: aircraftCodes = [] } = useFlightAircraft()

  // Filters
  const [filters, setFilters] = useState<FiltersType>({})
  const [sort, setSort] = useState<SortConfig>({ field: 'date', order: 'desc' })
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Airport search inputs
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')

  // Responsive view detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch flights with infinite scroll
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useFlights(filters, sort)

  // Flatten pages into single array
  const flights = data?.pages.flatMap((page) => page.flights) ?? []
  const totalCount = data?.pages[0]?.total ?? 0

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
      {/* Empty state */}
      {flights.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Plane className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">
              {t('flights.noFlightsTitle', 'No flights found')}
            </p>
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? t('flights.noFlightsFiltered', 'Try adjusting your filters')
                : t('flights.noFlightsYet', 'Add your first flight to get started')}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="mt-4"
              >
                {t('flights.clearFilters', 'Clear filters')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Flight list */}
      {flights.length > 0 && (
        <>
          {isMobile ? (
            <div className="space-y-3">
              {flights.map((flight) => (
                <FlightCard
                  key={flight.id}
                  flight={flight}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <FlightTable
              flights={flights}
              onEdit={onEdit}
              onDelete={handleDelete}
              sort={sort}
              onSortChange={handleSortChange}
            />
          )}

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="min-w-[200px]"
              >
                {isFetchingNextPage ? t('common.loading') : t('common.loadMore', 'Load more flights')}
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
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
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
      </>
    )
  }

  // Horizontal filters layout (default)
  return (
    <div className="space-y-4">
      {/* Horizontal filters */}
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
    </div>
  )
}
