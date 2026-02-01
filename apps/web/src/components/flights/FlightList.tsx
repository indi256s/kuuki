import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightCard } from './FlightCard'
import { FlightTable } from './FlightTable'
import { useFlights, useDeleteFlight, useFlightYears, useFlightAirlines, type Flight, type FlightFilters } from '@/hooks/useFlights'

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
      year: year ? parseInt(year, 10) : undefined,
    }))
  }

  const handleAirlineFilter = (airline: string) => {
    setFilters((prev) => ({
      ...prev,
      airlineIata: airline || undefined,
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-runway border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-emergency-muted text-emergency rounded-lg text-center">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filters.year || ''}
          onChange={(e) => handleYearFilter(e.target.value)}
          className="px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised text-sm focus:outline-none focus:ring-2 focus:ring-runway"
        >
          <option value="">{t('flights.allYears', 'All years')}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={filters.airlineIata || ''}
          onChange={(e) => handleAirlineFilter(e.target.value)}
          className="px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised text-sm focus:outline-none focus:ring-2 focus:ring-runway"
        >
          <option value="">{t('flights.allAirlines', 'All airlines')}</option>
          {airlines.map((airline) => (
            <option key={airline} value={airline}>
              {airline}
            </option>
          ))}
        </select>

        <div className="ml-auto text-sm text-ink-muted">
          {t('flights.count', { count: totalCount })}
        </div>
      </div>

      {/* Empty state */}
      {flights.length === 0 && (
        <div className="text-center py-12 text-ink-muted">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
          <p>{t('flights.noFlights', 'No flights found')}</p>
          {Object.keys(filters).some((k) => filters[k as keyof FlightFilters]) && (
            <button
              onClick={() => setFilters({})}
              className="mt-2 text-runway hover:underline"
            >
              {t('flights.clearFilters', 'Clear filters')}
            </button>
          )}
        </div>
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
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2 bg-sky-raised border border-edge-strong rounded-lg hover:bg-sky text-sm font-medium disabled:opacity-50"
              >
                {isFetchingNextPage ? t('common.loading') : t('common.loadMore', 'Load more')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-sky w-full max-w-sm mx-4 rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-2">
              {t('flights.deleteConfirmTitle', 'Delete Flight?')}
            </h3>
            <p className="text-ink-muted mb-6">
              {t('flights.deleteConfirmMessage', 'This action cannot be undone. The flight will be permanently removed from your log.')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 py-2 px-4 border border-edge-strong text-ink font-medium rounded-lg hover:bg-sky-raised transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteFlight.isPending}
                className="flex-1 py-2 px-4 bg-emergency text-ink-inverse font-medium rounded-lg hover:bg-emergency/90 disabled:opacity-50 transition-colors"
              >
                {deleteFlight.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
