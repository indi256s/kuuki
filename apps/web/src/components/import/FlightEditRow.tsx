import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { findAirport, findAirline } from '@kuuki/data'
import { AirportAutocomplete } from '../flights/AirportAutocomplete'
import { AirlineAutocomplete } from '../flights/AirlineAutocomplete'
import { AircraftAutocomplete } from '../flights/AircraftAutocomplete'
import { EnrichmentFieldShimmer } from './EnrichmentShimmer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { TimeInput } from '@/components/ui/time-input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover'
import { ChevronDown, Trash2, AlertCircle, Plane, Loader2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedFlight } from '../../hooks/useImport'

interface FlightEditRowProps {
  flight: ExtractedFlight
  index: number
  selected: boolean
  isDuplicate?: boolean
  /** Whether enrichment is in progress (shows shimmer for aircraft/times) */
  isEnriching?: boolean
  onSelect: (selected: boolean) => void
  onChange: (flight: ExtractedFlight) => void
  onDelete: () => void
}

const LOW_CONFIDENCE_THRESHOLD = 0.8

/**
 * Calculate smart year suggestion for dates where year was inferred.
 * Returns the most recent past occurrence of the month/day.
 */
function calculateSmartYearSuggestion(dateStr: string): { suggestedDate: string; suggestedYear: number } | null {
  if (!dateStr) return null

  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return null

  const today = new Date()
  const currentYear = today.getFullYear()

  // Try the current year first
  const dateThisYear = new Date(currentYear, month - 1, day)

  // If the date is in the future by more than a week, suggest last year
  const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  if (dateThisYear > oneWeekFromNow) {
    // Suggest last year
    const suggestedYear = currentYear - 1
    return {
      suggestedDate: `${suggestedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      suggestedYear,
    }
  }

  // If the original year is not current year, suggest current year
  if (year !== currentYear) {
    return {
      suggestedDate: `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      suggestedYear: currentYear,
    }
  }

  return null
}

