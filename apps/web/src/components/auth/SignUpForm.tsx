import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { checkInviteCode } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check } from 'lucide-react'

interface SignUpFormProps {
  onSuccess?: () => void
  onSignInClick?: () => void
}

export function SignUpForm({ onSuccess, onSignInClick }: SignUpFormProps) {
  const { t } = useTranslation()
  const { signUp, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [codeValid, setCodeValid] = useState<boolean | null>(null)

  // Validate invite code on blur
  const handleCodeBlur = async () => {
    if (!inviteCode.trim()) {
      setCodeValid(null)
      return
    }

    setIsCheckingCode(true)
    const valid = await checkInviteCode(inviteCode)
    setCodeValid(valid)
    setIsCheckingCode(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'))
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError(t('auth.passwordTooShort', 'Password must be at least 8 characters'))
      return
    }

    const result = await signUp(email, password, inviteCode)

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
        <Label htmlFor="inviteCode">{t('auth.inviteCode', 'Invite Code')}</Label>
        <Input
          id="inviteCode"
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value.toUpperCase())
            setCodeValid(null)
          }}
          onBlur={handleCodeBlur}
          placeholder="KUUKI-XXXX-word-word"
          className={`font-mono text-sm ${
            codeValid === true
              ? 'border-success'
              : codeValid === false
              ? 'border-destructive'
              : ''
          }`}
          required
          disabled={isLoading}
        />
        {isCheckingCode && (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        )}
        {codeValid === true && (
          <p className="text-xs text-success flex items-center gap-1">
            <Check className="w-3 h-3" />
            {t('auth.codeValid', 'Valid invite code')}
          </p>
        )}
        {codeValid === false && (
          <p className="text-xs text-destructive">
            {t('auth.codeInvalid', 'Invalid or expired invite code')}
          </p>
        )}
      </div>

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
          minLength={8}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading || codeValid === false} className="w-full">
        {isLoading ? t('common.loading') : t('auth.createAccount')}
      </Button>

      {onSignInClick && (
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.haveAccount', 'Already have an account?')}{' '}
          <button
            type="button"
            onClick={onSignInClick}
            className="text-primary hover:underline"
          >
            {t('auth.signIn')}
          </button>
        </p>
      )}
    </form>
  )
}
