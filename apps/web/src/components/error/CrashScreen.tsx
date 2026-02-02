import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface CrashScreenProps {
  error?: Error
  resetError?: () => void
}

/**
 * Minimal crash screen for route-level errors.
 *
 * Design: Calm, minimal, professional.
 * - No illustration (per requirements)
 * - Clear message
 * - Reload action
 * - Dev mode shows error details
 */
export function CrashScreen({ error, resetError }: CrashScreenProps) {
  const { t } = useTranslation()
  const isDev = import.meta.env.DEV

  const handleReload = () => {
    if (resetError) {
      resetError()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center animate-fade-up">
        {/* Icon - simple, calm */}
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <div className="w-8 h-8 rounded-full border-4 border-muted-foreground/30 border-t-primary animate-spin" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
          {t('errors.crashScreen.title', 'Something went wrong')}
        </h1>

        {/* Message */}
        <p className="text-muted-foreground mb-8">
          {t(
            'errors.crashScreen.message',
            'We encountered an unexpected error. Your data is safe.'
          )}
        </p>

        {/* Action */}
        <Button onClick={handleReload} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('errors.crashScreen.reload', 'Reload Page')}
        </Button>

        {/* Dev mode error details */}
        {isDev && error && (
          <div className="mt-8 p-4 bg-muted rounded-lg text-left overflow-auto max-h-48">
            <p className="text-xs font-mono text-muted-foreground mb-2">
              Development Only:
            </p>
            <pre className="text-xs font-mono text-destructive whitespace-pre-wrap break-words">
              {error.message}
            </pre>
            {error.stack && (
              <pre className="text-xs font-mono text-muted-foreground mt-2 whitespace-pre-wrap break-words">
                {error.stack}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
