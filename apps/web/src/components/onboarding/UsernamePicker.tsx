import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface UsernamePickerProps {
  initialValue?: string
  onSubmit: (username: string) => Promise<{ success: boolean; error?: string }>
}

// Normalize display name to username format
function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove any characters that aren't letters, numbers, or hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
}

// Validate username
function validateUsername(
  username: string,
  t: (key: string) => string
): string | null {
  if (username.length < 3) {
    return t('onboarding.username.tooShort')
  }
  if (username.length > 30) {
    return t('onboarding.username.tooLong')
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) && username.length > 1) {
    return t('onboarding.username.invalid')
  }
  if (!/^[a-z0-9]$/.test(username) && username.length === 1) {
    return t('onboarding.username.invalid')
  }
  return null
}

export function UsernamePicker({ initialValue = '', onSubmit }: UsernamePickerProps) {
  const { t } = useTranslation()
  const [rawInput, setRawInput] = useState(initialValue)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Normalize the input to get the username
  const normalizedUsername = useMemo(
    () => normalizeUsername(rawInput),
    [rawInput]
  )

  // Validate
  const validationError = useMemo(
    () => (normalizedUsername ? validateUsername(normalizedUsername, t) : null),
    [normalizedUsername, t]
  )

  const hasError = validationError || serverError
  const canSubmit = normalizedUsername.length >= 3 && !validationError && !isSubmitting

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRawInput(e.target.value)
      setServerError(null)
    },
    []
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return

      setIsSubmitting(true)
      setServerError(null)

      const result = await onSubmit(normalizedUsername)

      if (!result.success) {
        setServerError(result.error || t('errors.generic'))
      }

      setIsSubmitting(false)
    },
    [canSubmit, normalizedUsername, onSubmit, t]
  )

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-ink mb-2">
          {t('onboarding.username.title')}
        </h1>
        <p className="text-ink-muted">
          {t('onboarding.username.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Input */}
        <div>
          <label htmlFor="username" className="sr-only">
            {t('profile.username')}
          </label>
          <input
            id="username"
            type="text"
            value={rawInput}
            onChange={handleInputChange}
            placeholder={t('onboarding.username.placeholder')}
            autoFocus
            autoComplete="username"
            className={`w-full px-4 py-3 bg-sky-raised border rounded-lg text-ink placeholder:text-ink-faint focus-ring ${
              hasError ? 'border-emergency' : 'border-edge'
            }`}
          />

          {/* Error message */}
          {hasError && (
            <p className="mt-2 text-sm text-emergency">
              {validationError || serverError}
            </p>
          )}
        </div>

        {/* Preview */}
        {normalizedUsername && !validationError && (
          <div className="bg-sky-sunken border border-edge rounded-lg p-4">
            <p className="text-sm text-ink-muted mb-1">
              {t('onboarding.username.preview')}
            </p>
            <p className="font-mono text-ink">
              kuuki.app/@{normalizedUsername}
            </p>
          </div>
        )}

        {/* Live normalization preview */}
        {rawInput && normalizedUsername !== rawInput.toLowerCase().trim() && (
          <p className="text-sm text-ink-muted">
            Will be saved as: <span className="font-mono text-ink">{normalizedUsername}</span>
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full px-4 py-3 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors focus-ring font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('common.loading') : t('onboarding.username.continue')}
        </button>
      </form>
    </div>
  )
}
