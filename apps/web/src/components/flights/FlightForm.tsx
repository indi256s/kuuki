import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AirportAutocomplete } from './AirportAutocomplete'
import { AirlineAutocomplete } from './AirlineAutocomplete'
import { AircraftPicker } from './AircraftPicker'
import { useCreateFlight, useUpdateFlight, useCheckDuplicate, type Flight } from '@/hooks/useFlights'
import { useIsMobile } from '@/hooks/useIsMobile'
import { findAirport, findAircraft } from '@kuuki/data'
import { calculateFlightDistance, estimateFlightDuration, isUpcomingFlight, daysUntilFlight } from '@/lib/geo'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, ChevronRight, Plane, Clock, Trash2 } from 'lucide-react'

const flightSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  origin: z.string().length(3, 'Must be 3-letter IATA code'),
  destination: z.string().length(3, 'Must be 3-letter IATA code'),
  airlineIata: z.string().min(2, 'Airline is required'),
  aircraftIcao: z.string().optional(),
  flightNumber: z.string().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
}).refine((data) => data.origin !== data.destination, {
  message: 'Origin and destination cannot be the same',
  path: ['destination'],
})

type FlightFormData = z.infer<typeof flightSchema>

interface FlightFormProps {
  isOpen: boolean
  onClose: () => void
  editFlight?: Flight | null
  onDelete?: (flight: Flight) => void
}

