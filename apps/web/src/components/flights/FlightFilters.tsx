import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { findAircraft, findAirline, airlines } from '@kuuki/data'
import type { FlightFilters as FiltersType } from '@/hooks/useFlights'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Alliance = 'star_alliance' | 'oneworld' | 'skyteam'

const ALLIANCE_INFO: Record<Alliance, { name: string; symbol: string; colorClass: string }> = {
  star_alliance: { name: 'Star Alliance', symbol: '★', colorClass: 'text-amber-500' },
  oneworld: { name: 'Oneworld', symbol: '○', colorClass: 'text-red-500' },
  skyteam: { name: 'SkyTeam', symbol: '△', colorClass: 'text-blue-500' },
}

interface FlightFiltersProps {
  filters: FiltersType
  onFiltersChange: (filters: FiltersType) => void
  years: number[]
  airlineCodes: string[]
  aircraftCodes: string[]
  totalCount: number
  // Airport search state
  originSearch: string
  destSearch: string
  onOriginSearchChange: (value: string) => void
  onDestSearchChange: (value: string) => void
  // Layout mode (kept for API compatibility, only horizontal supported now)
  layout?: 'horizontal' | 'vertical'
  className?: string
}

export function FlightFilters({
  filters,
  onFiltersChange,
  years,
  airlineCodes,
  aircraftCodes,
  totalCount,
  originSearch,
  destSearch,
  onOriginSearchChange,
  onDestSearchChange,
  className,
}: FlightFiltersProps) {
  const { t } = useTranslation()

  const handleYearFilter = (year: string) => {
    onFiltersChange({
      ...filters,
      year: year && year !== 'all' ? parseInt(year, 10) : undefined,
    })
  }

  const handleAirlineFilter = (value: string) => {
    if (!value || value === 'all') {
      // Clear airline filter
      onFiltersChange({
        ...filters,
        airlineIata: undefined,
        airlineIataCodes: undefined,
      })
    } else if (value.startsWith('alliance:')) {
      // Alliance selected - resolve to array of airline codes
      const alliance = value.replace('alliance:', '') as Alliance
      const allianceCodes = airlines
        .filter(a => a.alliance === alliance)
        .map(a => a.iata)
      onFiltersChange({
        ...filters,
        airlineIata: undefined,
        airlineIataCodes: allianceCodes,
      })
    } else {
      // Single airline selected
      onFiltersChange({
        ...filters,
        airlineIata: value,
        airlineIataCodes: undefined,
      })
    }
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
    onFiltersChange({ ...filters, origin: undefined, originCodes: undefined })
  }

  const clearDestFilter = () => {
    onDestSearchChange('')
    onFiltersChange({ ...filters, destination: undefined, destinationCodes: undefined })
  }

  const hasActiveFilters = Object.keys(filters).some(
    (k) => {
      const val = filters[k as keyof FiltersType]
      if (Array.isArray(val)) return val.length > 0
      return val !== undefined
    }
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

  // Group user's airlines by alliance
  const groupedAirlines = useMemo(() => {
    const groups: Record<Alliance | 'other', string[]> = {
      star_alliance: [],
      oneworld: [],
      skyteam: [],
      other: [],
    }

    for (const iata of airlineCodes) {
      const airline = findAirline(iata)
      if (airline?.alliance) {
        groups[airline.alliance].push(iata)
      } else {
        groups.other.push(iata)
      }
    }

    return groups
  }, [airlineCodes])

  // Determine current select value for display
  const getAirlineSelectValue = () => {
    if (filters.airlineIataCodes && filters.airlineIataCodes.length > 0) {
      // Check if it matches an alliance
      for (const alliance of Object.keys(ALLIANCE_INFO) as Alliance[]) {
        const allianceCodes = airlines.filter(a => a.alliance === alliance).map(a => a.iata)
        const userAllianceCodes = filters.airlineIataCodes.filter(code =>
          allianceCodes.includes(code)
        )
        if (userAllianceCodes.length === filters.airlineIataCodes.length &&
            userAllianceCodes.length > 0) {
          return `alliance:${alliance}`
        }
      }
    }
    return filters.airlineIata || 'all'
  }

  // 1-line compact horizontal layout
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Search inputs first - most commonly used */}
      <div className="relative">
        <Input
          value={originSearch}
          onChange={(e) => onOriginSearchChange(e.target.value)}
          placeholder={t('flights.cityOrCode', 'City or code')}
          className={cn(
            'w-32 h-9 text-sm pr-7',
            (filters.origin || (filters.originCodes && filters.originCodes.length > 0)) && 'border-primary ring-1 ring-primary/20'
          )}
        />
        {(filters.origin || (filters.originCodes && filters.originCodes.length > 0)) ? (
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
      </div>

      <span className="text-muted-foreground/40">→</span>

      <div className="relative">
        <Input
          value={destSearch}
          onChange={(e) => onDestSearchChange(e.target.value)}
          placeholder={t('flights.cityOrCode', 'City or code')}
          className={cn(
            'w-32 h-9 text-sm pr-7',
            (filters.destination || (filters.destinationCodes && filters.destinationCodes.length > 0)) && 'border-primary ring-1 ring-primary/20'
          )}
        />
        {(filters.destination || (filters.destinationCodes && filters.destinationCodes.length > 0)) ? (
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
      </div>

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
        value={getAirlineSelectValue()}
        onValueChange={handleAirlineFilter}
      >
        <SelectTrigger className="w-32 h-9 text-sm">
          <SelectValue placeholder={t('flights.airline', 'Airline')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('flights.allAirlines', 'All airlines')}</SelectItem>

          {/* Alliance quick-select options */}
          {(Object.keys(ALLIANCE_INFO) as Alliance[]).some(a => groupedAirlines[a].length > 0) && (
            <>
              <SelectSeparator />
              {(Object.keys(ALLIANCE_INFO) as Alliance[]).map(alliance => {
                if (groupedAirlines[alliance].length === 0) return null
                const info = ALLIANCE_INFO[alliance]
                return (
                  <SelectItem key={`alliance:${alliance}`} value={`alliance:${alliance}`}>
                    <span className={cn('mr-1.5', info.colorClass)}>{info.symbol}</span>
                    {info.name}
                  </SelectItem>
                )
              })}
            </>
          )}

          {/* Grouped airlines */}
          {(Object.keys(ALLIANCE_INFO) as Alliance[]).map(alliance => {
            if (groupedAirlines[alliance].length === 0) return null
            const info = ALLIANCE_INFO[alliance]
            return (
              <SelectGroup key={alliance}>
                <SelectSeparator />
                <SelectLabel className="text-xs text-muted-foreground">
                  <span className={cn('mr-1', info.colorClass)}>{info.symbol}</span>
                  {info.name}
                </SelectLabel>
                {groupedAirlines[alliance].map(iata => (
                  <SelectItem key={iata} value={iata} className="pl-6">
                    {getAirlineDisplay(iata)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )
          })}

          {/* Other airlines (no alliance) */}
          {groupedAirlines.other.length > 0 && (
            <SelectGroup>
              <SelectSeparator />
              <SelectLabel className="text-xs text-muted-foreground">
                {t('flights.otherAirlines', 'Other')}
              </SelectLabel>
              {groupedAirlines.other.map(iata => (
                <SelectItem key={iata} value={iata} className="pl-6">
                  {getAirlineDisplay(iata)}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
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
