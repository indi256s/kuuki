import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { useShowcase } from '@/hooks/useShowcase'
import { ShowcaseModal } from '@/components/onboarding/ShowcaseModal'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeatureGrid } from '@/components/landing/FeatureGrid'

export function LandingPage() {
  const { t } = useTranslation()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const { shouldShow, markAsSeen, hasSeen } = useShowcase()

  // Don't render until localStorage check completes
  if (hasSeen === null) {
    return (
      <div className="min-h-screen bg-sky flex items-center justify-center">
        <div className="text-ink-muted">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sky flex flex-col">
      {/* Showcase Modal */}
      {shouldShow && <ShowcaseModal onComplete={markAsSeen} />}

      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="text-xl font-semibold text-ink">
          {t('common.appName')}
        </div>
        <button
          onClick={toggleLanguage}
          className="text-sm text-ink-muted hover:text-ink transition-colors focus-ring rounded px-2 py-1"
        >
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col justify-center">
        <HeroSection />
        <FeatureGrid />
      </main>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-xs text-ink-faint">
          {t('common.tagline')}
        </p>
      </footer>
    </div>
  )
}
