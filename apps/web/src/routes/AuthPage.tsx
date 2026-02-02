import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignUpForm, SignInForm } from '@/components/auth'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plane, Languages } from 'lucide-react'

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
        <Button variant="ghost" onClick={toggleLanguage} className="gap-2">
          <Languages className="w-4 h-4" />
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </Button>
      </header>

      {/* Main content - Split layout */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-12 items-center">

          {/* Branding side - Katakana */}
          <div className="flex flex-col items-center lg:items-end justify-center">
            {/* Mobile: horizontal layout */}
            <div className="lg:hidden flex flex-col items-center gap-2 mb-6">
              <span className="text-5xl font-bold tracking-wider animate-text-flow">
                クウキ
              </span>
              <span className="text-sm text-muted-foreground tracking-wide">
                {t('common.tagline')}
              </span>
            </div>

            {/* Desktop: vertical layout */}
            <div className="hidden lg:flex flex-col items-end gap-4">
              <span className="writing-vertical text-7xl font-bold tracking-wider animate-text-flow leading-tight">
                クウキ
              </span>
              <span className="text-sm text-muted-foreground max-w-[120px] text-right leading-relaxed">
                {t('common.tagline')}
              </span>
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-sm animate-fade-up">
            <Card className="border-border/50">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Plane className="w-6 h-6 text-primary" strokeWidth={2} />
                </div>
                <CardTitle className="text-2xl tracking-tight">
                  {mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>

          {/* Empty spacer for desktop grid balance */}
          <div className="hidden lg:block" />
        </div>
      </main>
    </div>
  )
}
