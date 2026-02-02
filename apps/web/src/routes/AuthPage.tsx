import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Languages, Plane, Globe2, BarChart3, Shield } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm } from '@/components/auth'

type AuthMode = 'register' | 'signin'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>('register')

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  // Feature cards data - embodies Kuuki's soul
  const features = [
    {
      icon: Plane,
      title: t('landing.features.tracking.title', 'Flight Tracking'),
      description: t('auth.features.tracking', 'AI-powered import from boarding passes'),
    },
    {
      icon: Globe2,
      title: t('landing.features.places.title', 'Visited Places'),
      description: t('auth.features.places', 'Build your personal nomad passport'),
    },
    {
      icon: BarChart3,
      title: t('landing.features.stats.title', 'Travel Stats'),
      description: t('auth.features.stats', 'Percentiles, not pressure'),
    },
    {
      icon: Shield,
      title: t('auth.features.privacy.title', 'Private by Default'),
      description: t('auth.features.privacy.description', 'Your journeys, your control'),
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      {/* Minimal header - just language toggle */}
      <header className="absolute top-0 right-0 p-4 z-10">
        <Button variant="ghost" onClick={toggleLanguage} className="gap-2 text-muted-foreground hover:text-foreground h-9 px-3">
          <Languages className="w-4 h-4" />
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Branding + Form section */}
        <div className="w-full max-w-4xl grid lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-16 items-center mb-12 lg:mb-16">

          {/* Branding side - Katakana */}
          <div className="flex flex-col items-center lg:items-end justify-center">
            {/* Mobile: horizontal layout */}
            <div className="lg:hidden flex flex-col items-center gap-3 mb-4">
              <span className="text-6xl font-bold tracking-wider animate-text-flow">
                クウキ
              </span>
              <span className="text-sm text-muted-foreground tracking-wide">
                {t('common.tagline')}
              </span>
            </div>

            {/* Desktop: vertical layout with more presence */}
            <div className="hidden lg:flex flex-col items-end gap-6">
              <span className="writing-vertical text-8xl font-bold tracking-wider animate-text-flow leading-tight">
                クウキ
              </span>
              <span className="text-sm text-muted-foreground max-w-[140px] text-right leading-relaxed">
                {t('common.tagline')}
              </span>
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-sm animate-fade-up">
            <Card className="border-border/50 shadow-lg shadow-primary/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Plane className="w-6 h-6 text-primary" strokeWidth={2} />
                </div>
                <CardTitle className="text-xl tracking-tight">
                  {mode === 'register' ? t('auth.joinKuuki', 'Join Kuuki') : t('auth.welcomeBack', 'Welcome Back')}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'register'
                    ? t('auth.inviteRequired', 'Invite code required')
                    : t('auth.signInSubtitle', 'Sign in to your flight vault')
                  }
                </p>
              </CardHeader>
              <CardContent className="pt-2">
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
              </CardContent>
            </Card>
          </div>

          {/* Empty spacer for desktop grid balance */}
          <div className="hidden lg:block" />
        </div>

        {/* Feature cards - philosophy showcase */}
        <div className="w-full max-w-3xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-4 rounded-xl bg-card/50 border border-border/30 hover:border-border/60 hover:bg-card transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-200">
                  <feature.icon className="w-[18px] h-[18px] text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-sm mb-1 tracking-tight">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-muted-foreground/60">
          {t('auth.inviteOnlyNote', 'Kuuki is invite-only to maintain a quality community')}
        </p>
      </footer>
    </div>
  )
}
