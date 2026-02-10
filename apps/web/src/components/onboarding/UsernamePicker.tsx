import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Facehash } from 'facehash'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FACEHASH_COLORS } from '@/components/common/UserAvatar'

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
        <div className="flex justify-center mb-4 animate-fade-up">
          <div className="rounded-full overflow-hidden" style={{ width: 80, height: 80 }}>
            <Facehash
              name={normalizedUsername || '?'}
              size={80}
              colors={FACEHASH_COLORS}
              variant="gradient"
              intensity3d="subtle"
              showInitial={false}
              interactive
              enableBlink
            />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          {t('onboarding.username.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('onboarding.username.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Input */}
        <div>
          <label htmlFor="username" className="sr-only">
            {t('profile.username')}
          </label>
          <Input
            id="username"
            type="text"
            value={rawInput}
            onChange={handleInputChange}
            placeholder={t('onboarding.username.placeholder')}
            autoComplete="off"
            className={hasError ? 'border-destructive' : ''}
          />

          {/* Error message */}
          {hasError && (
            <p className="mt-2 text-sm text-destructive">
              {validationError || serverError}
            </p>
          )}
        </div>

        {/* Preview */}
        {normalizedUsername && !validationError && (
          <Card className="border-border/50 bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">
                {t('onboarding.username.preview')}
              </p>
              <p className="font-mono">
                kuuki.app/@{normalizedUsername}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Live normalization preview */}
        {rawInput && normalizedUsername !== rawInput.toLowerCase().trim() && (
          <p className="text-sm text-muted-foreground">
            Will be saved as: <span className="font-mono">{normalizedUsername}</span>
          </p>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full"
        >
          {isSubmitting ? t('common.loading') : t('onboarding.username.continue')}
        </Button>
      </form>
    </div>
  )
}
