import { useTranslation } from 'react-i18next'
import { findAircraft, findAirline } from '@kuuki/data'
import type { FlightFilters as FiltersType } from '@/hooks/useFlights'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FlightFiltersProps {
  filters: FiltersType
  onFiltersChange: (filters: FiltersType) => void
  years: number[]
  airlines: string[]
  aircraftCodes: string[]
  totalCount: number
  // Airport search state (managed externally for form submission)
  originSearch: string
  destSearch: string
  onOriginSearchChange: (value: string) => void
  onDestSearchChange: (value: string) => void
  onOriginSubmit: () => void
  onDestSubmit: () => void
  // Layout mode (kept for API compatibility, only horizontal supported now)
  layout?: 'horizontal' | 'vertical'
  className?: string
}

export function FlightFilters({
  filters,
  onFiltersChange,
  years,
  airlines,
  aircraftCodes,
  totalCount,
  originSearch,
  destSearch,
  onOriginSearchChange,
  onDestSearchChange,
  onOriginSubmit,
  onDestSubmit,
  className,
}: FlightFiltersProps) {
  const { t } = useTranslation()

  const handleYearFilter = (year: string) => {
    onFiltersChange({
      ...filters,
      year: year && year !== 'all' ? parseInt(year, 10) : undefined,
    })
  }

  const handleAirlineFilter = (airline: string) => {
    onFiltersChange({
      ...filters,
      airlineIata: airline && airline !== 'all' ? airline : undefined,
    })
  }

  const handleAircraftFilter = (aircraft: string) => {
    onFiltersChange({
      ...filters,
      aircraftIcao: aircraft && aircraft !== 'all' ? aircraft : undefined,
    })
  }

  const handleUpcomingFilter = (value: string) => {
    onFiltersChange({
      ...filters,
      isUpcoming: value === 'upcoming' ? true : value === 'past' ? false : undefined,
    })
  }

  const clearOriginFilter = () => {
    onOriginSearchChange('')
    onFiltersChange({ ...filters, origin: undefined })
  }

  const clearDestFilter = () => {
    onDestSearchChange('')
    onFiltersChange({ ...filters, destination: undefined })
  }

  const hasActiveFilters = Object.keys(filters).some(
    (k) => filters[k as keyof FiltersType] !== undefined
  )

  const clearAllFilters = () => {
    onFiltersChange({})
    onOriginSearchChange('')
    onDestSearchChange('')
  }

  // Get airline display name
  const getAirlineDisplay = (iataCode: string) => {
    const airline = findAirline(iataCode)
    return airline ? `${airline.name} (${iataCode})` : iataCode
  }

  // 1-line compact horizontal layout
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Search inputs first - most commonly used */}
      <form onSubmit={(e) => { e.preventDefault(); onOriginSubmit() }} className="relative">
        <Input
          value={originSearch}
          onChange={(e) => onOriginSearchChange(e.target.value.toUpperCase())}
          placeholder={t('flights.from', 'From')}
          className={cn(
            'w-24 h-9 font-mono text-sm uppercase pr-7',
            filters.origin && 'border-primary ring-1 ring-primary/20'
          )}
          maxLength={3}
        />
        {filters.origin ? (
          <button
            type="button"
            onClick={clearOriginFilter}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t('flights.clearOrigin', 'Clear origin filter')}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : (
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" aria-hidden="true" />
        )}
      </form>

      <span className="text-muted-foreground/40">→</span>

      <form onSubmit={(e) => { e.preventDefault(); onDestSubmit() }} className="relative">
        <Input
          value={destSearch}
          onChange={(e) => onDestSearchChange(e.target.value.toUpperCase())}
          placeholder={t('flights.to', 'To')}
          className={cn(
            'w-24 h-9 font-mono text-sm uppercase pr-7',
            filters.destination && 'border-primary ring-1 ring-primary/20'
          )}
          maxLength={3}
        />
        {filters.destination ? (
          <button
            type="button"
            onClick={clearDestFilter}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t('flights.clearDest', 'Clear destination filter')}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : (
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" aria-hidden="true" />
        )}
      </form>

      {/* Compact dropdowns */}
      <Select
        value={filters.year?.toString() || 'all'}
        onValueChange={handleYearFilter}
      >
        <SelectTrigger className="w-24 h-9 text-sm">
          <SelectValue placeholder={t('flights.year', 'Year')} />
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
        <SelectTrigger className="w-32 h-9 text-sm">
          <SelectValue placeholder={t('flights.airline', 'Airline')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('flights.allAirlines', 'All airlines')}</SelectItem>
          {airlines.map((iata) => (
            <SelectItem key={iata} value={iata}>
              {getAirlineDisplay(iata)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.aircraftIcao || 'all'}
        onValueChange={handleAircraftFilter}
      >
        <SelectTrigger className="w-28 h-9 text-sm">
          <SelectValue placeholder={t('flights.aircraft', 'Aircraft')} />
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
        <SelectTrigger className="w-28 h-9 text-sm">
          <SelectValue placeholder={t('flights.status', 'Status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('flights.allFlights', 'All')}</SelectItem>
          <SelectItem value="upcoming">{t('flights.upcoming', 'Upcoming')}</SelectItem>
          <SelectItem value="past">{t('flights.past', 'Past')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={clearAllFilters}
          className="h-9 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          {t('flights.clear', 'Clear')}
        </Button>
      )}

      {/* Flight count - right aligned */}
      <span className="ml-auto text-sm text-muted-foreground font-data tabular-nums">
        {totalCount.toLocaleString()} {t('flights.flights', 'flights')}
      </span>
    </div>
  )
}
