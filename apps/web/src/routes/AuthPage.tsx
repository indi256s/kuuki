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
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2">
          <Languages className="w-4 h-4" />
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-up">
          <Card className="border-border/50">
            <CardHeader className="text-center pb-4">
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

          <p className="text-center text-xs text-muted-foreground mt-4">
            {t('common.tagline')}
          </p>
        </div>
      </main>
    </div>
  )
}
