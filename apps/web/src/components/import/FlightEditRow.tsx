import { useState, useCallback } from 'react'
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
import { ChevronDown, Trash2, AlertCircle, Plane, Loader2 } from 'lucide-react'
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

  const getFieldConfidence = (field: keyof NonNullable<ExtractedFlight['field_confidence']>) => {
    return flight.field_confidence?.[field] ?? flight.confidence
  }

  const isLowConfidence = (field: keyof NonNullable<ExtractedFlight['field_confidence']>) => {
    return getFieldConfidence(field) < LOW_CONFIDENCE_THRESHOLD
  }

  const handleFieldChange = useCallback((field: keyof ExtractedFlight, value: string) => {
    onChange({
      ...flight,
      [field]: value,
    })
  }, [flight, onChange])

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
        "group rounded-xl border transition-all duration-200",
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
          <Plane className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
        </div>

        {/* Date - prominent */}
        <div className="w-28 flex-shrink-0">
          <span className="text-sm font-medium">{formatDate(flight.date)}</span>
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
            <Plane className="w-3 h-3 rotate-90" />
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
            <AlertCircle className="w-4 h-4 text-warning" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-200",
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
        "overflow-hidden transition-all duration-300 ease-out",
        expanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/30 space-y-4">
          {/* Low confidence note */}
          {flight.confidence < LOW_CONFIDENCE_THRESHOLD && (
            <div className="flex items-center gap-2 text-sm text-warning-foreground bg-warning/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t('import.review.lowConfidence', 'Some fields may need verification')}</span>
            </div>
          )}

          {/* Edit grid - clean columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('flights.date', 'Date')}
              </Label>
              <DateInput
                value={flight.date}
                onChange={(value) => handleFieldChange('date', value)}
                className={cn(
                  "h-9",
                  isLowConfidence('date') && "border-warning ring-1 ring-warning/20"
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
              <Label className="text-xs text-muted-foreground">
                {t('flights.airline', 'Airline')}
              </Label>
              <AirlineAutocomplete
                value={flight.airline_iata}
                onChange={(iata) => handleFieldChange('airline_iata', iata)}
              />
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
