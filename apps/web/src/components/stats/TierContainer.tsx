import { ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { LockedTierTeaser } from './LockedTierTeaser'

export type TierType = 'aviaGeek' | 'countryGeek' | 'duration'

interface TierContainerProps {
  tier: TierType
  title: string
  icon: React.ElementType
  isUnlocked: boolean
  progress?: { current: number; required: number }
  children: ReactNode
  delay?: number
}

// Custom hook to detect when isUnlocked changes from false to true
function useUnlockTransition(isUnlocked: boolean) {
  const wasUnlocked = useRef(isUnlocked)
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    // Detect transition from locked to unlocked
    if (isUnlocked && !wasUnlocked.current) {
      setJustUnlocked(true)
      // Clear the animation state after animation completes
      const timer = setTimeout(() => setJustUnlocked(false), 600)
      return () => clearTimeout(timer)
    }
    wasUnlocked.current = isUnlocked
  }, [isUnlocked])

  return justUnlocked
}

export function TierContainer({
  tier,
  title,
  icon: Icon,
  isUnlocked,
  progress,
  children,
  delay = 0,
}: TierContainerProps) {
  const justUnlocked = useUnlockTransition(isUnlocked)

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/50 bg-card overflow-hidden',
        'opacity-0 animate-[fade-slide-up_0.5s_ease-out_forwards]',
        'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isUnlocked && 'hover:border-border hover:shadow-md'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
        <div
          className={cn(
            'p-2 rounded-lg',
            isUnlocked ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Icon
            className={cn(
              'w-4 h-4',
              isUnlocked ? 'text-primary' : 'text-muted-foreground'
            )}
            strokeWidth={2}
          />
        </div>
        <h3
          className={cn(
            'text-sm font-semibold tracking-tight',
            !isUnlocked && 'text-muted-foreground'
          )}
        >
          {title}
        </h3>

        {/* Progress indicator for locked tiers */}
        {!isUnlocked && progress && (
          <div className="ml-auto flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((progress.current / progress.required) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {progress.current}/{progress.required}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative">
        {isUnlocked ? (
          <div
            className={cn(
              'p-5',
              justUnlocked && 'animate-tier-reveal'
            )}
          >
            {children}
          </div>
        ) : (
          <LockedTierTeaser tier={tier} progress={progress} />
        )}
      </div>
    </div>
  )
}
