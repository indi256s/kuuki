import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
import { getProcessingMessage, type ProcessingStage } from '@/lib/glados-text'
import { findAirline } from '@kuuki/data'
import type { ExtractedFlight } from '@/hooks/useImport'

// Stage definitions with timing estimates
const STAGE_DEFS = [
  { id: 'cleaning' as ProcessingStage, duration: 3000, label: { en: 'Normalizing', ru: 'Нормализация' }, ruDesc: 'Очищаем и структурируем текст...' },
  { id: 'extracting' as ProcessingStage, duration: 15000, label: { en: 'Extracting', ru: 'Извлечение' }, ruDesc: 'ИИ определяет рейсы, даты, маршруты...' },
  { id: 'validating' as ProcessingStage, duration: 2000, label: { en: 'Validating', ru: 'Валидация' }, ruDesc: 'Проверяем коды аэропортов и авиакомпаний...' },
]

// Fun facts to show during longer waits
const FUN_FACTS = [
  { en: 'The longest commercial flight is Singapore to New York: 18+ hours', ru: 'Самый длинный рейс — Сингапур-Нью-Йорк: 18+ часов' },
  { en: 'There are about 100,000 flights per day worldwide', ru: 'В мире выполняется около 100,000 рейсов в день' },
  { en: 'The busiest airport is Atlanta (ATL) with 90M+ passengers/year', ru: 'Самый загруженный аэропорт — Атланта (ATL): 90M+ пассажиров/год' },
  { en: 'The first commercial flight was in 1914: St. Petersburg to Tampa', ru: 'Первый коммерческий рейс был в 1914: Санкт-Петербург — Тампа' },
  { en: 'A Boeing 747 has about 6 million parts', ru: 'Boeing 747 состоит из ~6 миллионов деталей' },
]

// Delay between each flight appearing (ms)
const REVEAL_DELAY_MS = 300
// Delay after all flights revealed before showing validation marks (ms)
const VALIDATION_DELAY_MS = 500
// Delay after validation marks before calling onRevealComplete (ms)
const COMPLETE_DELAY_MS = 400

/** Format a flight as a compact one-line string */
function formatFlightLine(flight: ExtractedFlight): string {
  const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null
  const airlineCode = airline?.iata || flight.airline_iata || ''
  const flightNum = flight.flight_number || ''
  const flightId = `${airlineCode} ${flightNum}`.trim()

  const origin = flight.origin
  const dest = flight.destination

  // Format date as "15 Jan 2026"
  const [year, month, day] = flight.date.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dateStr = `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${year}`

  // Format times if available
  const times = flight.departure_time && flight.arrival_time
    ? `${flight.departure_time.slice(0, 5)}–${flight.arrival_time.slice(0, 5)}`
    : ''

  return [flightId, `${origin} → ${dest}`, dateStr, times].filter(Boolean).join('   ')
}

interface FlightProgressModalProps {
  isOpen: boolean
  onCancel?: () => void
  inputType?: 'text' | 'pdf' | 'image'
  /** Flights to reveal after API returns */
  flights?: ExtractedFlight[]
  /** Called after reveal animation completes */
  onRevealComplete?: () => void
}

