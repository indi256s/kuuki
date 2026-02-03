import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane } from 'lucide-react'
import { cn } from '@/lib/utils'

// GLaDOS-style rotating phrases with aviation humor
// Mix of helpful, sarcastic, and occasional Russian aviation slang
const PROGRESS_PHRASES = [
  { en: 'Deploying very tiny flight attendants...', ru: 'Отправляем крошечных бортпроводников...' },
  { en: 'Asking the clouds for directions...', ru: 'Спрашиваем у облаков дорогу...' },
  { en: 'Your luggage is definitely not lost. Probably.', ru: 'Ваш багаж точно не потерян. Наверное.' },
  { en: 'Please keep your expectations in the upright position.', ru: 'Пожалуйста, держите ожидания в вертикальном положении.' },
  { en: 'Scanning for flight data at cruising altitude...', ru: 'Сканируем данные на крейсерской высоте...' },
  { en: 'Esche nemnozhko... (Just a tiny bit more...)', ru: 'Ещё немножко...' },
  { en: 'Cross-checking with air traffic control...', ru: 'Сверяемся с диспетчерской...' },
  { en: 'This is your captain speaking. Please wait.', ru: 'Говорит командир экипажа. Ожидайте.' },
  { en: 'Calibrating the artificial horizon...', ru: 'Калибруем авиагоризонт...' },
  { en: 'The boarding pass is mightier than the sword.', ru: 'Посадочный талон сильнее меча.' },
  { en: 'Checking if the autopilot is awake...', ru: 'Проверяем, не спит ли автопилот...' },
  { en: 'Poехали! (Let\'s go!)', ru: 'Поехали!' },
  { en: 'Consulting the flight manual... or just guessing.', ru: 'Читаем инструкцию... или просто угадываем.' },
  { en: 'Your data is now boarding at gate AI-7...', ru: 'Ваши данные на посадке у гейта AI-7...' },
  { en: 'Almost there. The fasten seatbelt sign is still on.', ru: 'Почти готово. Табло "пристегните ремни" ещё горит.' },
]

interface FlightProgressModalProps {
  isOpen: boolean
  onCancel?: () => void
  inputType?: 'text' | 'pdf' | 'image'
}

type AnimationStage = 'depart' | 'cruise' | 'arrive'

export function FlightProgressModal({ isOpen, onCancel, inputType = 'text' }: FlightProgressModalProps) {
  const { t, i18n } = useTranslation()
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [stage, setStage] = useState<AnimationStage>('depart')

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Rotate phrases every 3.5 seconds
  useEffect(() => {
    if (!isOpen) return

    // Randomize starting phrase
    setPhraseIndex(Math.floor(Math.random() * PROGRESS_PHRASES.length))

    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % PROGRESS_PHRASES.length)
    }, 3500)

    return () => clearInterval(interval)
  }, [isOpen])

  // Progress through animation stages
  useEffect(() => {
    if (!isOpen || prefersReducedMotion) return

    setStage('depart')

    // Depart -> Cruise after 2s
    const cruiseTimeout = setTimeout(() => setStage('cruise'), 2000)

    // We'll stay in cruise until done (arrive is triggered externally or on success)
    // For now, just cycle cruise -> depart periodically to keep animation fresh
    const cycleInterval = setInterval(() => {
      setStage(prev => prev === 'cruise' ? 'depart' : 'cruise')
    }, 8000)

    return () => {
      clearTimeout(cruiseTimeout)
      clearInterval(cycleInterval)
    }
  }, [isOpen, prefersReducedMotion])

  if (!isOpen) return null

  const currentPhrase = PROGRESS_PHRASES[phraseIndex]
  const displayPhrase = i18n.language === 'ru' ? currentPhrase.ru : currentPhrase.en

  // Contextual subtitle based on input type
  const subtitle = inputType === 'text'
    ? t('import.parsing.analyzingText', 'Analyzing your flight data...')
    : t('import.parsing.analyzingDocument', 'Reading your document...')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - semi-transparent to show import UI behind */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal content */}
      <div className="relative z-10 flex flex-col items-center p-8 max-w-md mx-4">
        {/* Plane animation container */}
        <div className="relative w-48 h-32 mb-6">
          {/* Runway/horizon line */}
          <div className="absolute bottom-4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Animated plane */}
          <div
            className={cn(
              'absolute transition-all duration-1000 ease-out',
              prefersReducedMotion ? 'bottom-8 left-1/2 -translate-x-1/2' : [
                stage === 'depart' && 'animate-flight-depart',
                stage === 'cruise' && 'animate-flight-cruise',
                stage === 'arrive' && 'animate-flight-arrive',
              ]
            )}
          >
            <Plane
              className={cn(
                'w-12 h-12 text-primary transition-transform duration-500',
                !prefersReducedMotion && stage === 'depart' && '-rotate-12',
                !prefersReducedMotion && stage === 'cruise' && 'rotate-0',
                !prefersReducedMotion && stage === 'arrive' && 'rotate-12',
              )}
              strokeWidth={1.5}
            />
          </div>

          {/* Cloud accents (reduced motion: static) */}
          {!prefersReducedMotion && (
            <>
              <div className="absolute top-2 left-8 w-16 h-4 bg-muted/30 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
              <div className="absolute top-6 right-6 w-12 h-3 bg-muted/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-12 left-4 w-10 h-3 bg-muted/25 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </>
          )}
        </div>

        {/* Subtitle */}
        <p className="text-lg font-medium text-foreground mb-2 text-center">
          {subtitle}
        </p>

        {/* Rotating phrase with fade transition */}
        <div className="h-12 flex items-center justify-center">
          <p
            key={phraseIndex}
            className={cn(
              'text-sm text-muted-foreground text-center max-w-xs',
              !prefersReducedMotion && 'animate-fade-in'
            )}
          >
            {displayPhrase}
          </p>
        </div>

        {/* Time hint */}
        <p className="text-xs text-muted-foreground/70 mt-4">
          {t('import.parsing.aiHint', 'AI is extracting flight details. This may take 10-20 seconds.')}
        </p>

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
