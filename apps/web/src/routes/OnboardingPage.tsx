import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { UsernamePicker } from '@/components/onboarding/UsernamePicker'
import { ImportCTA } from '@/components/onboarding/ImportCTA'
import { updateProfile } from '@/lib/auth'

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
    // Navigate to import page (to be implemented)
    navigate('/dashboard')
  }, [navigate])

  const handleManual = useCallback(() => {
    // Navigate to add flight page (to be implemented)
    navigate('/dashboard')
  }, [navigate])

  const handleSkip = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  return (
    <div className="min-h-screen bg-sky flex flex-col">
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
      <main className="flex-1 flex items-center justify-center p-4">
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
      </main>

      {/* Step indicator */}
      <footer className="p-4">
        <div className="flex justify-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              step === 'username' ? 'bg-runway' : 'bg-edge-strong'
            }`}
          />
          <div
            className={`w-2 h-2 rounded-full ${
              step === 'import' ? 'bg-runway' : 'bg-edge-strong'
            }`}
          />
        </div>
      </footer>
    </div>
  )
}