export function FlightForm({ isOpen, onClose, editFlight, onDelete }: FlightFormProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const createFlight = useCreateFlight()
  const updateFlight = useUpdateFlight()
  const checkDuplicate = useCheckDuplicate()

  // UI state
  const [showOptional, setShowOptional] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const isEditing = !!editFlight

  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      origin: '',
      destination: '',
      airlineIata: '',
      aircraftIcao: '',
      flightNumber: '',
      departureTime: '',
      arrivalTime: '',
    },
  })

  // Reset form when opened/closed or edit flight changes
  useEffect(() => {
    if (isOpen) {
      if (editFlight) {
        form.reset({
          date: editFlight.date,
          origin: editFlight.origin,
          destination: editFlight.destination,
          airlineIata: editFlight.airline_iata || '',
          aircraftIcao: editFlight.aircraft_icao || '',
          flightNumber: editFlight.flight_number || '',
          departureTime: editFlight.departure_time || '',
          arrivalTime: editFlight.arrival_time || '',
        })
        setShowOptional(!!(editFlight.aircraft_icao || editFlight.flight_number || editFlight.departure_time || editFlight.arrival_time))
      } else {
        form.reset({
          date: new Date().toISOString().split('T')[0],
          origin: '',
          destination: '',
          airlineIata: '',
          aircraftIcao: '',
          flightNumber: '',
          departureTime: '',
          arrivalTime: '',
        })
        setShowOptional(false)
      }
      form.clearErrors()
      setDuplicateWarning(false)
    }
  }, [isOpen, editFlight, form])

  // Watch for route changes to check duplicates
  const watchDate = form.watch('date')
  const watchOrigin = form.watch('origin')
  const watchDestination = form.watch('destination')

  // Use ref to avoid including the mutation object in the dependency array
  // (useMutation returns a new object reference on every state change, causing infinite loops)
  const checkDuplicateRef = useRef(checkDuplicate)
  checkDuplicateRef.current = checkDuplicate

  useEffect(() => {
    if (watchDate && watchOrigin && watchDestination && watchOrigin.length === 3 && watchDestination.length === 3) {
      // Debounce to avoid firing while user is still typing
      const timer = setTimeout(() => {
        checkDuplicateRef.current.mutate(
          { date: watchDate, origin: watchOrigin, destination: watchDestination, excludeId: editFlight?.id },
          {
            onSuccess: (isDuplicate) => {
              setDuplicateWarning(isDuplicate)
            },
          }
        )
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setDuplicateWarning(false)
    }
  }, [watchDate, watchOrigin, watchDestination, editFlight?.id])

  const onSubmit = useCallback(async (data: FlightFormData) => {
    form.clearErrors('root')

    // Calculate distance and duration
    const originAirport = findAirport(data.origin)
    const destAirport = findAirport(data.destination)
    const aircraft = data.aircraftIcao ? findAircraft(data.aircraftIcao) : null

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
      if (!data.departureTime || !data.arrivalTime) {
        durationMinutes = estimateFlightDuration(distanceKm, aircraft?.type)
      }
    }

    // Calculate actual duration from times if provided
    if (data.departureTime && data.arrivalTime) {
      const depParts = data.departureTime.split(':').map(Number)
      const arrParts = data.arrivalTime.split(':').map(Number)
      const depMinutes = depParts[0] * 60 + depParts[1]
      let arrMinutes = arrParts[0] * 60 + arrParts[1]

      // Handle overnight flights
      if (arrMinutes < depMinutes) {
        arrMinutes += 24 * 60
      }

      durationMinutes = arrMinutes - depMinutes
    }

    const flightData = {
      date: data.date,
      origin: data.origin.toUpperCase(),
      destination: data.destination.toUpperCase(),
      airline_iata: data.airlineIata.toUpperCase(),
      aircraft_icao: data.aircraftIcao || null,
      flight_number: data.flightNumber || null,
      departure_time: data.departureTime || null,
      arrival_time: data.arrivalTime || null,
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
      form.setError('root', {
        message: err instanceof Error ? err.message : t('errors.generic'),
      })
    }
  }, [form, t, isEditing, editFlight, updateFlight, createFlight, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        form.handleSubmit(onSubmit)()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, form, onSubmit])


  const isSubmitting = createFlight.isPending || updateFlight.isPending
  const isFutureFlight = watchDate && isUpcomingFlight(watchDate)
  const daysUntil = watchDate && isFutureFlight ? daysUntilFlight(watchDate) : 0

  // Shared form content rendered in both Sheet and Dialog
  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 xl:px-10 xl:pb-10">
        {/* Error display */}
        {form.formState.errors.root && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
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
          <div className="mb-4 p-3 rounded-lg bg-info/10 border border-info/20 flex items-center gap-2">
            <Clock className="w-4 h-4 text-info shrink-0" aria-hidden="true" />
            <p className="text-sm text-info">
              {t('flights.upcomingFlight', { days: daysUntil })}
            </p>
          </div>
        )}

        {/* Route section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
            {t('flights.routeSection', 'Route')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <AirportAutocomplete
                    id="origin"
                    value={field.value}
                    onChange={field.onChange}
                    label={t('flights.origin', 'From')}
                    placeholder="JFK"
                    required
                    disabled={isSubmitting}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <AirportAutocomplete
                    id="destination"
                    value={field.value}
                    onChange={field.onChange}
                    label={t('flights.destination', 'To')}
                    placeholder="LAX"
                    required
                    disabled={isSubmitting}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator className="my-5" />

        {/* Flight details section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
            {t('flights.detailsSection', 'Flight Details')}
          </h3>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('flights.date', 'Date')}
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="airlineIata"
            render={({ field }) => (
              <FormItem>
                <AirlineAutocomplete
                  id="airline"
                  value={field.value}
                  onChange={field.onChange}
                  label={t('flights.airline', 'Airline')}
                  placeholder="AA"
                  required
                  disabled={isSubmitting}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Optional fields toggle */}
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={showOptional}
          aria-label={showOptional
            ? t('flights.hideDetails', 'Hide details')
            : t('flights.addDetails', 'Add more details')}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          {showOptional
            ? t('flights.hideDetails', 'Hide details')
            : t('flights.addDetails', 'Add more details')}
        </button>

        {/* Optional fields - Aircraft & Times */}
        {showOptional && (
          <>
            <Separator className="my-5" />
            <div className="space-y-4">
              <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                {t('flights.aircraftSection', 'Aircraft & Times')}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="aircraftIcao"
                  render={({ field }) => (
                    <FormItem>
                      <AircraftPicker
                        id="aircraft"
                        value={field.value || ''}
                        onChange={field.onChange}
                        label={t('flights.aircraft', 'Aircraft')}
                        placeholder={t('flights.selectAircraft', 'Select aircraft...')}
                        disabled={isSubmitting}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flightNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('flights.flightNumber', 'Flight #')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123"
                          disabled={isSubmitting}
                          className="font-mono uppercase"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="departureTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('flights.departureTime', 'Departure')}
                      </FormLabel>
                      <FormControl>
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          onClear={() => field.onChange('')}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arrivalTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('flights.arrivalTime', 'Arrival')}
                      </FormLabel>
                      <FormControl>
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          onClear={() => field.onChange('')}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

        {/* Keyboard hint - hide on mobile */}
        <p className="mt-3 text-xs text-center text-muted-foreground hidden sm:block">
          {t('flights.keyboardHint', 'Press Ctrl+S to save, Esc to close')}
        </p>
      </form>
    </Form>
  )

  const title = (
    <span className="flex items-center gap-2 text-lg">
      <Plane className="w-5 h-5 text-primary" aria-hidden="true" />
      {isEditing ? t('flights.editFlight', 'Edit Flight') : t('flights.addFlight', 'Add Flight')}
    </span>
  )

  const deleteButton = isEditing && editFlight && onDelete && (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => onDelete(editFlight)}
      disabled={isSubmitting}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      aria-label={t('flights.deleteFlight', 'Delete Flight')}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )

  // Mobile: Bottom sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" showCloseButton={false}>
          <SheetHeader className="px-4 pt-2 pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle>{title}</SheetTitle>
              {deleteButton}
            </div>
          </SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 lg:px-8 lg:pt-8 xl:px-10 xl:pt-10">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {deleteButton}
          </div>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
