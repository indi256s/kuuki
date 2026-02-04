import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plane, BarChart3, Trophy } from 'lucide-react'

interface ShowcaseModalProps {
  onComplete: () => void
}

const SLIDES = [
  { key: 'slide1', icon: Plane },
  { key: 'slide2', icon: BarChart3 },
  { key: 'slide3', icon: Trophy },
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
  const Icon = slide.icon

  return (
    <Dialog open onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        {/* Accessible title and description for screen readers */}
        <DialogTitle className="sr-only">
          {t(`onboarding.${slide.key}.title`)}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t(`onboarding.${slide.key}.description`)}
        </DialogDescription>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-10 h-10 text-primary" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            {t(`onboarding.${slide.key}.title`)}
          </h2>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed">
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
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentSlide
                    ? 'bg-primary'
                    : 'bg-border hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentSlide ? 'step' : undefined}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="flex-1"
            >
              {t('common.skip')}
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              {isLastSlide ? t('common.done') : t('common.next')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
