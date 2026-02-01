import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { findAirport, findAirline } from '@kuuki/data'
import { AirportAutocomplete } from '../flights/AirportAutocomplete'
import { AirlineAutocomplete } from '../flights/AirlineAutocomplete'
import { AircraftAutocomplete } from '../flights/AircraftAutocomplete'
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

  const lowConfidenceClass = 'border-holding ring-1 ring-holding/30'

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
    <div className={`border rounded-lg transition-colors ${
      selected ? 'border-runway bg-runway-muted/30' : 'border-edge-strong bg-sky-raised'
    }`}>
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 rounded border-edge-strong text-runway focus:ring-runway"
          />

          {/* Row number */}
          <span className="text-xs text-ink-muted w-5">#{index + 1}</span>

          {/* Date */}
          <input
            type="date"
            value={flight.date}
            onChange={(e) => handleFieldChange('date', e.target.value)}
            className={`w-32 px-2 py-1 text-sm border rounded bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway ${
              isLowConfidence('date') ? lowConfidenceClass : 'border-edge-strong'
            }`}
          />

          {/* Route display */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`font-mono font-medium text-sm px-1.5 py-0.5 rounded ${
              isLowConfidence('origin') ? 'bg-holding-muted text-holding' : 'bg-sky-sunken'
            }`}>
              {flight.origin || '???'}
            </span>
            <svg className="w-4 h-4 text-ink-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className={`font-mono font-medium text-sm px-1.5 py-0.5 rounded ${
              isLowConfidence('destination') ? 'bg-holding-muted text-holding' : 'bg-sky-sunken'
            }`}>
              {flight.destination || '???'}
            </span>
          </div>

          {/* Airline */}
          <span className={`font-mono text-sm px-1.5 py-0.5 rounded ${
            isLowConfidence('airline_iata') ? 'bg-holding-muted text-holding' : 'bg-sky-sunken'
          }`}>
            {flight.airline_iata || '??'}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {isDuplicate && (
              <span className="px-2 py-0.5 text-xs font-medium bg-holding-muted text-holding rounded-full">
                {t('import.review.duplicate', 'Duplicate')}
              </span>
            )}
            {!isValid && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emergency-muted text-emergency rounded-full">
                {t('import.review.invalid', 'Invalid')}
              </span>
            )}
          </div>

          {/* Expand button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-sky-sunken transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-emergency-muted text-ink-muted hover:text-emergency transition-colors"
            aria-label="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary line */}
        <div className="mt-1.5 ml-12 text-xs text-ink-muted truncate">
          {originAirport ? `${originAirport.city}` : flight.origin}
          {' → '}
          {destAirport ? `${destAirport.city}` : flight.destination}
          {airline && ` · ${airline.name}`}
          {flight.flight_number && ` ${flight.airline_iata}${flight.flight_number}`}
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-edge px-3 py-4 space-y-4 bg-sky-sunken/30">
          {/* Low confidence warning */}
          {flight.confidence < LOW_CONFIDENCE_THRESHOLD && (
            <div className="flex items-center gap-2 text-xs text-holding bg-holding-muted px-3 py-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{t('import.review.lowConfidence', 'Some fields may need verification')}</span>
            </div>
          )}

          {/* Row 1: Date and Route */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.date', 'Date')}
              </label>
              <input
                type="date"
                value={flight.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway ${
                  isLowConfidence('date') ? lowConfidenceClass : 'border-edge-strong'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.origin', 'From')}
              </label>
              <AirportAutocomplete
                value={flight.origin}
                onChange={(iata) => handleFieldChange('origin', iata)}
                error={isLowConfidence('origin') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.destination', 'To')}
              </label>
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.airline', 'Airline')}
              </label>
              <AirlineAutocomplete
                value={flight.airline_iata}
                onChange={(iata) => handleFieldChange('airline_iata', iata)}
                error={isLowConfidence('airline_iata') ? t('import.review.verify', 'Verify') : undefined}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.flightNumber', 'Flight Number')}
              </label>
              <input
                type="text"
                value={flight.flight_number || ''}
                onChange={(e) => handleFieldChange('flight_number', e.target.value)}
                placeholder="123"
                className={`w-full px-3 py-2 border rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway font-mono ${
                  isLowConfidence('flight_number') ? lowConfidenceClass : 'border-edge-strong'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.aircraft', 'Aircraft')}
              </label>
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.departureTime', 'Departure')}
              </label>
              <input
                type="time"
                value={flight.departure_time || ''}
                onChange={(e) => handleFieldChange('departure_time', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway ${
                  isLowConfidence('departure_time') ? lowConfidenceClass : 'border-edge-strong'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t('flights.arrivalTime', 'Arrival')}
              </label>
              <input
                type="time"
                value={flight.arrival_time || ''}
                onChange={(e) => handleFieldChange('arrival_time', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway ${
                  isLowConfidence('arrival_time') ? lowConfidenceClass : 'border-edge-strong'
                }`}
              />
            </div>

            {/* Confidence display */}
            <div className="sm:col-span-2 flex items-end">
              <div className="text-xs text-ink-muted">
                <span className="font-medium">{t('import.review.confidence', 'Confidence')}:</span>{' '}
                <span className={flight.confidence >= 0.8 ? 'text-cleared' : 'text-holding'}>
                  {Math.round(flight.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
