import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe2, X } from 'lucide-react'
import { RouteMap } from './RouteMap'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MapCollapsibleProps {
  className?: string
}

/**
 * MapCollapsible - Mobile-optimized map preview that expands to fullscreen.
 *
 * Design decisions:
 * - Collapsed: Shows a tappable card with globe icon + "Route Map" text
 * - Expanded: Fullscreen Dialog containing the interactive RouteMap
 * - Auto-closes when navigating to another route (tab bar interaction)
 * - Uses cached flight data (no fresh fetch on expand)
 * - Adapts naturally to landscape orientation via Dialog's default behavior
 */
export function MapCollapsible({ className }: MapCollapsibleProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  // Auto-close dialog on navigation (e.g., tab bar tap)
  useEffect(() => {
    if (isOpen) {
      setIsOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <>
      {/* Collapsed preview card */}
      <button
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center gap-4 p-4 rounded-xl',
          'bg-card border border-border/50',
          'hover:bg-secondary/50 hover:border-border',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'transition-all duration-200',
          'text-left',
          className
        )}
        aria-label={t('dashboard.routeMap', 'Route Map')}
      >
        {/* Globe icon with gradient background */}
        <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <Globe2 className="w-6 h-6 text-primary" />
        </div>

        {/* Title and subtitle */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">
            {t('dashboard.routeMap', 'Route Map')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.tapToExpand', 'Tap to view full map')}
          </p>
        </div>

        {/* Expand indicator */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-secondary/50">
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
            />
          </svg>
        </div>
      </button>

      {/* Fullscreen map dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn(
            'max-w-none w-full h-full max-h-full',
            'p-0 border-0 rounded-none',
            'bg-background',
            // Override default dialog positioning for fullscreen
            'fixed inset-0 translate-x-0 translate-y-0'
          )}
          // Prevent default close button since we have our own
          aria-describedby={undefined}
        >
          {/* Visually hidden title for accessibility */}
          <DialogTitle className="sr-only">
            {t('dashboard.routeMap', 'Route Map')}
          </DialogTitle>

          {/* Close button */}
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Full-height map */}
          <div className="w-full h-full">
            <RouteMap height="100%" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