export function FlightProgressModal({
  isOpen,
  onCancel,
  inputType = 'text',
  flights,
  onRevealComplete,
}: FlightProgressModalProps) {
  const { t, i18n } = useTranslation()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [factIndex, setFactIndex] = useState(0)
  const [revealedCount, setRevealedCount] = useState(0)
  const [validated, setValidated] = useState(false)
  const startTimeRef = useRef<number>(0)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lang = i18n.language === 'ru' ? 'ru' : 'en'

  // Generate randomized GLaDOS descriptions on each modal open (English only)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stages = useMemo(() => STAGE_DEFS.map(def => ({
    id: def.id,
    duration: def.duration,
    en: { label: def.label.en, description: getProcessingMessage(def.id) },
    ru: { label: def.label.ru, description: def.ruDesc },
  })), [isOpen])

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Reset reveal state when modal closes or flights change
  useEffect(() => {
    if (!isOpen) {
      setRevealedCount(0)
      setValidated(false)
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current)
        revealTimerRef.current = null
      }
    }
  }, [isOpen])

  // Staggered flight reveal animation
  useEffect(() => {
    if (!flights || flights.length === 0 || !isOpen) return

    // Start revealing flights one by one
    if (revealedCount < flights.length) {
      revealTimerRef.current = setTimeout(() => {
        setRevealedCount(prev => prev + 1)
      }, revealedCount === 0 ? 200 : REVEAL_DELAY_MS) // Shorter initial delay
      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      }
    }

    // All flights revealed — show validation marks
    if (revealedCount >= flights.length && !validated) {
      revealTimerRef.current = setTimeout(() => {
        setValidated(true)
      }, VALIDATION_DELAY_MS)
      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      }
    }

    // Validated — call onRevealComplete after a short pause
    if (validated && onRevealComplete) {
      revealTimerRef.current = setTimeout(() => {
        onRevealComplete()
      }, COMPLETE_DELAY_MS)
      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      }
    }
  }, [flights, revealedCount, validated, isOpen, onRevealComplete])

  // Track elapsed time
  useEffect(() => {
    if (!isOpen) {
      setElapsedMs(0)
      return
    }

    startTimeRef.current = Date.now()
    setFactIndex(Math.floor(Math.random() * FUN_FACTS.length))

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)

    return () => clearInterval(timer)
  }, [isOpen])

  // Rotate fun facts every 8 seconds
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FUN_FACTS.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  // When flights are provided, all stages are complete
  const hasFlights = flights && flights.length > 0

  // Calculate current stage based on elapsed time
  let cumulativeTime = 0
  let currentStageIndex = hasFlights ? stages.length : 0
  if (!hasFlights) {
    for (let i = 0; i < stages.length; i++) {
      cumulativeTime += stages[i].duration
      if (elapsedMs < cumulativeTime) {
        currentStageIndex = i
        break
      }
      if (i === stages.length - 1) {
        currentStageIndex = i // Stay on last stage if exceeded
      }
    }
  }

  const currentFact = FUN_FACTS[factIndex]

  // Format elapsed time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${seconds}s`
  }

  return (
    <div className="fixed inset-0 z-50 min-h-[100dvh] flex items-center justify-center p-4">
      {/* Backdrop with subtle gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/60 to-background/75 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Main card */}
        <div className="bg-card/50 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header with elapsed time */}
          <div className="px-6 pt-6 pb-4 border-b border-border/30">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                {inputType === 'text'
                  ? t('import.parsing.analyzingText', 'Analyzing flight data')
                  : t('import.parsing.analyzingDocument', 'Reading document')}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                <div className={cn(
                  "w-2 h-2 rounded-full bg-primary",
                  !prefersReducedMotion && "animate-pulse"
                )} />
                {formatTime(elapsedMs)}
              </div>
            </div>
          </div>

          {/* Stage pipeline */}
          <div className="px-6 py-5">
            <div className="space-y-3">
              {stages.map((stage, index) => {
                const isActive = index === currentStageIndex
                const isComplete = index < currentStageIndex
                const isPending = index > currentStageIndex

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg transition-all duration-300",
                      isActive && "bg-primary/5 border border-primary/20",
                      isComplete && "opacity-60",
                      isPending && "opacity-40"
                    )}
                  >
                    {/* Stage indicator */}
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                      isComplete && "bg-primary/20 text-primary",
                      isActive && "bg-primary text-primary-foreground",
                      isPending && "bg-muted text-muted-foreground"
                    )}>
                      {isComplete ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isActive ? (
                        <Loader2 className={cn("w-3.5 h-3.5", !prefersReducedMotion && "animate-spin")} />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Stage content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-sm",
                          isActive && "text-foreground",
                          (isComplete || isPending) && "text-muted-foreground"
                        )}>
                          {stage[lang].label}
                        </span>
                        {isActive && (
                          <span className="text-xs text-primary font-mono">
                            {t('import.parsing.inProgress', 'in progress')}
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {stage[lang].description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Flight log panel — visible during extraction and after */}
          {(currentStageIndex >= 1 || hasFlights) && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('import.parsing.flightsFound', 'Flights found')}
                </div>
                {(hasFlights && revealedCount > 0) && (
                  <span className="text-xs font-mono text-primary tabular-nums">
                    {revealedCount} {revealedCount === 1 ? 'flight' : 'flights'}
                  </span>
                )}
              </div>
              <div className="bg-muted/40 dark:bg-muted/20 rounded-lg border border-primary/20 p-3">
                <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
                  {(!hasFlights || revealedCount === 0) ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-primary/60">&gt;</span>
                      <span>{t('import.parsing.scanning', 'Scanning document...')}</span>
                      <span className={cn(
                        "inline-block w-1.5 h-3.5 bg-primary/50",
                        !prefersReducedMotion && "animate-pulse"
                      )} />
                    </div>
                  ) : (
                    flights!.slice(0, revealedCount).map((flight, index) => (
                      <div
                        key={`${flight.origin}-${flight.destination}-${flight.date}-${index}`}
                        className={cn(
                          "flex items-center gap-2 text-foreground/80",
                          !prefersReducedMotion && "animate-fade-up"
                        )}
                        style={!prefersReducedMotion ? { animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' } : undefined}
                      >
                        <span className="text-primary/60 flex-shrink-0">&gt;</span>
                        <span className="truncate">{formatFlightLine(flight)}</span>
                        {validated && (
                          <Check
                            className={cn(
                              "w-3 h-3 text-primary flex-shrink-0 ml-auto",
                              !prefersReducedMotion && "animate-fade-in"
                            )}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fun fact footer */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border/30">
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground/60 flex-shrink-0">💡</span>
              <p
                key={factIndex}
                className={cn(
                  "text-xs text-muted-foreground leading-relaxed",
                  !prefersReducedMotion && "animate-fade-in"
                )}
              >
                {currentFact[lang]}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons - below card */}
        <div className="mt-4 space-y-2">
          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-card/50 rounded-xl transition-colors border border-transparent hover:border-border/30"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
