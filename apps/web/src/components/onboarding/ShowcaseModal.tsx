import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface ShowcaseModalProps {
  onComplete: () => void
}

const SLIDES = [
  { key: 'slide1', icon: '✈️' },
  { key: 'slide2', icon: '📊' },
  { key: 'slide3', icon: '🏆' },
] as const

export function ShowcaseModal({ onComplete }: ShowcaseModalProps) {
  const { t } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1)
    } else {
      onComplete()
    }
  }, [currentSlide, onComplete])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handleDotClick = useCallback((index: number) => {
    setCurrentSlide(index)
  }, [])

  const slide = SLIDES[currentSlide]
  const isLastSlide = currentSlide === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-overlay">
      <div className="bg-sky-raised border border-edge rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="text-5xl mb-6" role="img" aria-label={t(`onboarding.${slide.key}.title`)}>
            {slide.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-ink mb-3">
            {t(`onboarding.${slide.key}.title`)}
          </h2>

          {/* Description */}
          <p className="text-ink-muted leading-relaxed">
            {t(`onboarding.${slide.key}.description`)}
          </p>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          {/* Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2 h-2 rounded-full transition-colors focus-ring ${
                  index === currentSlide
                    ? 'bg-runway'
                    : 'bg-edge-strong hover:bg-ink-faint'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentSlide ? 'step' : undefined}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-2.5 text-ink-muted hover:text-ink transition-colors focus-ring rounded-lg"
            >
              {t('common.skip')}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-2.5 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors focus-ring font-medium"
            >
              {isLastSlide ? t('common.done') : t('common.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
