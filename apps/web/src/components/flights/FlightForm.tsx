import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AirportAutocomplete } from './AirportAutocomplete'
import { AirlineAutocomplete } from './AirlineAutocomplete'
import { AircraftAutocomplete } from './AircraftAutocomplete'
import { useCreateFlight, useUpdateFlight, useCheckDuplicate, type Flight } from '@/hooks/useFlights'
import { findAirport, findAircraft } from '@kuuki/data'
import { calculateFlightDistance, estimateFlightDuration, isUpcomingFlight, daysUntilFlight } from '@/lib/geo'

interface FlightFormProps {
  isOpen: boolean
  onClose: () => void
  editFlight?: Flight | null
}

export function FlightForm({ isOpen, onClose, editFlight }: FlightFormProps) {
  const { t } = useTranslation()
  const createFlight = useCreateFlight()
  const updateFlight = useUpdateFlight()
  const checkDuplicate = useCheckDuplicate()

  // Form state
  const [date, setDate] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [airlineIata, setAirlineIata] = useState('')
  const [aircraftIcao, setAircraftIcao] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')

  // UI state
  const [showOptional, setShowOptional] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!editFlight

  // Reset form when opened/closed or edit flight changes
  useEffect(() => {
    if (isOpen) {
      if (editFlight) {
        setDate(editFlight.date)
        setOrigin(editFlight.origin)
        setDestination(editFlight.destination)
        setAirlineIata(editFlight.airline_iata || '')
        setAircraftIcao(editFlight.aircraft_icao || '')
        setFlightNumber(editFlight.flight_number || '')
        setDepartureTime(editFlight.departure_time || '')
        setArrivalTime(editFlight.arrival_time || '')
        setShowOptional(!!(editFlight.aircraft_icao || editFlight.flight_number || editFlight.departure_time || editFlight.arrival_time))
      } else {
        // Reset for new flight
        setDate(new Date().toISOString().split('T')[0])
        setOrigin('')
        setDestination('')
        setAirlineIata('')
        setAircraftIcao('')
        setFlightNumber('')
        setDepartureTime('')
        setArrivalTime('')
        setShowOptional(false)
      }
      setError(null)
      setDuplicateWarning(false)
    }
  }, [isOpen, editFlight])

  // Check for duplicates when route changes
  useEffect(() => {
    if (date && origin && destination && origin.length === 3 && destination.length === 3) {
      checkDuplicate.mutate(
        { date, origin, destination, excludeId: editFlight?.id },
        {
          onSuccess: (isDuplicate) => {
            setDuplicateWarning(isDuplicate)
          },
        }
      )
    } else {
      setDuplicateWarning(false)
    }
  }, [date, origin, destination, editFlight?.id])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit(new Event('submit') as unknown as React.FormEvent)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!date || !origin || !destination || !airlineIata) {
      setError(t('flights.requiredFields', 'Please fill in all required fields'))
      return
    }

    if (origin.length !== 3 || destination.length !== 3) {
      setError(t('flights.invalidAirportCode', 'Airport codes must be 3 letters'))
      return
    }

    if (origin === destination) {
      setError(t('flights.sameAirport', 'Origin and destination cannot be the same'))
      return
    }

    // Calculate distance and duration
    const originAirport = findAirport(origin)
    const destAirport = findAirport(destination)
    const aircraft = aircraftIcao ? findAircraft(aircraftIcao) : null

    let distanceKm: number | null = null
    let durationMinutes: number | null = null

    if (originAirport && destAirport) {
      distanceKm = calculateFlightDistance(
        originAirport.latitude,
        originAirport.longitude,
        destAirport.latitude,
        destAirport.longitude
      )

      // Estimate duration if times not provided
      if (!departureTime || !arrivalTime) {
        durationMinutes = estimateFlightDuration(distanceKm, aircraft?.type)
      }
    }

    // Calculate actual duration from times if provided
    if (departureTime && arrivalTime) {
      const depParts = departureTime.split(':').map(Number)
      const arrParts = arrivalTime.split(':').map(Number)
      const depMinutes = depParts[0] * 60 + depParts[1]
      let arrMinutes = arrParts[0] * 60 + arrParts[1]

      // Handle overnight flights
      if (arrMinutes < depMinutes) {
        arrMinutes += 24 * 60
      }

      durationMinutes = arrMinutes - depMinutes
    }

    const flightData = {
      date,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      airline_iata: airlineIata.toUpperCase(),
      aircraft_icao: aircraftIcao || null,
      flight_number: flightNumber || null,
      departure_time: departureTime || null,
      arrival_time: arrivalTime || null,
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      origin_tz: originAirport?.timezone || null,
      dest_tz: destAirport?.timezone || null,
    }

    try {
      if (isEditing && editFlight) {
        await updateFlight.mutateAsync({
          flightId: editFlight.id,
          updates: flightData,
        })
      } else {
        await createFlight.mutateAsync(flightData)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'))
    }
  }

  const isSubmitting = createFlight.isPending || updateFlight.isPending
  const isFutureFlight = date && isUpcomingFlight(date)
  const daysUntil = date && isFutureFlight ? daysUntilFlight(date) : 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-sky w-full max-w-md mx-4 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-sky px-6 py-4 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {isEditing ? t('flights.editFlight', 'Edit Flight') : t('flights.addFlight', 'Add Flight')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-emergency-muted text-emergency rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="p-3 bg-caution-muted text-caution rounded-lg text-sm">
              {t('flights.duplicateWarning', 'You already have a flight on this date with the same route. You can still save it.')}
            </div>
          )}

          {/* Future flight notice */}
          {isFutureFlight && (
            <div className="p-3 bg-runway/10 text-runway rounded-lg text-sm">
              {t('flights.upcomingFlight', { days: daysUntil })}
            </div>
          )}

          {/* Required fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-ink mb-1">
                {t('flights.date', 'Date')}
                <span className="text-emergency ml-1">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AirportAutocomplete
                id="origin"
                value={origin}
                onChange={(iata) => setOrigin(iata)}
                label={t('flights.origin', 'From')}
                placeholder="JFK"
                required
                disabled={isSubmitting}
              />

              <AirportAutocomplete
                id="destination"
                value={destination}
                onChange={(iata) => setDestination(iata)}
                label={t('flights.destination', 'To')}
                placeholder="LAX"
                required
                disabled={isSubmitting}
              />
            </div>

            <AirlineAutocomplete
              id="airline"
              value={airlineIata}
              onChange={(iata) => setAirlineIata(iata)}
              label={t('flights.airline', 'Airline')}
              placeholder="AA"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Optional fields toggle */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="flex items-center gap-2 text-sm text-runway hover:underline"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showOptional
              ? t('flights.hideDetails', 'Hide details')
              : t('flights.addDetails', 'Add more details')}
          </button>

          {/* Optional fields */}
          {showOptional && (
            <div className="space-y-4 pt-2 border-t border-edge">
              <AircraftAutocomplete
                id="aircraft"
                value={aircraftIcao}
                onChange={(icao) => setAircraftIcao(icao)}
                label={t('flights.aircraft', 'Aircraft')}
                placeholder="B738"
                disabled={isSubmitting}
              />

              <div>
                <label htmlFor="flightNumber" className="block text-sm font-medium text-ink mb-1">
                  {t('flights.flightNumber', 'Flight Number')}
                </label>
                <input
                  id="flightNumber"
                  type="text"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                  placeholder="AA123"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway font-mono text-sm uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="departureTime" className="block text-sm font-medium text-ink mb-1">
                    {t('flights.departureTime', 'Departure')}
                  </label>
                  <input
                    id="departureTime"
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
                  />
                </div>

                <div>
                  <label htmlFor="arrivalTime" className="block text-sm font-medium text-ink mb-1">
                    {t('flights.arrivalTime', 'Arrival')}
                  </label>
                  <input
                    id="arrivalTime"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 border border-edge-strong text-ink font-medium rounded-lg hover:bg-sky-raised disabled:opacity-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? t('common.loading') : isEditing ? t('common.save') : t('flights.addFlight', 'Add Flight')}
            </button>
          </div>

          {/* Keyboard hint */}
          <p className="text-xs text-ink-muted text-center">
            {t('flights.keyboardHint', 'Press Ctrl+S to save, Esc to close')}
          </p>
        </form>
      </div>
    </div>
  )
}
