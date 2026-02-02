import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Languages, Plane, Globe2, BarChart3, Shield } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm } from '@/components/auth'
import { FlyingPlanes } from '@/components/auth/FlyingPlanes'
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
    <div className="min-h-screen bg-neutral-50 dark:bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-50 dark:opacity-30" />

      {/* Main Card */}
      <div className="w-full max-w-[1100px] min-h-[600px] lg:h-[700px] rounded-[32px] grid lg:grid-cols-[40%_60%] overflow-hidden shadow-xl dark:shadow-2xl relative z-10 transition-all duration-500 bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-neutral-200/50 dark:border-white/[0.06]">

        {/* Left Side: Visual / Brand */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden group bg-neutral-100/50 dark:bg-transparent">
          {/* Dynamic Background for Left Panel */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 dark:from-primary/10 to-transparent opacity-80 dark:opacity-50 z-0" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] dark:opacity-20 z-0 mix-blend-overlay" />

          {/* Ascending planes animation - Matrix departures board effect */}
          <FlyingPlanes />

          {/* Top Branding */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold tracking-tighter text-neutral-800 dark:text-white/90 mb-2">
              <span className="text-primary">Ku</span>uki
            </h1>
            <p className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide">
              {t('common.tagline', 'Every journey, remembered')}
            </p>
          </div>

          {/* Center Visual Feature - Japanese Typography */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
            <span className="text-[12rem] font-bold leading-none text-neutral-900/[0.03] dark:text-white/[0.03] writing-vertical select-none font-display tracking-widest">
              クウキ
            </span>
          </div>

          {/* Bottom Features Carousel */}
          <div className="relative z-10 grid gap-3">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group/item flex items-center gap-4 p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 hover:border-neutral-300/50 dark:hover:border-white/10 transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm dark:shadow-none"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-medium text-neutral-800 dark:text-white/90 text-sm leading-tight mb-0.5">{feature.title}</h3>
                  <p className="text-xs text-neutral-500 dark:text-white/50">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="relative flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-12 bg-white/50 dark:bg-black/20 backdrop-blur-xl">
          {/* Top Right Controls */}
          <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
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

          <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {mode === 'register' ? t('auth.joinKuuki', 'Join Kuuki') : t('auth.welcomeBack', 'Welcome back')}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-base">
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

            <div className="pt-8 border-t border-neutral-200 dark:border-white/5 text-center lg:text-left">
              <p className="text-xs text-neutral-400 dark:text-white/30">
                {t('common.tagline')} • v1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
