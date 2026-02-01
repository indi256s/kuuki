import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { sampleStats, sampleFlights, formatDistance, formatDuration } from '@/lib/sampleData'

const GEMINI_PROMPT = `@Gmail @Google Calendar Search for all flight bookings, boarding passes, itineraries, and travel confirmations.

For each flight, try to find (include only what you can find):
- Date (any format is fine)
- Origin and destination airports (city names or airport codes)
- Airline name or code
- Flight number (if available)
- Departure/arrival times (if available)

Format: one flight per line, include whatever info you found.

Example outputs:
2024-03-15 | JFK → LAX | American Airlines 123 | 08:30-11:45
2024-03-20 | Los Angeles to New York | Delta
March 25 | SVO-LED | Aeroflot

List ALL flights. Partial info is OK - just include what's available.`

interface EmptyStateProps {
  onAddFlight: () => void
}

export function EmptyState({ onAddFlight }: EmptyStateProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isDismissed, setIsDismissed] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GEMINI_PROMPT)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = GEMINI_PROMPT
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    }
  }, [])

  const handleParseFlights = useCallback(() => {
    if (textInput.trim().length < 10) return

    setIsSubmitting(true)
    // Navigate to import page with the text content
    navigate('/import', { state: { textContent: textInput.trim() } })
  }, [textInput, navigate])

  return (
    <div className="relative">
      {/* Sample dashboard preview (faded) */}
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SampleStatCard
            label={t('dashboard.totalFlights')}
            value={sampleStats.totalFlights.toString()}
          />
          <SampleStatCard
            label={t('dashboard.totalDistance')}
            value={formatDistance(sampleStats.totalDistanceKm)}
          />
          <SampleStatCard
            label={t('dashboard.countriesVisited')}
            value={sampleStats.countriesVisited.toString()}
          />
          <SampleStatCard
            label={t('dashboard.airlinesFlown')}
            value={sampleStats.airlinesFlown.toString()}
          />
        </div>

        {/* Recent flights */}
        <div className="bg-sky-raised border border-edge rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-edge">
            <h3 className="font-medium text-ink">{t('dashboard.recentFlights')}</h3>
          </div>
          <div className="divide-y divide-edge">
            {sampleFlights.slice(0, 3).map((flight) => (
              <div key={flight.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-ink font-medium">
                    <span>{flight.origin}</span>
                    <span className="text-ink-faint">→</span>
                    <span>{flight.destination}</span>
                  </div>
                  <div className="text-sm text-ink-muted truncate">
                    {flight.airline} · {flight.flightNumber}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-ink font-data">{formatDistance(flight.distanceKm)}</div>
                  <div className="text-ink-muted">{formatDuration(flight.durationMinutes)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay - Import card or simple CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isDismissed ? (
          /* Simple CTA after dismissing */
          <div className="bg-sky-raised border border-edge rounded-xl p-6 text-center shadow-lg">
            <button
              onClick={onAddFlight}
              className="flex items-center gap-2 px-6 py-3 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('emptyState.addFlight')}
            </button>
          </div>
        ) : (
          /* Import-focused card */
          <div className="bg-sky-raised border border-edge rounded-xl shadow-lg w-full max-w-lg mx-4">
            {/* Header with close button */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-3">
                <img
                  src="/images/mascot.webp"
                  alt="Kuuki"
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <h2 className="font-semibold text-ink">
                    {t('emptyState.importTitle', 'Import Your Flights')}
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {t('emptyState.importSubtitle', 'Get started in seconds with Gemini')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-2 text-ink-muted hover:text-ink hover:bg-sky-sunken rounded-lg transition-colors"
                aria-label={t('common.close')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Step 1: Copy prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="w-5 h-5 rounded-full bg-runway text-ink-inverse text-xs flex items-center justify-center">1</span>
                  {t('emptyState.step1', 'Copy this prompt to Google Gemini')}
                </div>
                <div className="relative">
                  <pre className="text-xs bg-sky-sunken p-3 pr-16 rounded-lg border border-edge overflow-x-auto whitespace-pre-wrap font-mono text-ink-muted max-h-24 overflow-y-auto">
                    {GEMINI_PROMPT}
                  </pre>
                  <button
                    onClick={copyPrompt}
                    className="absolute top-2 right-2 px-2.5 py-1.5 bg-runway text-ink-inverse text-xs font-medium rounded-md hover:bg-runway-hover transition-colors flex items-center gap-1.5"
                  >
                    {showCopiedToast ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('import.tip.copied', 'Copied!')}
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('common.copy', 'Copy')}
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-ink-faint">
                  {t('import.tip.hint', 'Use with @Gmail and @Google Calendar in Google Gemini')}
                </p>
              </div>

              {/* Step 2: Paste results */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="w-5 h-5 rounded-full bg-runway text-ink-inverse text-xs flex items-center justify-center">2</span>
                  {t('emptyState.step2', 'Paste the results here')}
                </div>
                <textarea
                  ref={textareaRef}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t('import.upload.textPlaceholder', 'Paste Gemini output, booking confirmations, or flight details here...')}
                  className="w-full h-28 px-3 py-2.5 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway focus:border-transparent resize-none text-sm font-mono"
                />
              </div>

              {/* Primary action */}
              <button
                onClick={handleParseFlights}
                disabled={textInput.trim().length < 10 || isSubmitting}
                className="w-full px-4 py-3 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('import.parseFlights', 'Parse Flights')}
              </button>

              {/* Secondary options */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={() => navigate('/import')}
                  className="text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  {t('emptyState.uploadFile', 'Upload file')}
                </button>
                <span className="text-ink-faint">·</span>
                <button
                  onClick={onAddFlight}
                  className="text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  {t('emptyState.addManually', 'Add manually')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SampleStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sky-raised border border-edge rounded-xl p-4">
      <div className="text-2xl font-semibold text-ink font-data">{value}</div>
      <div className="text-sm text-ink-muted">{label}</div>
    </div>
  )
}
