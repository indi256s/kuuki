import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateFlight, useFlights } from '@/hooks/useFlights'
import { useParseImport, type ExtractedFlight, type RejectedFlight } from '@/hooks/useImport'
import { useToast } from '@/hooks/useToast'
import { useImportStore } from '@/stores/importStore'
import { AppHeader } from '@/components/common/AppHeader'
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
import { calculateFlightDistance, calculateFlightDuration, estimateFlightDuration } from '@/lib/geo'
import { getMessageKeyForCategory } from '@/lib/errors'
import { Check, Plane, ArrowRight, AlertCircle } from 'lucide-react'
import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import { useCountUp } from '@/hooks/useCountUp'

type ImportStep = 'upload' | 'parsing' | 'review' | 'saving' | 'success'
type InputType = 'text' | 'pdf' | 'image'

// Location state for resuming from background
interface BackgroundState {
  textContent?: string
  enrichedFlights?: ExtractedFlight[]
  basicFlights?: ExtractedFlight[]
  fromBackground?: boolean
  enrichmentFailed?: boolean
  jobId?: string
}

export function ImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Background state from location (resume from toast notification)
  const locationState = location.state as BackgroundState | null
  const initialTextContent = locationState?.textContent

  const [step, setStep] = useState<ImportStep>('upload')
  const [inputType, setInputType] = useState<InputType>('text')
  const [extractedFlights, setExtractedFlights] = useState<ExtractedFlight[]>([])
  const [rejectedFlights, setRejectedFlights] = useState<RejectedFlight[]>([])
  const [geminiCount, setGeminiCount] = useState<number | undefined>()
  const [cleanedText, setCleanedText] = useState<string | undefined>()
  const [savedCount, setSavedCount] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Animated count for success screen - only animates when step becomes 'success'
  const animatedSavedCount = useCountUp(step === 'success' ? savedCount : 0, 800)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<number[]>([]) // Track failed flight indices
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | undefined>()

  const parseMutation = useParseImport()
  const createFlightMutation = useCreateFlight()
  const { showError } = useToast()
  const { addBackgroundJob, removeBackgroundJob } = useImportStore()

  // Get existing flights for duplicate detection
  const { data: existingFlightsData } = useFlights(undefined, undefined, 1000)
  const existingRoutes = new Set<string>()
  existingFlightsData?.pages.forEach(page => {
    page.flights.forEach(flight => {
      existingRoutes.add(`${flight.date}:${flight.origin}:${flight.destination}`)
    })
  })

  // Handle initial state: text content from EmptyState or resuming from background
  useEffect(() => {
    // Resume from background notification
    if (locationState?.fromBackground) {
      if (locationState.enrichedFlights) {
        // Enrichment completed - show enriched flights
        setExtractedFlights(locationState.enrichedFlights)
        setStep('review')
      } else if (locationState.basicFlights) {
        // Enrichment failed - show basic flights
        setExtractedFlights(locationState.basicFlights)
        setStep('review')
      }
      // Remove the background job
      if (locationState.jobId) {
        removeBackgroundJob(locationState.jobId)
      }
      // Clear location state
      navigate(location.pathname, { replace: true, state: {} })
      return
    }

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
    setEnrichmentJobId(undefined)

    try {
      const result = await parseMutation.mutateAsync(data)
      setExtractedFlights(result.flights)
      setRejectedFlights(result.rejected || [])
      setGeminiCount(result.gemini_count)
      setCleanedText(result.cleaned_text)
      // Track enrichment job ID for two-phase import
      setEnrichmentJobId(result.enrichmentJobId)
      setStep('review')
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
      setCleanedText(undefined)
      setStep('review')
    }
  }, [parseMutation])

  const handleSaveFlights = useCallback(async (flights: ExtractedFlight[]) => {
    setStep('saving')
    setSavedCount(0)
    setSaveErrors([])

    let successCount = 0
    const failedIndices: number[] = []

    for (let i = 0; i < flights.length; i++) {
      const flight = flights[i]
      try {
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

        await createFlightMutation.mutateAsync({
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
        })

        successCount++
        setSavedCount(successCount)
      } catch (error) {
        console.error('Failed to save flight:', error)
        failedIndices.push(i)
        // Continue with other flights - don't block on individual failures
      }
    }

    // Track failed saves for potential retry
    setSaveErrors(failedIndices)

    // Invalidate queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ['flights'] })
    await queryClient.invalidateQueries({ queryKey: ['flightStats'] })

    // Show toast if some flights failed (data loss risk scenario)
    if (failedIndices.length > 0 && successCount > 0) {
      showError(new Error('Some flights could not be saved'), {
        context: 'save-partial',
      })
    }

    setSavedCount(successCount)
    setStep('success')
  }, [createFlightMutation, queryClient, showError])

  const handleCancel = useCallback(() => {
    setStep('upload')
    setExtractedFlights([])
    setRejectedFlights([])
    setGeminiCount(undefined)
    setCleanedText(undefined)
    setParseError(null)
    setSaveErrors([])
    setEnrichmentJobId(undefined)
    parseMutation.reset()
  }, [parseMutation])

  // Handle "Continue in Background" - save job to store and navigate away
  const handleContinueInBackground = useCallback(() => {
    if (enrichmentJobId && extractedFlights.length > 0) {
      // Save to background store for later notification
      addBackgroundJob({
        jobId: enrichmentJobId,
        basicFlights: extractedFlights,
        startedAt: Date.now(),
        returnPath: '/import',
      })

      // Navigate to flights list
      navigate('/flights')
    }
  }, [enrichmentJobId, extractedFlights, addBackgroundJob, navigate])

  const handleManualAdd = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  const handleGoToFlights = useCallback(() => {
    navigate('/flights')
  }, [navigate])

  const handleImportMore = useCallback(() => {
    setStep('upload')
    setExtractedFlights([])
    setRejectedFlights([])
    setGeminiCount(undefined)
    setCleanedText(undefined)
    setSavedCount(0)
    setParseError(null)
    setSaveErrors([])
    setEnrichmentJobId(undefined)
    parseMutation.reset()
  }, [parseMutation])

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
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      {/* Background plane animation - z-0 to stay behind content */}
      <PlaneAnimation className="z-0" variant="subtle" count={20} />

      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop header */}
      <AppHeader />

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main className="max-w-5xl mx-auto px-6 py-8 pb-safe sm:pb-8 relative z-10">
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
            hasExistingFlights={(existingFlightsData?.pages[0]?.flights.length ?? 0) > 0}
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
              existingRoutes={existingRoutes}
              onSave={handleSaveFlights}
              onCancel={handleCancel}
              onManualAdd={handleManualAdd}
              rejected={rejectedFlights}
              geminiCount={geminiCount}
              cleanedText={cleanedText}
              enrichmentJobId={enrichmentJobId}
              onEnrichmentComplete={(enrichedFlights) => setExtractedFlights(enrichedFlights)}
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

        {step === 'success' && (
          <Card className="border-border/50" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight mb-2">
                  {t('import.success.title', 'Flights imported!')}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t('import.success.count', '{{count}} flight(s) added to your log', { count: animatedSavedCount })}
                </p>

                {/* Show warning if some flights failed to save */}
                {saveErrors.length > 0 && (
                  <Alert variant="destructive" className="mb-6 text-left max-w-sm mx-auto">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('import.success.partialFail', '{{count}} flight(s) could not be saved.', { count: saveErrors.length })}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={handleImportMore}>
                    {t('import.success.importMore', 'Import more')}
                  </Button>
                  <Button onClick={handleGoToFlights} className="gap-2">
                    {t('import.success.viewFlights', 'View flights')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Manual flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
      />

      {/* Mobile tab bar */}
      <MobileTabBar />

      {/* Flight progress modal - shown during parsing */}
      <FlightProgressModal
        isOpen={step === 'parsing'}
        onCancel={handleCancel}
        onContinueInBackground={enrichmentJobId ? handleContinueInBackground : undefined}
        inputType={inputType}
      />
    </div>
  )
}
