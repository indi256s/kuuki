import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface SignInFormProps {
  onSuccess?: () => void
  onSignUpClick?: () => void
}

export function SignInForm({ onSuccess, onSignUpClick }: SignInFormProps) {
  const { t } = useTranslation()
  const { signIn, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = await signIn(email, password)

    if (result.success) {
      onSuccess?.()
    } else {
      setError(result.error || t('errors.generic'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </Button>

      {onSignUpClick && (
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.newUser')}{' '}
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-primary hover:underline"
          >
            {t('auth.createAccount')}
          </button>
        </p>
      )}
    </form>
  )
}
