import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Prompts users to reload when a new app version is available.
 * Uses vite-plugin-pwa's useRegisterSW hook to detect service worker updates.
 *
 * Shows a subtle bottom banner that doesn't interrupt workflow but ensures
 * users know to refresh for the latest features and fixes.
 */
export function ReloadPrompt() {
  const { t } = useTranslation()

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 1000)
      }
      console.log('[SW] Registered:', swUrl)
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error)
    },
  })

  const handleReload = () => {
    updateServiceWorker(true)
  }

  const handleDismiss = () => {
    setNeedRefresh(false)
  }

  if (!needRefresh) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-2.5 rounded-full',
        'bg-foreground text-background shadow-lg',
        'animate-fade-up'
      )}
    >
      <span className="text-sm font-medium">
        {t('app.updateAvailable', 'New version available')}
      </span>

      <button
        onClick={handleReload}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('app.reload', 'Reload')}
      </button>

      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-background/20 transition-colors"
        aria-label={t('common.dismiss', 'Dismiss')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
