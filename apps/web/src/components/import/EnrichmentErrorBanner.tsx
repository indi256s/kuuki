import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EnrichmentErrorBannerProps {
  error: string
  onRetry?: () => void
  onSkip?: () => void
  className?: string
}

/**
 * Banner shown when enrichment (Phase 2) fails.
 * Offers retry or skip options.
 */
export function EnrichmentErrorBanner({
  error,
  onRetry,
  onSkip,
  className,
}: EnrichmentErrorBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3 rounded-xl',
        'bg-warning/10 border border-warning/30',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium text-warning-foreground">
            {t('import.enrichment.failed', 'Could not fetch aircraft and timing details')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {error}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            className="h-8 px-3 gap-1.5 text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry', 'Try again')}
          </Button>
        )}
        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="h-8 px-3 gap-1.5 text-sm text-muted-foreground"
          >
            <SkipForward className="w-3.5 h-3.5" />
            {t('import.enrichment.skip', 'Skip and add later')}
          </Button>
        )}
      </div>
    </div>
  )
}
