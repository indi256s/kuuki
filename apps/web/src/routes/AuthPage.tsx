import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Languages, Plane, Globe2, BarChart3, Shield } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm } from '@/components/auth'
import { AccentPicker } from '@/components/common/AccentPicker'

type AuthMode = 'register' | 'signin'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>('register')

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  // Human-centric features with updated copy
  const features = [
    {
      icon: Plane,
      title: t('landing.features.tracking.title', 'Effortless Tracking'),
      description: t('auth.features.tracking', 'Just drop your boarding pass. We handle the rest.'),
    },
    {
      icon: Globe2,
      title: t('landing.features.places.title', 'World Map'),
      description: t('auth.features.places', 'See your world map fill up, flight by flight.'),
    },
    {
      icon: BarChart3,
      title: t('landing.features.stats.title', 'Deep Insights'),
      description: t('auth.features.stats', 'Uncover patterns in how you travel.'),
    },
    {
      icon: Shield,
      title: t('auth.features.privacy.title', 'Private by Default'),
      description: t('auth.features.privacy.description', 'Your data stays yours. No ads, no tracking.'),
    },
  ]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans text-foreground transition-colors duration-500">
      {/* Background Ambience - Dynamic Accent */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-60" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none opacity-60" />

      {/* Main Glass Card */}
      <div className="w-full max-w-[1200px] min-h-[650px] lg:h-[750px] glass-card rounded-[32px] grid lg:grid-cols-[45%_55%] overflow-hidden shadow-2xl relative z-10 transition-all duration-500 bg-white/40 ring-1 ring-black/5">

        {/* Left Side: Visual / Brand */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-white/40">
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] z-0" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold tracking-tighter text-foreground mb-2 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Plane className="w-5 h-5" />
              </span>
              Kuuki
            </h1>
            <p className="text-muted-foreground font-medium tracking-wide">
              Atmosphere for your journeys
            </p>
          </div>

          {/* Center Visual - Features List (Bigger & Human) */}
          <div className="relative z-10 flex flex-col gap-6 max-w-md">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group flex gap-5 items-start p-4 rounded-2xl hover:bg-white/60 transition-all duration-300"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                  <feature.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom copyright/tag */}
          <div className="relative z-10 opacity-40">
            <span className="text-[5rem] font-bold leading-none text-foreground/[0.05] absolute bottom-[-2rem] left-[-2rem] select-none font-display tracking-widest pointer-events-none">
              クウキ
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="relative flex flex-col justify-center px-8 py-12 lg:px-24 lg:py-12 bg-white/60 backdrop-blur-xl">
          {/* Top Right Controls - Accent Picker */}
          <div className="absolute top-8 right-8 flex items-center gap-3 z-20">
            <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-full border border-black/5 shadow-sm">
              <Button variant="ghost" onClick={toggleLanguage} className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs font-medium rounded-full hover:bg-black/5">
                {currentLanguage === 'en' ? 'EN' : 'RU'}
              </Button>
            </div>
            <AccentPicker />
          </div>

          <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in relative z-10">
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-foreground inline-block">
                {mode === 'register' ? t('auth.joinKuuki', 'Join Kuuki') : t('auth.welcomeBack', 'Welcome back')}
              </h2>
              <p className="text-muted-foreground text-base">
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

            <div className="pt-8 border-t border-black/5 text-center lg:text-left">
              <p className="text-xs text-muted-foreground/50">
                © 2026 Kuuki Flight Vault • v1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
