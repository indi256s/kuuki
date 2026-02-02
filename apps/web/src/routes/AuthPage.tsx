import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Languages, Plane, Globe2, BarChart3, Shield } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm } from '@/components/auth'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { AccentPicker, type AccentColor } from '@/components/common/AccentPicker'

type AuthMode = 'register' | 'signin'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>('register')
  const [accentColor, setAccentColor] = useState<AccentColor>('amber')

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  // Feature cards data - human-centric copy
  const features = [
    {
      icon: Plane,
      title: t('auth.features.import.title', 'Drop & Done'),
      description: t('auth.features.import.description', 'Just drop your boarding pass. We handle the rest.'),
    },
    {
      icon: Globe2,
      title: t('auth.features.map.title', 'Your World Map'),
      description: t('auth.features.map.description', 'Watch it fill up, flight by flight.'),
    },
    {
      icon: BarChart3,
      title: t('auth.features.stats.title', 'Friendly Stats'),
      description: t('auth.features.stats.description', 'Interesting numbers, no bragging rights.'),
    },
    {
      icon: Shield,
      title: t('auth.features.privacy.title', 'Truly Yours'),
      description: t('auth.features.privacy.description', 'Your data stays yours. No ads, no tracking.'),
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#09090b] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-50 dark:opacity-30" />

      {/* Top Controls - Fixed Position */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-50">
        <AccentPicker value={accentColor} onChange={setAccentColor} />
        <div className="w-px h-5 bg-neutral-300 dark:bg-white/10" />
        <ThemeToggle />
        <Button
          variant="ghost"
          onClick={toggleLanguage}
          className="text-neutral-500 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white h-9 w-9 p-0 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5"
        >
          <Languages className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content - Centered Column */}
      <div className="w-full max-w-lg relative z-10 flex flex-col gap-6">
        {/* Branding */}
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tighter text-neutral-800 dark:text-white/90 mb-1">
            <span className="text-primary">Ku</span>uki
          </h1>
          <p className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide">
            {t('common.tagline', 'Every journey, remembered')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl overflow-hidden shadow-xl dark:shadow-2xl bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-neutral-200/50 dark:border-white/[0.06] animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {mode === 'register' ? t('auth.joinKuuki', 'Join Kuuki') : t('auth.welcomeBack', 'Welcome back')}
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                  {mode === 'register'
                    ? t('auth.inviteRequired', 'Enter your invite code to begin.')
                    : t('auth.signInSubtitle', 'Sign in to access your flight history.')
                  }
                </p>
              </div>

              {mode === 'register' ? (
                <RegisterForm
                  onSuccess={handleSuccess}
                  onSignInClick={() => setMode('signin')}
                />
              ) : (
                <SignInForm
                  onSuccess={handleSuccess}
                  onSignUpClick={() => setMode('register')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Features Grid - 2x2 */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group/item flex flex-col gap-2 p-4 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-neutral-200/50 dark:border-white/[0.05] backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/[0.06] hover:border-neutral-300/50 dark:hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-0.5"
              style={{ animationDelay: `${150 + i * 50}ms` }}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-medium text-neutral-800 dark:text-white/90 text-sm leading-tight">{feature.title}</h3>
                <p className="text-xs text-neutral-500 dark:text-white/40 leading-relaxed mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center animate-fade-in" style={{ animationDelay: '150ms' }}>
          <p className="text-xs text-neutral-400 dark:text-white/25">
            {t('common.tagline')} • v1.0.0
          </p>
        </div>
      </div>
    </div>
  )
}
