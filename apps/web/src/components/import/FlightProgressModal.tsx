import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'

// Import stages with timing estimates
const STAGES = [
  {
    id: 'cleaning',
    duration: 3000, // ~3s for Stage 1 (Gemini cleaning)
    en: { label: 'Normalizing', description: 'Cleaning and structuring your text...' },
    ru: { label: 'Нормализация', description: 'Очищаем и структурируем текст...' },
  },
  {
    id: 'extracting',
    duration: 15000, // ~15s for Stage 2 (Gemini extraction) - varies by count
    en: { label: 'Extracting', description: 'AI is identifying flights, dates, routes...' },
    ru: { label: 'Извлечение', description: 'ИИ определяет рейсы, даты, маршруты...' },
  },
  {
    id: 'validating',
    duration: 2000, // ~2s for validation
    en: { label: 'Validating', description: 'Checking airport codes and airline data...' },
    ru: { label: 'Валидация', description: 'Проверяем коды аэропортов и авиакомпаний...' },
  },
]

// Fun facts to show during longer waits
const FUN_FACTS = [
  { en: 'The longest commercial flight is Singapore to New York: 18+ hours', ru: 'Самый длинный рейс — Сингапур-Нью-Йорк: 18+ часов' },
  { en: 'There are about 100,000 flights per day worldwide', ru: 'В мире выполняется около 100,000 рейсов в день' },
  { en: 'The busiest airport is Atlanta (ATL) with 90M+ passengers/year', ru: 'Самый загруженный аэропорт — Атланта (ATL): 90M+ пассажиров/год' },
  { en: 'The first commercial flight was in 1914: St. Petersburg to Tampa', ru: 'Первый коммерческий рейс был в 1914: Санкт-Петербург — Тампа' },
  { en: 'A Boeing 747 has about 6 million parts', ru: 'Boeing 747 состоит из ~6 миллионов деталей' },
]

interface FlightProgressModalProps {
  isOpen: boolean
  onCancel?: () => void
  inputType?: 'text' | 'pdf' | 'image'
}

export function FlightProgressModal({ isOpen, onCancel, inputType = 'text' }: FlightProgressModalProps) {
  const { t, i18n } = useTranslation()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [factIndex, setFactIndex] = useState(0)
  const startTimeRef = useRef<number>(0)
  const lang = i18n.language === 'ru' ? 'ru' : 'en'

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

  // Calculate current stage based on elapsed time
  let cumulativeTime = 0
  let currentStageIndex = 0
  for (let i = 0; i < STAGES.length; i++) {
    cumulativeTime += STAGES[i].duration
    if (elapsedMs < cumulativeTime) {
      currentStageIndex = i
      break
    }
    if (i === STAGES.length - 1) {
      currentStageIndex = i // Stay on last stage if exceeded
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
        className="absolute inset-0 bg-gradient-to-b from-background/95 to-background/98 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Main card */}
        <div className="bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl overflow-hidden">

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
              {STAGES.map((stage, index) => {
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

        {/* Cancel button - below card */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full mt-4 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-card/50 rounded-xl transition-colors border border-transparent hover:border-border/30"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
