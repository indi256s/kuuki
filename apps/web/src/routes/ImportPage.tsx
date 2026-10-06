import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { type FlightInsert } from '@/hooks/useFlights'
import { useParseImport, type ExtractedFlight, type RejectedFlight } from '@/hooks/useImport'
import { useToast } from '@/hooks/useToast'
import { AppHeader } from '@/components/common/AppHeader'
import { AppPageShell } from '@/components/layout/AppPageShell'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { ImportUpload } from '@/components/import/ImportUpload'
import { ImportReview } from '@/components/import/ImportReview'
import { FlightProgressModal } from '@/components/import/FlightProgressModal'
import { FlightForm } from '@/components/flights/FlightForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { findAirport, findAircraft } from '@kuuki/data'
import { calculateFlightDistance, calculateFlightDuration, estimateFlightDuration } from '@kuuki/client/geo'
import { getMessageKeyForCategory } from '@/lib/errors'
import { Check, Plane, ArrowRight, AlertCircle, X, AlertTriangle } from 'lucide-react'
import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import { useCountUp } from '@/hooks/useCountUp'
import { abandonFlightCreateOperation, currentFlightOperationId, pendingFlightCreateOperation, pendingImportFlightOperations, rotateFlightOperationId } from '@kuuki/client/flightCreateOperations'
import { useAuthStore } from '@/stores/authStore'
import { createFlights } from '@kuuki/client/flights'
import { reconcileDerivedState } from '@/lib/derivedStateFeedback'
import { allowedLegacyReturn, returnAfterLegacyWrite } from '@/lib/legacyBridge'

type ImportStep = 'upload' | 'parsing' | 'review' | 'saving' | 'success'
type InputType = 'text' | 'pdf' | 'image'
type CreateInput = Omit<FlightInsert, 'id' | 'created_at' | 'user_id'>
type FailedFlight = { flight: ExtractedFlight; operationId: string; error: string; retryKey?: string; originalInput?: CreateInput; expired?: boolean }

const flightLabel = (flight: ExtractedFlight) => `${flight.origin} → ${flight.destination} (${flight.date})`

function buildCreateInput(flight: ExtractedFlight): CreateInput {
  // Look up airport coordinates for distance calculation
  const originAirport = findAirport(flight.origin)
  const destAirport = findAirport(flight.destination)
  const aircraft = flight.aircraft_icao ? findAircraft(flight.aircraft_icao) : null

  let distanceKm: number | undefined
  let durationMinutes: number | undefined

  if (originAirport && destAirport) {
    distanceKm = calculateFlightDistance(
      originAirport.latitude,
      originAirport.longitude,
      destAirport.latitude,
      destAirport.longitude
    )

    // Use actual times if available (timezone-aware), otherwise estimate
    if (flight.departure_time && flight.arrival_time) {
      durationMinutes = calculateFlightDuration(
        flight.departure_time,
        flight.arrival_time,
        flight.date,
        originAirport.timezone,
        destAirport.timezone
      ) ?? undefined
    }
    if (!durationMinutes) {
      durationMinutes = estimateFlightDuration(distanceKm, aircraft?.type)
    }
  }

  return {
    date: flight.date,
    origin: flight.origin,
    destination: flight.destination,
    airline_iata: flight.airline_iata,
    flight_number: flight.flight_number || null,
    aircraft_icao: flight.aircraft_icao || null,
    departure_time: flight.departure_time || null,
    arrival_time: flight.arrival_time || null,
    distance_km: distanceKm ?? null,
    duration_minutes: durationMinutes ?? null,
    origin_tz: originAirport?.timezone || null,
    dest_tz: destAirport?.timezone || null,
    source: 'ai_import',
    // Pass enrichment status from parse result (or default based on aircraft presence)
    enrichment_status: flight.enrichment_status || (flight.aircraft_icao ? 'skipped' : 'pending'),
  }
}

