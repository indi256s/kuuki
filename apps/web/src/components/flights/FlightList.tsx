import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import {
  useFlights,
  useDeleteFlight,
  useFlightYears,
  useFlightAirlines,
  useFlightAircraft,
  type Flight,
  type FlightFilters,
  type SortConfig,
} from '@/hooks/useFlights'
import { findAircraft } from '@kuuki/data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plane, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FlightListProps {
  onEdit: (flight: Flight) => void
}

export function FlightList({ onEdit }: FlightListProps) {
  const { t } = useTranslation()
  const deleteFlight = useDeleteFlight()
  const { data: years = [] } = useFlightYears()
  const { data: airlines = [] } = useFlightAirlines()
  const { data: aircraftCodes = [] } = useFlightAircraft()

  // Filters
  const [filters, setFilters] = useState<FlightFilters>({})
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

  const handleYearFilter = (year: string) => {
    setFilters((prev) => ({
      ...prev,
      year: year && year !== 'all' ? parseInt(year, 10) : undefined,
    }))
  }

  const handleAirlineFilter = (airline: string) => {
    setFilters((prev) => ({
      ...prev,
      airlineIata: airline && airline !== 'all' ? airline : undefined,
    }))
  }

  const handleAircraftFilter = (aircraft: string) => {
    setFilters((prev) => ({
      ...prev,
      aircraftIcao: aircraft && aircraft !== 'all' ? aircraft : undefined,
    }))
  }

  const handleUpcomingFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      isUpcoming: value === 'upcoming' ? true : value === 'past' ? false : undefined,
    }))
  }

  const handleOriginSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const code = originSearch.toUpperCase().trim()
    if (code.length === 3 || code.length === 0) {
      setFilters((prev) => ({
        ...prev,
        origin: code || undefined,
      }))
    }
  }

  const handleDestSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const code = destSearch.toUpperCase().trim()
    if (code.length === 3 || code.length === 0) {
      setFilters((prev) => ({
        ...prev,
        destination: code || undefined,
      }))
    }
  }

  const clearOriginFilter = () => {
    setOriginSearch('')
    setFilters((prev) => ({ ...prev, origin: undefined }))
  }

  const clearDestFilter = () => {
    setDestSearch('')
    setFilters((prev) => ({ ...prev, destination: undefined }))
  }

  const handleSortChange = (newSort: SortConfig) => {
    setSort(newSort)
  }

  const hasActiveFilters = Object.keys(filters).some((k) => filters[k as keyof FlightFilters] !== undefined)

  const clearAllFilters = () => {
    setFilters({})
    setOriginSearch('')
    setDestSearch('')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
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

  return (
    <div className="space-y-4">
      {/* Filters - Row 1 */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={filters.year?.toString() || 'all'}
          onValueChange={handleYearFilter}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder={t('flights.allYears', 'All years')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('flights.allYears', 'All years')}</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.airlineIata || 'all'}
          onValueChange={handleAirlineFilter}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder={t('flights.allAirlines', 'All airlines')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('flights.allAirlines', 'All airlines')}</SelectItem>
            {airlines.map((airline) => (
              <SelectItem key={airline} value={airline}>
                {airline}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.aircraftIcao || 'all'}
          onValueChange={handleAircraftFilter}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('flights.allAircraft', 'All aircraft')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('flights.allAircraft', 'All aircraft')}</SelectItem>
            {aircraftCodes.map((code) => {
              const aircraft = findAircraft(code)
              return (
                <SelectItem key={code} value={code}>
                  {aircraft ? aircraft.model : code}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Select
          value={filters.isUpcoming === true ? 'upcoming' : filters.isUpcoming === false ? 'past' : 'all'}
          onValueChange={handleUpcomingFilter}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('flights.allFlights', 'All flights')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('flights.allFlights', 'All flights')}</SelectItem>
            <SelectItem value="upcoming">{t('flights.upcoming', 'Upcoming')}</SelectItem>
            <SelectItem value="past">{t('flights.past', 'Past')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground">
          {t('flights.count', { count: totalCount })}
        </div>
      </div>

      {/* Filters - Row 2: Airport search */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleOriginSearch} className="relative">
          <Input
            value={originSearch}
            onChange={(e) => setOriginSearch(e.target.value.toUpperCase())}
            placeholder={t('flights.originFilter', 'Origin (e.g. SFO)')}
            className={cn(
              'w-36 font-mono text-sm uppercase pr-8',
              filters.origin && 'border-primary'
            )}
            maxLength={3}
          />
          {filters.origin ? (
            <button
              type="button"
              onClick={clearOriginFilter}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          )}
        </form>

        <form onSubmit={handleDestSearch} className="relative">
          <Input
            value={destSearch}
            onChange={(e) => setDestSearch(e.target.value.toUpperCase())}
            placeholder={t('flights.destFilter', 'Dest (e.g. JFK)')}
            className={cn(
              'w-36 font-mono text-sm uppercase pr-8',
              filters.destination && 'border-primary'
            )}
            maxLength={3}
          />
          {filters.destination ? (
            <button
              type="button"
              onClick={clearDestFilter}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          )}
        </form>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            {t('flights.clearFilters', 'Clear filters')}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {flights.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Plane className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('flights.noFlights', 'No flights found')}</p>
            {hasActiveFilters && (
              <Button
                variant="link"
                onClick={clearAllFilters}
                className="mt-2"
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
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? t('common.loading') : t('common.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent>
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
