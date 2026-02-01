import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AirportAutocomplete } from './AirportAutocomplete'
import { AirlineAutocomplete } from './AirlineAutocomplete'
import { AircraftAutocomplete } from './AircraftAutocomplete'
import { useCreateFlight, useUpdateFlight, useCheckDuplicate, type Flight } from '@/hooks/useFlights'
import { findAirport, findAircraft } from '@kuuki/data'
import { calculateFlightDistance, estimateFlightDuration, isUpcomingFlight, daysUntilFlight } from '@/lib/geo'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, ChevronRight, Plane, Calendar } from 'lucide-react'

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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 lg:px-8 lg:pt-8 xl:px-10 xl:pt-10">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plane className="w-5 h-5 text-primary" />
            {isEditing ? t('flights.editFlight', 'Edit Flight') : t('flights.addFlight', 'Add Flight')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 lg:px-8 lg:pb-8 xl:px-10 xl:pb-10">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm text-warning">
                {t('flights.duplicateWarning', 'You already have a flight on this date with the same route. You can still save it.')}
              </p>
            </div>
          )}

          {/* Future flight notice */}
          {isFutureFlight && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-primary">
                {t('flights.upcomingFlight', { days: daysUntil })}
              </p>
            </div>
          )}

          {/* Required fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                {t('flights.date', 'Date')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-90' : ''}`}
            />
            {showOptional
              ? t('flights.hideDetails', 'Hide details')
              : t('flights.addDetails', 'Add more details')}
          </button>

          {/* Optional fields */}
          {showOptional && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <AircraftAutocomplete
                  id="aircraft"
                  value={aircraftIcao}
                  onChange={(icao) => setAircraftIcao(icao)}
                  label={t('flights.aircraft', 'Aircraft')}
                  placeholder="B738"
                  disabled={isSubmitting}
                />

                <div className="space-y-2">
                  <Label htmlFor="flightNumber">
                    {t('flights.flightNumber', 'Flight Number')}
                  </Label>
                  <Input
                    id="flightNumber"
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    placeholder="AA123"
                    disabled={isSubmitting}
                    className="font-mono uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="departureTime">
                      {t('flights.departureTime', 'Departure')}
                    </Label>
                    <Input
                      id="departureTime"
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arrivalTime">
                      {t('flights.arrivalTime', 'Arrival')}
                    </Label>
                    <Input
                      id="arrivalTime"
                      type="time"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? t('common.loading') : isEditing ? t('common.save') : t('flights.addFlight', 'Add Flight')}
            </Button>
          </div>

          {/* Keyboard hint */}
          <p className="mt-3 text-xs text-center text-muted-foreground">
            {t('flights.keyboardHint', 'Press Ctrl+S to save, Esc to close')}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
