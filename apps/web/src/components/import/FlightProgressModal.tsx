import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane } from 'lucide-react'
import { cn } from '@/lib/utils'

// GLaDOS-style rotating phrases with aviation humor
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

// Six planes with different orbit configurations
const ORBITAL_PLANES = [
  { radius: 100, duration: 8, delay: 0, size: 20, opacity: 0.9, direction: 1 },
  { radius: 120, duration: 12, delay: 2, size: 16, opacity: 0.7, direction: -1 },
  { radius: 85, duration: 10, delay: 4, size: 18, opacity: 0.8, direction: 1 },
  { radius: 140, duration: 15, delay: 1, size: 14, opacity: 0.5, direction: -1 },
  { radius: 110, duration: 9, delay: 3, size: 17, opacity: 0.75, direction: 1 },
  { radius: 130, duration: 11, delay: 5, size: 15, opacity: 0.6, direction: -1 },
]

interface FlightProgressModalProps {
  isOpen: boolean
  onCancel?: () => void
  inputType?: 'text' | 'pdf' | 'image'
}

export function FlightProgressModal({ isOpen, onCancel, inputType = 'text' }: FlightProgressModalProps) {
  const { t, i18n } = useTranslation()
  const [phraseIndex, setPhraseIndex] = useState(0)

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

  if (!isOpen) return null

  const currentPhrase = PROGRESS_PHRASES[phraseIndex]
  const displayPhrase = i18n.language === 'ru' ? currentPhrase.ru : currentPhrase.en

  // Contextual subtitle based on input type
  const subtitle = inputType === 'text'
    ? t('import.parsing.analyzingText', 'Analyzing your flight data...')
    : t('import.parsing.analyzingDocument', 'Reading your document...')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Modal content */}
      <div className="relative z-10 flex flex-col items-center p-8 max-w-lg mx-4">

        {/* Orbital plane animation container */}
        <div className="relative w-80 h-80 mb-8 flex items-center justify-center">

          {/* Orbital rings (visual guides) */}
          {!prefersReducedMotion && (
            <>
              <div className="absolute w-[200px] h-[200px] rounded-full border border-border/20" />
              <div className="absolute w-[240px] h-[240px] rounded-full border border-border/10" />
              <div className="absolute w-[280px] h-[280px] rounded-full border border-border/5" />
            </>
          )}

          {/* Six orbital planes */}
          {ORBITAL_PLANES.map((plane, index) => (
            <div
              key={index}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `orbit-${plane.direction > 0 ? 'cw' : 'ccw'} ${plane.duration}s linear ${plane.delay}s infinite`,
              }}
            >
              <Plane
                className="text-primary absolute"
                style={{
                  width: plane.size,
                  height: plane.size,
                  opacity: plane.opacity,
                  transform: `translateY(-${plane.radius}px) rotate(90deg)`,
                }}
                strokeWidth={1.5}
              />
            </div>
          ))}

          {/* Center content - text overlay */}
          <div className="relative z-10 text-center px-4">
            {/* Main title - LARGER */}
            <h2 className="text-2xl font-semibold text-foreground mb-3 tracking-tight">
              {subtitle}
            </h2>

            {/* Rotating phrase - LARGER */}
            <div className="h-16 flex items-center justify-center">
              <p
                key={phraseIndex}
                className={cn(
                  'text-base text-muted-foreground text-center leading-relaxed',
                  !prefersReducedMotion && 'animate-fade-in'
                )}
              >
                {displayPhrase}
              </p>
            </div>
          </div>
        </div>

        {/* Time hint - slightly larger */}
        <p className="text-sm text-muted-foreground/80 text-center max-w-xs">
          {t('import.parsing.aiHint', 'AI is extracting flight details. This may take 10-20 seconds.')}
        </p>

        {/* Cancel button - more visible */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>

      {/* CSS for orbital animations */}
      <style>{`
        @keyframes orbit-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
