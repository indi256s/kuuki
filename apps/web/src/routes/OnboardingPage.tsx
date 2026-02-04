import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { UsernamePicker } from '@/components/onboarding/UsernamePicker'
import { ImportCTA } from '@/components/onboarding/ImportCTA'
import { updateProfile } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Plane, Languages } from 'lucide-react'

type OnboardingStep = 'username' | 'import'

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const [step, setStep] = useState<OnboardingStep>(() => {
    // If user already has a username, skip to import step
    return profile?.username ? 'import' : 'username'
  })

  const handleUsernameSubmit = useCallback(
    async (username: string) => {
      if (!user) {
        return { success: false, error: t('errors.unauthorized') }
      }

      const result = await updateProfile(user.id, { username })

      if (result.success) {
        await refreshProfile()
        setStep('import')
      }

      return result
    },
    [user, refreshProfile, t]
  )

  const handleImport = useCallback(() => {
    navigate('/import')
  }, [navigate])

  const handleManual = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  const handleSkip = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {t('common.appName')}
          </span>
        </Link>
        <Button
          variant="ghost"
          onClick={toggleLanguage}
          aria-label={t('settings.toggleLanguage', 'Toggle language')}
          className="gap-2"
        >
          <Languages className="w-4 h-4" />
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="animate-fade-up">
          {step === 'username' && (
            <UsernamePicker onSubmit={handleUsernameSubmit} />
          )}
          {step === 'import' && (
            <ImportCTA
              onImport={handleImport}
              onManual={handleManual}
              onSkip={handleSkip}
            />
          )}
        </div>
      </main>

      {/* Step indicator */}
      <footer className="p-4">
        <div
          className="flex justify-center gap-2"
          role="progressbar"
          aria-valuenow={step === 'username' ? 1 : 2}
          aria-valuemin={1}
          aria-valuemax={2}
          aria-label={t('onboarding.progress', 'Step {{current}} of 2', { current: step === 'username' ? 1 : 2 })}
        >
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              step === 'username' ? 'bg-primary' : 'bg-border'
            }`}
            aria-hidden="true"
          />
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              step === 'import' ? 'bg-primary' : 'bg-border'
            }`}
            aria-hidden="true"
          />
        </div>
      </footer>
    </div>
  )
}
