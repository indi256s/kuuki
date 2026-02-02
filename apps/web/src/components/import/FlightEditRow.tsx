import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { findAirport, findAirline } from '@kuuki/data'
import { AirportAutocomplete } from '../flights/AirportAutocomplete'
import { AirlineAutocomplete } from '../flights/AirlineAutocomplete'
import { AircraftAutocomplete } from '../flights/AircraftAutocomplete'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronDown, X, ArrowRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedFlight } from '../../hooks/useImport'

interface FlightEditRowProps {
  flight: ExtractedFlight
  index: number
  selected: boolean
  isDuplicate?: boolean
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

  const lowConfidenceClass = 'border-yellow-500 ring-1 ring-yellow-500/30'

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

  return (
    <Card className={cn(
      'transition-colors',
      selected ? 'border-primary bg-primary/5' : 'border-border/50'
    )}>
      {/* Compact view */}
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />

          {/* Row number */}
          <span className="text-xs text-muted-foreground w-5">#{index + 1}</span>

          {/* Date */}
          <Input
            type="date"
            value={flight.date}
            onChange={(e) => handleFieldChange('date', e.target.value)}
            className={cn(
              'w-32 h-8 text-sm',
              isLowConfidence('date') && lowConfidenceClass
            )}
          />

          {/* Route display */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={cn(
              'font-data font-medium text-sm px-1.5 py-0.5 rounded',
              isLowConfidence('origin') ? 'bg-warning/20 text-warning-foreground' : 'bg-muted'
            )}>
              {flight.origin || '???'}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className={cn(
              'font-data font-medium text-sm px-1.5 py-0.5 rounded',
              isLowConfidence('destination') ? 'bg-warning/20 text-warning-foreground' : 'bg-muted'
            )}>
              {flight.destination || '???'}
            </span>
          </div>

          {/* Airline */}
          <span className={cn(
            'font-data text-sm px-1.5 py-0.5 rounded',
            isLowConfidence('airline_iata') ? 'bg-warning/20 text-warning-foreground' : 'bg-muted'
          )}>
            {flight.airline_iata || '??'}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {isDuplicate && (
              <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
                {t('import.review.duplicate', 'Duplicate')}
              </Badge>
            )}
            {!isValid && (
              <Badge variant="destructive">
                {t('import.review.invalid', 'Invalid')}
              </Badge>
            )}
          </div>

          {/* Expand button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Summary line */}
        <div className="mt-1.5 ml-12 text-xs text-muted-foreground truncate">
          {originAirport ? `${originAirport.city}` : flight.origin}
          {' → '}
          {destAirport ? `${destAirport.city}` : flight.destination}
          {airline && ` · ${airline.name}`}
          {flight.flight_number && ` ${flight.airline_iata}${flight.flight_number}`}
        </div>
      </CardContent>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-border px-3 py-4 space-y-4 bg-muted/30">
          {/* Low confidence warning */}
          {flight.confidence < LOW_CONFIDENCE_THRESHOLD && (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <AlertDescription className="text-warning-foreground">
                {t('import.review.lowConfidence', 'Some fields may need verification')}
              </AlertDescription>
            </Alert>
          )}

          {/* Row 1: Date and Route */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1">
                {t('flights.date', 'Date')}
              </Label>
              <Input
                type="date"
                value={flight.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className={cn(isLowConfidence('date') && lowConfidenceClass)}
              />
            </div>

            <div>
              <Label className="text-xs mb-1">
                {t('flights.origin', 'From')}
              </Label>
              <AirportAutocomplete
                value={flight.origin}
                onChange={(iata) => handleFieldChange('origin', iata)}
                error={isLowConfidence('origin') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>

            <div>
              <Label className="text-xs mb-1">
                {t('flights.destination', 'To')}
              </Label>
              <AirportAutocomplete
                value={flight.destination}
                onChange={(iata) => handleFieldChange('destination', iata)}
                error={isLowConfidence('destination') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>
          </div>

          {/* Row 2: Airline and Aircraft */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1">
                {t('flights.airline', 'Airline')}
              </Label>
              <AirlineAutocomplete
                value={flight.airline_iata}
                onChange={(iata) => handleFieldChange('airline_iata', iata)}
                error={isLowConfidence('airline_iata') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>

            <div>
              <Label className="text-xs mb-1">
                {t('flights.flightNumber', 'Flight Number')}
              </Label>
              <Input
                type="text"
                value={flight.flight_number || ''}
                onChange={(e) => handleFieldChange('flight_number', e.target.value)}
                placeholder="123"
                className={cn('font-data', isLowConfidence('flight_number') && lowConfidenceClass)}
              />
            </div>

            <div>
              <Label className="text-xs mb-1">
                {t('flights.aircraft', 'Aircraft')}
              </Label>
              <AircraftAutocomplete
                value={flight.aircraft_icao || ''}
                onChange={(icao) => handleFieldChange('aircraft_icao', icao)}
                error={isLowConfidence('aircraft_icao') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>
          </div>

          {/* Row 3: Times */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1">
                {t('flights.departureTime', 'Departure')}
              </Label>
              <Input
                type="time"
                value={flight.departure_time || ''}
                onChange={(e) => handleFieldChange('departure_time', e.target.value)}
                className={cn(isLowConfidence('departure_time') && lowConfidenceClass)}
              />
            </div>

            <div>
              <Label className="text-xs mb-1">
                {t('flights.arrivalTime', 'Arrival')}
              </Label>
              <Input
                type="time"
                value={flight.arrival_time || ''}
                onChange={(e) => handleFieldChange('arrival_time', e.target.value)}
                className={cn(isLowConfidence('arrival_time') && lowConfidenceClass)}
              />
            </div>

            {/* Confidence display */}
            <div className="sm:col-span-2 flex items-end">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{t('import.review.confidence', 'Confidence')}:</span>{' '}
                <span className={flight.confidence >= 0.8 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                  {Math.round(flight.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
