import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import { useFlights, useDeleteFlight, useFlightYears, useFlightAirlines, type Flight, type FlightFilters } from '@/hooks/useFlights'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Plane } from 'lucide-react'

interface FlightListProps {
  onEdit: (flight: Flight) => void
}

export function FlightList({ onEdit }: FlightListProps) {
  const { t } = useTranslation()
  const deleteFlight = useDeleteFlight()
  const { data: years = [] } = useFlightYears()
  const { data: airlines = [] } = useFlightAirlines()

  // Filters
  const [filters, setFilters] = useState<FlightFilters>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

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
  } = useFlights(filters)

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
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
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={filters.year?.toString() || 'all'}
          onValueChange={handleYearFilter}
        >
          <SelectTrigger className="w-32">
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
          <SelectTrigger className="w-32">
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

        <div className="ml-auto text-sm text-muted-foreground">
          {t('flights.count', { count: totalCount })}
        </div>
      </div>

      {/* Empty state */}
      {flights.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Plane className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('flights.noFlights', 'No flights found')}</p>
            {Object.keys(filters).some((k) => filters[k as keyof FlightFilters]) && (
              <Button
                variant="link"
                onClick={() => setFilters({})}
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
