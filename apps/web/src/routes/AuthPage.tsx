import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignUpForm, SignInForm } from '@/components/auth'
import { useLanguage } from '@/hooks/useLanguage'

type AuthMode = 'signin' | 'signup'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>('signin')

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-sky flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="text-xl font-semibold text-ink">
          {t('common.appName')}
        </div>
        <button
          onClick={toggleLanguage}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-sky-raised border border-edge rounded-xl p-6 shadow-md">
            <h1 className="text-2xl font-semibold text-ink text-center mb-6">
              {mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
            </h1>

            {mode === 'signin' ? (
              <SignInForm
                onSuccess={handleSuccess}
                onSignUpClick={() => setMode('signup')}
              />
            ) : (
              <SignUpForm
                onSuccess={handleSuccess}
                onSignInClick={() => setMode('signin')}
              />
            )}
          </div>

          <p className="text-center text-xs text-ink-faint mt-4">
            {t('common.tagline')}
          </p>
        </div>
      </main>
    </div>
  )
}