export function FlightEditRow({
  flight,
  index,
  selected,
  isDuplicate,
  isEnriching = false,
  onSelect,
  onChange,
  onDelete,
}: FlightEditRowProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [yearPopoverOpen, setYearPopoverOpen] = useState(false)

  // Check if year was inferred (not explicit in source document)
  const isYearInferred = flight.field_confidence?.date_year_explicit === false

  // Calculate smart year suggestion
  const yearSuggestion = useMemo(() => {
    if (!isYearInferred) return null
    return calculateSmartYearSuggestion(flight.date)
  }, [isYearInferred, flight.date])

  // Get confidence for a field - only numeric confidence fields
  type ConfidenceField = Exclude<keyof NonNullable<ExtractedFlight['field_confidence']>, 'date_year_explicit'>

  const getFieldConfidence = (field: ConfidenceField): number => {
    const value = flight.field_confidence?.[field]
    return typeof value === 'number' ? value : flight.confidence
  }

  const isLowConfidence = (field: ConfidenceField) => {
    return getFieldConfidence(field) < LOW_CONFIDENCE_THRESHOLD
  }

  const handleFieldChange = useCallback((field: keyof ExtractedFlight, value: string) => {
    onChange({
      ...flight,
      [field]: value,
    })
  }, [flight, onChange])

  // Apply the smart year suggestion
  const handleApplyYearSuggestion = useCallback(() => {
    if (yearSuggestion) {
      onChange({
        ...flight,
        date: yearSuggestion.suggestedDate,
        // Mark year as now explicitly set by user
        field_confidence: {
          ...flight.field_confidence,
          date_year_explicit: true,
        },
      })
      setYearPopoverOpen(false)
    }
  }, [flight, onChange, yearSuggestion])

  // Get display names for airports/airlines
  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)
  const airline = findAirline(flight.airline_iata)

  // Validate row
  const isValid =
    flight.date &&
    flight.origin?.length === 3 &&
    flight.destination?.length === 3 &&
    flight.airline_iata?.length === 2 &&
    flight.origin !== flight.destination

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const hasWarning = isDuplicate || !isValid || flight.confidence < LOW_CONFIDENCE_THRESHOLD

  return (
    <div
      className={cn(
        "group rounded-xl border transition-[border-color,background-color] duration-200",
        selected
          ? "border-primary/40 bg-primary/[0.03] shadow-sm"
          : "border-border/60 bg-card hover:border-border hover:bg-card/80",
        hasWarning && selected && "border-warning/40 bg-warning/[0.03]",
        hasWarning && !selected && "border-warning/30"
      )}
    >
      {/* Main row - clean, scannable */}
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Checkbox with smooth interaction */}
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked === true)}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />

        {/* Flight icon + number */}
        <div className="flex items-center gap-2 w-16 flex-shrink-0">
          <Plane aria-hidden="true" className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
        </div>

        {/* Date - prominent, with year warning if inferred */}
        <div className="w-32 flex-shrink-0">
          {isYearInferred ? (
            <Popover open={yearPopoverOpen} onOpenChange={setYearPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-md",
                    "border border-warning/50 bg-warning/10 hover:bg-warning/20 transition-colors"
                  )}
                >
                  <Calendar aria-hidden="true" className="w-3.5 h-3.5 text-warning" />
                  <span>{formatDate(flight.date)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <PopoverHeader>
                  <PopoverTitle className="flex items-center gap-2">
                    <Calendar aria-hidden="true" className="w-4 h-4 text-warning" />
                    {t('import.review.yearInferred', 'Year not found')}
                  </PopoverTitle>
                  <PopoverDescription>
                    {t('import.review.yearInferredDesc', 'The year was not found in the document and was inferred.')}
                  </PopoverDescription>
                </PopoverHeader>
                {yearSuggestion && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('import.review.didYouMean', 'Did you mean:')}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-8 text-sm"
                      onClick={handleApplyYearSuggestion}
                    >
                      {formatDate(yearSuggestion.suggestedDate)}
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            <span className="text-sm font-medium">{formatDate(flight.date)}</span>
          )}
        </div>

        {/* Route - the hero */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-base tracking-wide">
              {flight.origin || '???'}
            </span>
            <span className="text-muted-foreground text-xs">
              {originAirport?.city || ''}
            </span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground/50">
            <div className="w-8 h-px bg-border" />
            <Plane aria-hidden="true" className="w-3 h-3 rotate-90" />
            <div className="w-8 h-px bg-border" />
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-base tracking-wide">
              {flight.destination || '???'}
            </span>
            <span className="text-muted-foreground text-xs">
              {destAirport?.city || ''}
            </span>
          </div>
        </div>

        {/* Airline badge */}
        <div className="flex items-center gap-2 w-24 flex-shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{flight.airline_iata}</span>
          {airline && (
            <span className="text-xs text-muted-foreground/70 truncate">{airline.name}</span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 w-28 flex-shrink-0 justify-end">
          {isEnriching && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('import.review.enriching', 'Enriching')}
            </span>
          )}
          {isDuplicate && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning-foreground border border-warning/20">
              {t('import.review.duplicate', 'Duplicate')}
            </span>
          )}
          {!isValid && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              {t('import.review.invalid', 'Invalid')}
            </span>
          )}
          {flight.confidence < LOW_CONFIDENCE_THRESHOLD && !isDuplicate && isValid && !isEnriching && (
            <AlertCircle aria-hidden="true" className="w-4 h-4 text-warning" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronDown aria-hidden="true" className={cn(
              "w-4 h-4 transition-transform duration-200 ease-out",
              expanded && "rotate-180"
            )} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Expanded edit form with smooth animation */}
      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
        expanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/30 space-y-4">
          {/* Low confidence note */}
          {flight.confidence < LOW_CONFIDENCE_THRESHOLD && (
            <div className="flex items-center gap-2 text-sm text-warning-foreground bg-warning/10 rounded-lg px-3 py-2">
              <AlertCircle aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
              <span>{t('import.review.lowConfidence', 'Some fields may need verification')}</span>
            </div>
          )}

          {/* Year warning note */}
          {isYearInferred && (
            <div className="flex items-center justify-between gap-2 text-sm text-warning-foreground bg-warning/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Calendar aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
                <span>{t('import.review.yearNotInDocument', 'Year was not found in document')}</span>
              </div>
              {yearSuggestion && (
                <Button
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={handleApplyYearSuggestion}
                >
                  {t('import.review.useYear', 'Use {{year}}', { year: yearSuggestion.suggestedYear })}
                </Button>
              )}
            </div>
          )}

          {/* Edit grid - clean columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                {t('flights.date', 'Date')}
                {isYearInferred && (
                  <Calendar aria-hidden="true" className="w-3 h-3 text-warning" />
                )}
              </Label>
              <DateInput
                value={flight.date}
                onChange={(value) => handleFieldChange('date', value)}
                className={cn(
                  "h-9",
                  isLowConfidence('date') && "border-warning ring-1 ring-warning/20",
                  isYearInferred && "border-warning ring-1 ring-warning/20"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('flights.origin', 'From')}
              </Label>
              <AirportAutocomplete
                value={flight.origin}
                onChange={(iata) => handleFieldChange('origin', iata)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('flights.destination', 'To')}
              </Label>
              <AirportAutocomplete
                value={flight.destination}
                onChange={(iata) => handleFieldChange('destination', iata)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                {t('flights.airline', 'Airline')}
                {(!flight.airline_iata || flight.airline_iata.length !== 2) && (
                  <AlertCircle className="w-3 h-3 text-destructive" />
                )}
              </Label>
              <div className={cn(
                "rounded-md",
                (!flight.airline_iata || flight.airline_iata.length !== 2) && "ring-2 ring-destructive/30"
              )}>
                <AirlineAutocomplete
                  value={flight.airline_iata}
                  onChange={(iata) => handleFieldChange('airline_iata', iata)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('flights.flightNumber', 'Flight #')}
              </Label>
              <Input
                type="text"
                value={flight.flight_number || ''}
                onChange={(e) => handleFieldChange('flight_number', e.target.value)}
                placeholder="123"
                className="h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                {t('flights.aircraft', 'Aircraft')}
                {isEnriching && !flight.aircraft_icao && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </Label>
              {isEnriching && !flight.aircraft_icao ? (
                <EnrichmentFieldShimmer />
              ) : (
                <AircraftAutocomplete
                  value={flight.aircraft_icao || ''}
                  onChange={(icao) => handleFieldChange('aircraft_icao', icao)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                {t('flights.departureTime', 'Departure')}
                {isEnriching && !flight.departure_time && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </Label>
              {isEnriching && !flight.departure_time ? (
                <EnrichmentFieldShimmer />
              ) : (
                <TimeInput
                  value={flight.departure_time || ''}
                  onChange={(value) => handleFieldChange('departure_time', value)}
                  className="h-9"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                {t('flights.arrivalTime', 'Arrival')}
                {isEnriching && !flight.arrival_time && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </Label>
              {isEnriching && !flight.arrival_time ? (
                <EnrichmentFieldShimmer />
              ) : (
                <TimeInput
                  value={flight.arrival_time || ''}
                  onChange={(value) => handleFieldChange('arrival_time', value)}
                  className="h-9"
                />
              )}
            </div>
          </div>

          {/* Confidence indicator */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              {t('import.review.confidence', 'AI Confidence')}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    flight.confidence >= 0.8 ? "bg-success" : "bg-warning"
                  )}
                  style={{ width: `${flight.confidence * 100}%` }}
                />
              </div>
              <span className={cn(
                "text-xs font-mono",
                flight.confidence >= 0.8 ? "text-success" : "text-warning"
              )}>
                {Math.round(flight.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
