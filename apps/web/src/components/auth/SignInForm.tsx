import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'

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
        <div className="p-3 bg-emergency-muted text-emergency rounded-lg text-sm">
          {error}
        </div>
      )}

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
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </button>

      {onSignUpClick && (
        <p className="text-center text-sm text-ink-muted">
          {t('auth.newUser')}{' '}
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-runway hover:underline"
          >
            {t('auth.createAccount')}
          </button>
        </p>
      )}
    </form>
  )
}
