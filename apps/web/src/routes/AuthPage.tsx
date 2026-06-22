import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Languages, HelpCircle } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm, RotatingTagline } from '@/components/auth'
import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import { AppearanceToggle } from '@/components/common/AppearanceToggle'
import { WhatIsKuukiDialog } from '@/components/auth/WhatIsKuukiDialog'

type AuthMode = 'register' | 'signin'

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-primary">Ku</span>uki
    </span>
  )
}

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'signin' ? 'signin' : 'register'
  )
  const [showAbout, setShowAbout] = useState(false)

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  const taglines = t('auth.taglines', { returnObjects: true }) as string[]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">

      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-50 dark:opacity-30" />

      {/* Mobile: Atmospheric background elements */}
      <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-0">
          <span
            className="text-4xl font-bold font-display tracking-[0.3em] select-none text-primary/40 dark:text-primary/50"
            aria-hidden="true"
          >
            くうき
          </span>
        </div>
        <div className="opacity-90">
          <PlaneAnimation />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[1100px] min-h-[600px] lg:h-[700px] rounded-2xl grid lg:grid-cols-[40%_60%] overflow-hidden relative z-10 transition-all duration-500 bg-card border border-border/50">

        {/* Left Side: Visual / Brand (Desktop only) */}
        <div className="relative hidden lg:flex flex-col justify-start p-12 overflow-hidden group bg-muted/50 dark:bg-muted/20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 dark:from-primary/10 to-transparent opacity-80 dark:opacity-50 z-0" />

          <PlaneAnimation />

          <div className="relative z-10">
            <p className="text-4xl font-bold tracking-tighter text-foreground mb-3" aria-hidden="true">
              <BrandMark />
            </p>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
            <span
              className="text-[12rem] font-bold leading-none writing-vertical select-none font-display tracking-widest text-primary/15 dark:text-primary/20"
              aria-hidden="true"
            >
              くうき
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <main id="main-content" tabIndex={-1} className="relative flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-12 bg-card">
          {/* Single page title */}
          <h1 className="text-3xl font-bold tracking-tighter text-foreground mb-8 text-center">
            <BrandMark />
          </h1>

          {/* Top Right Controls */}
          <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
            <AppearanceToggle />
            <div className="hidden lg:block w-px h-5 bg-border" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAbout(true)}
              className="text-muted-foreground hover:text-primary rounded-full hover:bg-muted transition-colors"
              aria-label="What is Kuuki?"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              aria-label={t('settings.toggleLanguage', 'Toggle language')}
              className="hidden lg:flex text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            >
              <Languages className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
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

          <div className="mt-8 text-center px-4">
            <RotatingTagline
              items={taglines}
              interval={6000}
              className="text-muted-foreground text-sm font-medium tracking-wide justify-center"
            />
          </div>
        </main>
      </div>

      <WhatIsKuukiDialog open={showAbout} onOpenChange={setShowAbout} />
    </div>
  )
}
