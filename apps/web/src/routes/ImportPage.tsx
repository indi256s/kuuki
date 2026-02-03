import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateFlight, useFlights } from '@/hooks/useFlights'
import { useParseImport, type ExtractedFlight, type RejectedFlight } from '@/hooks/useImport'
import { useToast } from '@/hooks/useToast'
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
import { calculateFlightDistance, estimateFlightDuration } from '@/lib/geo'
import { getMessageKeyForCategory } from '@/lib/errors'
import { Check, Plane, ArrowRight, AlertCircle } from 'lucide-react'

type ImportStep = 'upload' | 'parsing' | 'review' | 'saving' | 'success'
type InputType = 'text' | 'pdf' | 'image'

export function ImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Check for text content passed from EmptyState
  const initialTextContent = (location.state as { textContent?: string } | null)?.textContent

  const [step, setStep] = useState<ImportStep>('upload')
  const [inputType, setInputType] = useState<InputType>('text')
  const [extractedFlights, setExtractedFlights] = useState<ExtractedFlight[]>([])
  const [rejectedFlights, setRejectedFlights] = useState<RejectedFlight[]>([])
  const [geminiCount, setGeminiCount] = useState<number | undefined>()
  const [cleanedText, setCleanedText] = useState<string | undefined>()
  const [savedCount, setSavedCount] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<number[]>([]) // Track failed flight indices

  const parseMutation = useParseImport()
  const createFlightMutation = useCreateFlight()
  const { showError } = useToast()

  // Get existing flights for duplicate detection
  const { data: existingFlightsData } = useFlights(undefined, undefined, 1000)
  const existingRoutes = new Set<string>()
  existingFlightsData?.pages.forEach(page => {
    page.flights.forEach(flight => {
      existingRoutes.add(`${flight.date}:${flight.origin}:${flight.destination}`)
    })
  })

  // Auto-submit text content if passed from EmptyState
  useEffect(() => {
    if (initialTextContent && step === 'upload') {
      handleUploadSubmit({ type: 'text', content: initialTextContent })
      // Clear the location state to prevent re-submission on refresh
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
      setCleanedText(result.cleaned_text)
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
          durationMinutes = estimateFlightDuration(distanceKm, aircraft?.type)
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
    parseMutation.reset()
  }, [parseMutation])

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
    parseMutation.reset()
  }, [parseMutation])

  // Progress steps for stepper
  const steps = [
    { key: 'upload', label: t('import.steps.upload', 'Upload') },
    { key: 'parsing', label: t('import.steps.parsing', 'Parse') },
    { key: 'review', label: t('import.steps.review', 'Review') },
    { key: 'saving', label: t('import.steps.save', 'Save') },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop header */}
      <AppHeader />

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main className="max-w-3xl mx-auto px-6 py-8 pb-safe sm:pb-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t('import.title', 'Import')}
            </h1>
            {step === 'upload' && (
              <span className="text-sm text-muted-foreground">
                {t('import.breadcrumb', 'Step 1 of 3')}
              </span>
            )}
          </div>
        </div>

        {/* Progress indicator - only for non-upload steps */}
        {step !== 'upload' && step !== 'success' && (
          <div className="mb-8" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step === s.key
                        ? 'bg-primary text-primary-foreground'
                        : currentStepIndex > i
                        ? 'bg-success text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStepIndex > i ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-12 h-0.5 transition-colors ${
                      currentStepIndex > i
                        ? 'bg-success'
                        : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step content */}
        {step === 'upload' && (
          <ImportUpload
            onSubmit={handleUploadSubmit}
            disabled={parseMutation.isPending}
            hasExistingFlights={(existingFlightsData?.pages[0]?.flights.length ?? 0) > 0}
          />
        )}

        {step !== 'upload' && (
          <Card className="border-border/50" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              {step === 'parsing' && (
                <div className="py-8 flex flex-col items-center text-center text-muted-foreground">
                  <p>{t('import.parsing.redirectHint', 'Processing in overlay...')}</p>
                </div>
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
                  />
                </>
              )}

              {step === 'saving' && (
                <div className="py-8 flex flex-col items-center">
                  <div className="w-16 h-16 mb-4">
                    <Plane className="w-full h-full text-primary animate-pulse" />
                  </div>
                  <p className="font-medium">
                    {t('import.saving.progress', 'Saving flight {{current}} of {{total}}...', {
                      current: savedCount + 1,
                      total: extractedFlights.filter((_, i) => i < savedCount || i === savedCount).length || extractedFlights.length,
                    })}
                  </p>
                </div>
              )}

              {step === 'success' && (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight mb-2">
                    {t('import.success.title', 'Flights imported!')}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {t('import.success.count', '{{count}} flight(s) added to your log', { count: savedCount })}
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
              )}
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
        inputType={inputType}
      />
    </div>
  )
}
