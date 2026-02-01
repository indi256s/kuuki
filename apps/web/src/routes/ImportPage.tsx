import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useCreateFlight, useFlights } from '@/hooks/useFlights'
import { useParseImport, type ExtractedFlight } from '@/hooks/useImport'
import { ImportUpload } from '@/components/import/ImportUpload'
import { ImportReview } from '@/components/import/ImportReview'
import { WindLoader } from '@/components/common/WindLoader'
import { FlightForm } from '@/components/flights/FlightForm'
import { findAirport, findAircraft } from '@kuuki/data'
import { calculateFlightDistance, estimateFlightDuration } from '@/lib/geo'

type ImportStep = 'upload' | 'parsing' | 'review' | 'saving' | 'success'
type ParsingPhase = 'reading' | 'extracting' | 'finding'

export function ImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()

  // Check for text content passed from EmptyState
  const initialTextContent = (location.state as { textContent?: string } | null)?.textContent

  const [step, setStep] = useState<ImportStep>('upload')
  const [parsingPhase, setParsingPhase] = useState<ParsingPhase>('reading')
  const [extractedFlights, setExtractedFlights] = useState<ExtractedFlight[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const parseMutation = useParseImport()
  const createFlightMutation = useCreateFlight()

  // Get existing flights for duplicate detection
  const { data: existingFlightsData } = useFlights(undefined, 1000)
  const existingRoutes = new Set<string>()
  existingFlightsData?.pages.forEach(page => {
    page.flights.forEach(flight => {
      existingRoutes.add(`${flight.date}:${flight.origin}:${flight.destination}`)
    })
  })

  // Simulate parsing phases for better UX
  useEffect(() => {
    if (step !== 'parsing') return

    const phases: ParsingPhase[] = ['reading', 'extracting', 'finding']
    let currentIndex = 0

    const interval = setInterval(() => {
      currentIndex++
      if (currentIndex < phases.length) {
        setParsingPhase(phases[currentIndex])
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [step])

  // Auto-submit text content if passed from EmptyState
  useEffect(() => {
    if (initialTextContent && step === 'upload') {
      handleUploadSubmit({ type: 'text', content: initialTextContent })
      // Clear the location state to prevent re-submission on refresh
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadSubmit = useCallback(async (data: { type: 'pdf' | 'image' | 'text'; content: string }) => {
    setStep('parsing')
    setParsingPhase('reading')

    try {
      const result = await parseMutation.mutateAsync(data)
      setExtractedFlights(result.flights)
      setStep('review')
    } catch (error) {
      console.error('Parse error:', error)
      setExtractedFlights([])
      setStep('review')
    }
  }, [parseMutation])

  const handleSaveFlights = useCallback(async (flights: ExtractedFlight[]) => {
    setStep('saving')
    setSavedCount(0)

    let successCount = 0

    for (const flight of flights) {
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
        })

        successCount++
        setSavedCount(successCount)
      } catch (error) {
        console.error('Failed to save flight:', error)
        // Continue with other flights
      }
    }

    // Invalidate queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ['flights'] })
    await queryClient.invalidateQueries({ queryKey: ['flightStats'] })

    setSavedCount(successCount)
    setStep('success')
  }, [createFlightMutation, queryClient])

  const handleCancel = useCallback(() => {
    setStep('upload')
    setExtractedFlights([])
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
    setSavedCount(0)
    parseMutation.reset()
  }, [parseMutation])

  return (
    <div className="min-h-screen bg-sky">
      {/* Header */}
      <header className="bg-sky-raised border-b border-edge">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-xl font-semibold text-ink">
              {t('common.appName')}
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {t('nav.dashboard', 'Dashboard')}
              </Link>
              <Link
                to="/flights"
                className="text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {t('nav.flights', 'Flights')}
              </Link>
              <span className="text-sm text-runway font-medium">
                {t('nav.import', 'Import')}
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {currentLanguage === 'en' ? 'RU' : 'EN'}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink">
            {t('import.title', 'Import Flights')}
          </h1>
          <p className="text-ink-muted mt-1">
            {t('import.description', 'Upload a photo of your boarding pass or paste flight details')}
          </p>
        </div>

        {/* Progress indicator */}
        {step !== 'upload' && step !== 'success' && (
          <div className="mb-8">
            <div className="flex items-center gap-2">
              {['upload', 'parsing', 'review', 'saving'].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === s
                        ? 'bg-runway text-ink-inverse'
                        : ['parsing', 'review', 'saving'].indexOf(step) > i
                        ? 'bg-cleared text-ink-inverse'
                        : 'bg-sky-sunken text-ink-muted'
                    }`}
                  >
                    {['parsing', 'review', 'saving'].indexOf(step) > i ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && (
                    <div className={`w-12 h-0.5 ${
                      ['parsing', 'review', 'saving'].indexOf(step) > i
                        ? 'bg-cleared'
                        : 'bg-sky-sunken'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="bg-sky-raised rounded-xl border border-edge p-6">
          {step === 'upload' && (
            <ImportUpload
              onSubmit={handleUploadSubmit}
              disabled={parseMutation.isPending}
              hasExistingFlights={(existingFlightsData?.pages[0]?.flights.length ?? 0) > 0}
            />
          )}

          {step === 'parsing' && (
            <div className="py-8 flex flex-col items-center">
              <WindLoader step={parsingPhase} size="lg" />
              <p className="mt-6 text-center text-ink-muted">
                {t('import.parsing.hint', 'This usually takes a few seconds')}
              </p>
            </div>
          )}

          {step === 'review' && (
            <ImportReview
              flights={extractedFlights}
              existingRoutes={existingRoutes}
              onSave={handleSaveFlights}
              onCancel={handleCancel}
              onManualAdd={handleManualAdd}
            />
          )}

          {step === 'saving' && (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 mb-4">
                <svg className="w-full h-full animate-spin text-runway" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-ink font-medium">
                {t('import.saving.progress', 'Saving flight {{current}} of {{total}}...', {
                  current: savedCount + 1,
                  total: extractedFlights.filter((_, i) => i < savedCount || i === savedCount).length || extractedFlights.length,
                })}
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-cleared-muted rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-cleared" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-ink mb-2">
                {t('import.success.title', 'Flights imported!')}
              </h3>
              <p className="text-ink-muted mb-6">
                {t('import.success.count', '{{count}} flight(s) added to your log', { count: savedCount })}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleImportMore}
                  className="px-4 py-2 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
                >
                  {t('import.success.importMore', 'Import more')}
                </button>
                <button
                  onClick={handleGoToFlights}
                  className="px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium"
                >
                  {t('import.success.viewFlights', 'View flights')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Manual flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
      />
    </div>
  )
}
