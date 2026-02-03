import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane, Globe2, Clock, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface UnlockToastProps {
  tier: string | null
  onDismiss: () => void
}

const TIER_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    colorClass: string
    glowClass: string
    titleKey: string
  }
> = {
  aviaGeek: {
    icon: Plane,
    colorClass: 'from-primary to-primary/80',
    glowClass: 'shadow-[0_0_60px_rgba(var(--primary),0.4)]',
    titleKey: 'stats.aviaGeekLabel',
  },
  countryGeek: {
    icon: Globe2,
    colorClass: 'from-chart-2 to-chart-2/80',
    glowClass: 'shadow-[0_0_60px_rgba(34,197,94,0.4)]',
    titleKey: 'stats.countryGeekLabel',
  },
  duration: {
    icon: Clock,
    colorClass: 'from-chart-4 to-chart-4/80',
    glowClass: 'shadow-[0_0_60px_rgba(234,179,8,0.4)]',
    titleKey: 'stats.timeGeekLabel',
  },
}

export function UnlockToast({ tier, onDismiss }: UnlockToastProps) {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (tier) {
      // Check localStorage to avoid showing twice for same unlock
      const shownKey = `kuuki-unlock-shown-${tier}`
      if (localStorage.getItem(shownKey)) {
        onDismiss()
        return
      }

      // Show the toast
      setIsVisible(true)
      localStorage.setItem(shownKey, 'true')

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss()
      }, 5000)

      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [tier])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      setIsExiting(false)
      onDismiss()
    }, 300)
  }

  if (!tier || !isVisible) return null

  const config = TIER_CONFIG[tier]
  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'animate-[toast-slide-up_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]',
        isExiting && 'animate-[toast-slide-down_0.3s_ease-in_forwards]'
      )}
    >
      <div
        className={cn(
          'relative flex items-center gap-4 px-5 py-4 rounded-2xl',
          'bg-card border border-border/50',
          'shadow-2xl backdrop-blur-xl',
          config.glowClass
        )}
      >
        {/* Animated background gradient */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl opacity-10',
            'bg-gradient-to-r',
            config.colorClass,
            'animate-pulse'
          )}
        />

        {/* Icon with sparkle effect */}
        <div className="relative">
          <div
            className={cn(
              'p-3 rounded-xl bg-gradient-to-br',
              config.colorClass
            )}
          >
            <Icon className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <Sparkles
            className={cn(
              'absolute -top-1 -right-1 w-4 h-4 text-yellow-400',
              'animate-[sparkle_1s_ease-in-out_infinite]'
            )}
          />
        </div>

        {/* Text content */}
        <div className="relative">
          <p className="text-sm font-semibold">
            {t('stats.unlock.title', '🎉 New tier unlocked!')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(config.titleKey)} {t('stats.unlock.nowAvailable', 'is now available')}
          </p>
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative ml-2 h-8 w-8 rounded-full"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Progress bar for auto-dismiss */}
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-border/30 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-gradient-to-r rounded-full',
              config.colorClass,
              'animate-[shrink-width_5s_linear_forwards]'
            )}
          />
        </div>
      </div>
    </div>
  )
}
