import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { sampleStats, sampleFlights, formatDistance, formatDuration } from '@/lib/sampleData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Lightbulb, Copy, Check, X, Plus, Upload, Pencil } from 'lucide-react'

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
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.recentFlights')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {sampleFlights.slice(0, 3).map((flight) => (
                <div key={flight.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{flight.origin}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{flight.destination}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {flight.airline} · {flight.flightNumber}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-data">{formatDistance(flight.distanceKm)}</div>
                    <div className="text-muted-foreground">{formatDuration(flight.durationMinutes)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overlay - Import card or simple CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isDismissed ? (
          /* Simple CTA after dismissing */
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6 text-center">
              <Button onClick={onAddFlight} className="gap-2">
                <Plus className="w-5 h-5" />
                {t('emptyState.addFlight')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Import-focused card */
          <Card className="border-border/50 shadow-lg w-full max-w-lg mx-4">
            {/* Header with close button */}
            <CardHeader className="pb-4 flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-3">
                <img
                  src="/images/mascot.webp"
                  alt="Kuuki"
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <CardTitle className="text-base">
                    {t('emptyState.importTitle', 'Import Your Flights')}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t('emptyState.importSubtitle', 'Get started in seconds with Gemini')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDismissed(true)}
                className="h-8 w-8 -mr-2 -mt-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Content */}
            <CardContent className="space-y-4">
              {/* Step 1: Copy prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span>
                  {t('emptyState.step1', 'Copy this prompt to Google Gemini')}
                </div>
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 pr-16 rounded-lg border border-border overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground max-h-24 overflow-y-auto">
                    {GEMINI_PROMPT}
                  </pre>
                  <Button
                    onClick={copyPrompt}
                    className="absolute top-2 right-2 h-8 gap-1.5"
                  >
                    {showCopiedToast ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {t('import.tip.copied', 'Copied!')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {t('common.copy', 'Copy')}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  {t('import.tip.hint', 'Use with @Gmail and @Google Calendar in Google Gemini')}
                </p>
              </div>

              {/* Step 2: Paste results */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
                  {t('emptyState.step2', 'Paste the results here')}
                </div>
                <Textarea
                  ref={textareaRef}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t('import.upload.textPlaceholder', 'Paste Gemini output, booking confirmations, or flight details here...')}
                  className="h-28 font-mono text-sm resize-none"
                />
              </div>

              {/* Primary action */}
              <Button
                onClick={handleParseFlights}
                disabled={textInput.trim().length < 10 || isSubmitting}
                className="w-full"
              >
                {t('import.parseFlights', 'Parse Flights')}
              </Button>

              {/* Secondary options */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <Button
                  variant="link"
                  onClick={() => navigate('/import')}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t('emptyState.uploadFile', 'Upload file')}
                </Button>
                <span className="text-muted-foreground">·</span>
                <Button
                  variant="link"
                  onClick={onAddFlight}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('emptyState.addManually', 'Add manually')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function SampleStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="text-2xl font-semibold font-data">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