export function ImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useAuthStore((state) => state.user?.id)
  const importRunId = useRef(currentFlightOperationId('import'))
  const recoveryCheckedFor = useRef<string | null>(null)
  const [failedFlights, setFailedFlights] = useState<FailedFlight[]>([])

  // Text content handed over from EmptyState
  const initialTextContent = (location.state as { textContent?: string } | null)?.textContent

  const [step, setStep] = useState<ImportStep>('upload')
  const [inputType, setInputType] = useState<InputType>('text')
  const [extractedFlights, setExtractedFlights] = useState<ExtractedFlight[]>([])
  const [rejectedFlights, setRejectedFlights] = useState<RejectedFlight[]>([])
  const [geminiCount, setGeminiCount] = useState<number | undefined>()
  const [savedCount, setSavedCount] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [pendingFlights, setPendingFlights] = useState<ExtractedFlight[] | undefined>()

  // Animated count for success screen - only animates when step becomes 'success'
  const animatedSavedCount = useCountUp(step === 'success' ? savedCount : 0, 800)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || recoveryCheckedFor.current === userId) return
    recoveryCheckedFor.current = userId
    const recovered: FailedFlight[] = pendingImportFlightOperations(userId).map(({ operationId, body, expired, key }) => {
      const input = body as CreateInput
      return {
        operationId,
        originalInput: input,
        retryKey: key,
        expired,
        error: expired
          ? t('import.success.expired', 'This save is too old to retry safely. Check your flights before starting a new import.')
          : t('import.success.unconfirmed', 'Save status unconfirmed. Retry the original request.'),
        flight: {
          date: input.date ?? '', origin: input.origin ?? '', destination: input.destination ?? '',
          airline_iata: input.airline_iata ?? '', flight_number: input.flight_number ?? undefined,
          aircraft_icao: input.aircraft_icao ?? undefined, departure_time: input.departure_time ?? undefined,
          arrival_time: input.arrival_time ?? undefined, confidence: 1,
        },
      }
    })
    if (recovered.length === 0) return
    setFailedFlights(recovered)
    setStep('success')
  }, [userId, t])

  const parseMutation = useParseImport()
  const queryClient = useQueryClient()
  const { showError } = useToast()

  // Handle initial state: text content from EmptyState
  useEffect(() => {
    if (userId && pendingImportFlightOperations(userId).length > 0) return
    // Auto-submit text content from EmptyState
    if (initialTextContent && step === 'upload') {
      handleUploadSubmit({ type: 'text', content: initialTextContent })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadSubmit = useCallback(async (data: { type: 'pdf' | 'image' | 'text'; content: string }) => {
    setInputType(data.type)
    setStep('parsing')
    setParseError(null) // Clear any previous error

    try {
      const result = await parseMutation.mutateAsync(data)
      setExtractedFlights(result.flights)
      setRejectedFlights(result.rejected || [])
      setGeminiCount(result.gemini_count)

      // If flights found, pass them to modal for reveal animation before transitioning
      if (result.flights.length > 0) {
        setPendingFlights(result.flights)
        // Stay on step='parsing' — modal will call onRevealComplete to transition
      } else {
        setStep('review')
      }
    } catch (error) {
      console.error('Parse error:', error)

      // Determine error type for inline display
      const errorMessage = error instanceof Error ? error.message : ''
      let errorKey = getMessageKeyForCategory('import')

      // Check for specific error types
      if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
        errorKey = 'errors.import.timeout'
      } else if (errorMessage.includes('format') || errorMessage.includes('Invalid')) {
        errorKey = 'errors.import.invalidFormat'
      }

      setParseError(errorKey)
      setExtractedFlights([])
      setRejectedFlights([])
      setGeminiCount(undefined)
      setStep('review')
    }
  }, [parseMutation])

  const handleSaveFlights = useCallback(async (flights: ExtractedFlight[], retryEntries?: FailedFlight[]) => {
    setStep('saving')
    setSavedCount(0)
    setFailedFlights([])

    let successCount = 0
    const failedForRetry: FailedFlight[] = []
    const operationIds = flights.map((_, i) => retryEntries?.[i]?.operationId ?? `${importRunId.current}:${i}`)
    const errors: Array<Error | null> = flights.map(() => null)
    const entries: Array<{ index: number; operationId: string; flight: CreateInput; retryKey?: string }> = []

    flights.forEach((flight, i) => {
      const originalInput = retryEntries?.[i]?.originalInput
      if (flight.field_confidence?.date_year_explicit === false && !originalInput) {
        errors[i] = new Error('Confirm the inferred year before saving')
        return
      }
      entries.push({ index: i, operationId: operationIds[i], flight: originalInput ?? buildCreateInput(flight), retryKey: retryEntries ? retryEntries[i]?.retryKey ?? '' : undefined })
    })

    if (entries.length > 0) {
      const outcomes = userId
        ? await createFlights(userId, entries, (ack, saved) => {
            reconcileDerivedState(ack, queryClient, userId)
            successCount += saved
            setSavedCount(successCount)
          })
        : entries.map(() => new Error('Not authenticated'))
      outcomes.forEach((error, i) => { errors[entries[i].index] = error })
    }

    flights.forEach((flight, i) => {
      const error = errors[i]
      if (!error) return
      console.error('Failed to save flight:', error)
      const operationId = operationIds[i]
      const pending = userId ? pendingFlightCreateOperation(userId, operationId) : null
      failedForRetry.push({
        flight, operationId, error: error.message,
        originalInput: pending?.body as CreateInput | undefined, retryKey: retryEntries?.[i]?.retryKey ?? pending?.key, expired: pending?.expired,
      })
    })

    // Track failed saves for potential retry (each accepted chunk already refreshed its queries)
    setFailedFlights(failedForRetry)

    // Show toast for failures
    if (failedForRetry.length > 0 && successCount > 0) {
      showError(new Error('Some flights could not be saved'), {
        context: 'save-partial',
      })
    } else if (successCount === 0 && failedForRetry.length > 0) {
      showError(new Error('All flights failed to save'), {
        context: 'save-failed',
      })
    }

    setSavedCount(successCount)
    setStep('success')
  }, [queryClient, showError, userId])

  const retryFailedFlights = useCallback(() => {
    void handleSaveFlights(failedFlights.map(item => item.flight), failedFlights)
  }, [failedFlights, handleSaveFlights])

  const handleRevealComplete = useCallback(() => {
    setPendingFlights(undefined)
    setStep('review')
  }, [])

  const handleCancel = useCallback(() => {
    setStep('upload')
    setExtractedFlights([])
    setRejectedFlights([])
    setGeminiCount(undefined)
    setParseError(null)
    setPendingFlights(undefined)
    parseMutation.reset()
  }, [parseMutation])

  const handleManualAdd = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  const handleGoToFlights = useCallback(() => {
    if (import.meta.env.BASE_URL === '/legacy/' && allowedLegacyReturn(new URLSearchParams(location.search).get('returnTo'))) {
      returnAfterLegacyWrite(location.search)
      return
    }
    navigate('/flights')
  }, [navigate, location.search])

  const handleImportMore = useCallback(() => {
    setStep('upload')
    setExtractedFlights([])
    setRejectedFlights([])
    setGeminiCount(undefined)
    setSavedCount(0)
    setParseError(null)
    setFailedFlights([])
    setPendingFlights(undefined)
    parseMutation.reset()
  }, [parseMutation])

  const startNewImport = useCallback(() => {
    if (userId) failedFlights.forEach(item => abandonFlightCreateOperation(userId, item.operationId))
    importRunId.current = rotateFlightOperationId('import')
    handleImportMore()
  }, [userId, failedFlights, handleImportMore])

  // Map step to user-facing step number (parsing/saving are transient states)
  const getStepNumber = (currentStep: ImportStep): number => {
    switch (currentStep) {
      case 'upload':
      case 'parsing':
        return 1
      case 'review':
      case 'saving':
        return 2
      case 'success':
        return 3
    }
  }

  return (
    <AppPageShell
      shellClassName="min-h-screen bg-gradient-soft relative overflow-hidden"
      maxWidth="import"
      className="mx-auto px-6 py-8 pb-safe sm:pb-8 relative z-10"
      beforeMain={<PlaneAnimation className="z-0" variant="subtle" count={20} />}
      mobileHeader={<MobileHeader />}
      appHeader={<AppHeader />}
      afterMain={
        <>
          <FlightForm
            isOpen={isFormOpen}
            onClose={handleFormClose}
          />

          <FlightProgressModal
            isOpen={step === 'parsing'}
            onCancel={handleCancel}
            inputType={inputType}
            flights={pendingFlights}
            onRevealComplete={handleRevealComplete}
          />
        </>
      }
      mobileTabBar={<MobileTabBar />}
    >
        {/* Page header with step indicator */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t('import.title', 'Import')}
            </h1>
            {/* Visual step indicator */}
            {step !== 'success' && (
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((stepNum) => {
                  const currentStep = getStepNumber(step)
                  const isComplete = stepNum < currentStep
                  const isCurrent = stepNum === currentStep
                  return (
                    <div
                      key={stepNum}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        isComplete
                          ? 'bg-primary'
                          : isCurrent
                            ? 'bg-primary scale-125'
                            : 'bg-border'
                      }`}
                      aria-hidden="true"
                    />
                  )
                })}
                <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                  {getStepNumber(step) === 1 && t('import.steps.upload', 'Upload')}
                  {getStepNumber(step) === 2 && t('import.steps.review', 'Review')}
                  {getStepNumber(step) === 3 && t('import.steps.done', 'Done')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step content */}
        {step === 'upload' && (
          <ImportUpload
            onSubmit={handleUploadSubmit}
            disabled={parseMutation.isPending}
          />
        )}

        {step === 'parsing' && (
          <Card className="border-border/50" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="py-8 flex flex-col items-center text-center text-muted-foreground">
                <p>{t('import.parsing.redirectHint', 'Processing in overlay...')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'review' && (
          <>
            {/* Parse error alert - shown inline in wizard */}
            {parseError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t(parseError)}
                </AlertDescription>
              </Alert>
            )}
            <ImportReview
              flights={extractedFlights}
              onSave={handleSaveFlights}
              onCancel={handleCancel}
              onManualAdd={handleManualAdd}
              rejected={rejectedFlights}
              geminiCount={geminiCount}
            />
          </>
        )}

        {step === 'saving' && (
          <Card className="border-border/50" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="py-8 flex flex-col items-center">
                <div className="w-16 h-16 mb-4">
                  <Plane className="w-full h-full text-primary animate-pulse" aria-hidden="true" />
                </div>
                <p className="font-medium">
                  {t('import.saving.progress', 'Saving flight {{current}} of {{total}}...', {
                    current: savedCount + 1,
                    total: extractedFlights.length,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (() => {
          const allFailed = savedCount === 0 && failedFlights.length > 0
          const partialSuccess = savedCount > 0 && failedFlights.length > 0

          return (
            <Card className="border-border/50" style={{ animationDelay: '100ms' }}>
              <CardContent className="p-6">
                <div className="py-8 text-center">
                  {/* Icon: green check / red X / yellow warning */}
                  {allFailed ? (
                    <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                      <X className="w-8 h-8 text-destructive" />
                    </div>
                  ) : partialSuccess ? (
                    <div className="w-16 h-16 mx-auto mb-4 bg-warning/10 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-warning" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center">
                      <Check className="w-8 h-8 text-success" />
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-xl font-semibold tracking-tight mb-2">
                    {allFailed
                      ? t('import.success.allFailed', 'Import failed')
                      : partialSuccess
                        ? t('import.success.partialTitle', 'Partially imported')
                        : t('import.success.title', 'Flights imported!')}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-muted-foreground mb-6">
                    {allFailed
                      ? t('import.success.allFailedCount', '{{count}} flight(s) could not be saved', { count: failedFlights.length })
                      : partialSuccess
                        ? t('import.success.partialCount', '{{success}} of {{total}} flight(s) saved', { success: animatedSavedCount, total: savedCount + failedFlights.length })
                        : t('import.success.count', '{{count}} flight(s) added to your log', { count: animatedSavedCount })}
                  </p>

                  {/* Per-flight error details */}
                  {failedFlights.length > 0 && (
                    <Alert variant="destructive" className="mb-6 text-left max-w-md mx-auto">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="mt-1 space-y-1">
                          {failedFlights.map((item) => (
                            <li key={item.operationId} className="text-sm">
                              {t('import.success.errorDetail', '{{flight}}: {{error}}', { flight: flightLabel(item.flight), error: item.error })}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-center gap-3">
                    {failedFlights.length > 0 && (
                      <Button variant="outline" onClick={retryFailedFlights} disabled={failedFlights.some(item => item.expired)}>
                        {t('import.success.retryFailed', 'Retry failed saves')}
                      </Button>
                    )}
                    {failedFlights.some(item => item.flight.field_confidence?.date_year_explicit === false) && (
                      <Button variant="outline" onClick={() => setStep('review')}>
                        {t('import.success.reviewFailed', 'Review flight dates')}
                      </Button>
                    )}
                    <Button variant="outline" onClick={startNewImport}>
                      {failedFlights.length > 0
                        ? t('import.success.startNewImport', 'Start new import (abandon these retries)')
                        : t('import.success.importMore', 'Import more')}
                    </Button>
                    {savedCount > 0 && (
                      <Button onClick={handleGoToFlights} className="gap-2">
                        {t('import.success.viewFlights', 'View flights')}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}
    </AppPageShell>
  )
}
