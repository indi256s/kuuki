import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TierType } from './TierContainer'

interface LockedTierTeaserProps {
  tier: TierType
  progress?: { current: number; required: number }
}

// GLaDOS-style sarcastic encouragement messages
const GLADOS_MESSAGES: Record<TierType, string[]> = {
  aviaGeek: [
    'stats.locked.aviaGeek.1',
    'stats.locked.aviaGeek.2',
    'stats.locked.aviaGeek.3',
  ],
  countryGeek: [
    'stats.locked.countryGeek.1',
    'stats.locked.countryGeek.2',
    'stats.locked.countryGeek.3',
  ],
  duration: [
    'stats.locked.duration.1',
    'stats.locked.duration.2',
    'stats.locked.duration.3',
  ],
}

const TIER_REQUIREMENTS: Record<TierType, { count: number; type: string }> = {
  aviaGeek: { count: 5, type: 'aircraft types' },
  countryGeek: { count: 5, type: 'countries' },
  duration: { count: 10, type: 'flights' },
}

export function LockedTierTeaser({ tier, progress }: LockedTierTeaserProps) {
  const { t } = useTranslation()

  // Pick a random message based on tier
  const messageKey = useMemo(() => {
    const messages = GLADOS_MESSAGES[tier]
    return messages[Math.floor(Math.random() * messages.length)]
  }, [tier])

  const requirement = TIER_REQUIREMENTS[tier]
  const remaining = progress
    ? requirement.count - progress.current
    : requirement.count

  // Default fallback messages if translation keys don't exist yet
  const fallbackMessages: Record<string, string> = {
    'stats.locked.aviaGeek.1': `Oh, you want aircraft insights? How ambitious. Only ${remaining} more types to go.`,
    'stats.locked.aviaGeek.2': `Aircraft analytics await. ${remaining} more aircraft types and they're yours. No pressure.`,
    'stats.locked.aviaGeek.3': `The Avia Geek tier observes your progress with mild interest. ${remaining} more to go.`,
    'stats.locked.countryGeek.1': `Country analytics require ${requirement.count} countries. You've managed ${progress?.current || 0}. Impressive.`,
    'stats.locked.countryGeek.2': `Globe-trotting statistics unlock at ${requirement.count} countries. Only ${remaining} more continents... I mean countries... to conquer.`,
    'stats.locked.countryGeek.3': `Your passport seems rather... underfilled. ${remaining} more countries will remedy that.`,
    'stats.locked.duration.1': `Duration stats unlock at ${requirement.count} flights. You're at ${progress?.current || 0}. The anticipation must be overwhelming.`,
    'stats.locked.duration.2': `${remaining} more flights until time analytics. Science demands patience. And more flying.`,
    'stats.locked.duration.3': `Flight duration insights are ${remaining} flights away. The clock is ticking. Metaphorically.`,
  }

  const message = t(messageKey, fallbackMessages[messageKey])

  return (
    <div className="relative min-h-[140px] flex items-center justify-center p-6">
      {/* Blurred background preview - simulates locked content */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-card/0 via-card/50 to-card" />
        <div
          className={cn(
            'absolute inset-4 rounded-xl bg-muted/30',
            'blur-sm opacity-50'
          )}
        />
        {/* Fake chart bars */}
        <div className="absolute bottom-8 left-8 right-8 flex items-end gap-2 opacity-20 blur-[2px]">
          {[40, 65, 35, 80, 55, 45, 70].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/60 rounded-t"
              style={{ height: `${height}%`, maxHeight: '60px' }}
            />
          ))}
        </div>
      </div>

      {/* Locked content overlay */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        <div
          className={cn(
            'p-3 rounded-full bg-muted/80 mb-3',
            'ring-4 ring-muted/40'
          )}
        >
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed italic">
          "{message}"
        </p>

        <p className="mt-3 text-xs text-muted-foreground/70">
          — {t('stats.locked.signature', 'Your Flight Stats AI')}
        </p>
      </div>
    </div>
  )
}
