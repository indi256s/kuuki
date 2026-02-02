import { useTranslation } from 'react-i18next'
import { findAircraft } from '@kuuki/data'
import type { FlightFilters as FiltersType } from '@/hooks/useFlights'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Filter, Plane, Calendar, Building2, PlaneTakeoff } from 'lucide-react'
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
  // Layout mode
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
  layout = 'horizontal',
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

  // Vertical sidebar layout for large screens
  if (layout === 'vertical') {
    return (
      <Card className={cn('border-border/50 sticky top-24', className)}>
        <CardContent className="p-5 space-y-6">
          {/* Header with count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {t('flights.filters', 'Filters')}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('flights.clearAll', 'Clear all')}
              </Button>
            )}
          </div>

          {/* Flight count summary */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-semibold font-data tracking-tight">
                  {totalCount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('flights.totalFlights', 'Total flights')}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Time filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {t('flights.timeFilter', 'Time period')}
            </Label>
            <Select
              value={filters.isUpcoming === true ? 'upcoming' : filters.isUpcoming === false ? 'past' : 'all'}
              onValueChange={handleUpcomingFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('flights.allFlights', 'All flights')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('flights.allFlights', 'All flights')}</SelectItem>
                <SelectItem value="upcoming">{t('flights.upcoming', 'Upcoming')}</SelectItem>
                <SelectItem value="past">{t('flights.past', 'Past')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('flights.year', 'Year')}
            </Label>
            <Select
              value={filters.year?.toString() || 'all'}
              onValueChange={handleYearFilter}
            >
              <SelectTrigger className="w-full">
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
          </div>

          <Separator />

          {/* Route filters */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <PlaneTakeoff className="w-3.5 h-3.5" />
              {t('flights.route', 'Route')}
            </Label>

            <form onSubmit={(e) => { e.preventDefault(); onOriginSubmit() }} className="relative">
              <Input
                value={originSearch}
                onChange={(e) => onOriginSearchChange(e.target.value.toUpperCase())}
                placeholder={t('flights.originPlaceholder', 'Origin (SFO)')}
                className={cn(
                  'font-mono text-sm uppercase pr-8',
                  filters.origin && 'border-primary bg-primary/5'
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

            <form onSubmit={(e) => { e.preventDefault(); onDestSubmit() }} className="relative">
              <Input
                value={destSearch}
                onChange={(e) => onDestSearchChange(e.target.value.toUpperCase())}
                placeholder={t('flights.destPlaceholder', 'Destination (JFK)')}
                className={cn(
                  'font-mono text-sm uppercase pr-8',
                  filters.destination && 'border-primary bg-primary/5'
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
          </div>

          <Separator />

          {/* Airline filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {t('flights.airline', 'Airline')}
            </Label>
            <Select
              value={filters.airlineIata || 'all'}
              onValueChange={handleAirlineFilter}
            >
              <SelectTrigger className="w-full">
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
          </div>

          {/* Aircraft filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5" />
              {t('flights.aircraft', 'Aircraft')}
            </Label>
            <Select
              value={filters.aircraftIcao || 'all'}
              onValueChange={handleAircraftFilter}
            >
              <SelectTrigger className="w-full">
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
          </div>
        </CardContent>
      </Card>
    )
  }

  // Horizontal layout for smaller screens
  return (
    <div className={cn('space-y-3', className)}>
      {/* Row 1: Dropdowns */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={filters.year?.toString() || 'all'}
          onValueChange={handleYearFilter}
        >
          <SelectTrigger className="w-28 h-9">
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
          <SelectTrigger className="w-28 h-9">
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
          <SelectTrigger className="w-32 h-9">
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
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder={t('flights.allFlights', 'All flights')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('flights.allFlights', 'All flights')}</SelectItem>
            <SelectItem value="upcoming">{t('flights.upcoming', 'Upcoming')}</SelectItem>
            <SelectItem value="past">{t('flights.past', 'Past')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground font-data">
          {t('flights.count', { count: totalCount })}
        </div>
      </div>

      {/* Row 2: Airport search */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={(e) => { e.preventDefault(); onOriginSubmit() }} className="relative">
          <Input
            value={originSearch}
            onChange={(e) => onOriginSearchChange(e.target.value.toUpperCase())}
            placeholder={t('flights.originFilter', 'Origin (e.g. SFO)')}
            className={cn(
              'w-36 h-9 font-mono text-sm uppercase pr-8',
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

        <form onSubmit={(e) => { e.preventDefault(); onDestSubmit() }} className="relative">
          <Input
            value={destSearch}
            onChange={(e) => onDestSearchChange(e.target.value.toUpperCase())}
            placeholder={t('flights.destFilter', 'Dest (e.g. JFK)')}
            className={cn(
              'w-36 h-9 font-mono text-sm uppercase pr-8',
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
            onClick={clearAllFilters}
            className="h-9 text-muted-foreground"
          >
            {t('flights.clearFilters', 'Clear filters')}
          </Button>
        )}
      </div>
    </div>
  )
}
