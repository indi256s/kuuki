import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { checkInviteCode } from '@/lib/auth'

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
        <div className="p-3 bg-emergency-muted text-emergency rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="inviteCode" className="block text-sm font-medium text-ink mb-1">
          {t('auth.inviteCode', 'Invite Code')}
        </label>
        <input
          id="inviteCode"
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value.toUpperCase())
            setCodeValid(null)
          }}
          onBlur={handleCodeBlur}
          placeholder="KUUKI-XXXX-word-word"
          className={`w-full px-3 py-2 border rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway font-mono text-sm ${
            codeValid === true
              ? 'border-cleared'
              : codeValid === false
              ? 'border-emergency'
              : 'border-edge-strong'
          }`}
          required
          disabled={isLoading}
        />
        {isCheckingCode && (
          <p className="mt-1 text-xs text-ink-muted">{t('common.loading')}</p>
        )}
        {codeValid === true && (
          <p className="mt-1 text-xs text-cleared">
            {t('auth.codeValid', 'Valid invite code')}
          </p>
        )}
        {codeValid === false && (
          <p className="mt-1 text-xs text-emergency">
            {t('auth.codeInvalid', 'Invalid or expired invite code')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
          {t('auth.email', 'Email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
          {t('auth.password', 'Password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
          required
          minLength={8}
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
          {t('auth.confirmPassword', 'Confirm Password')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway"
          required
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || codeValid === false}
        className="w-full py-2 px-4 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? t('common.loading') : t('auth.createAccount')}
      </button>

      {onSignInClick && (
        <p className="text-center text-sm text-ink-muted">
          {t('auth.haveAccount', 'Already have an account?')}{' '}
          <button
            type="button"
            onClick={onSignInClick}
            className="text-runway hover:underline"
          >
            {t('auth.signIn')}
          </button>
        </p>
      )}
    </form>
  )
}
