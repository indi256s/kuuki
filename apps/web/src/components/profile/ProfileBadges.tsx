import { useTranslation } from 'react-i18next'
import {
  Rocket,
  Moon,
  Sparkles,
  Satellite,
  Orbit,
  Star,
  Building2,
  Plane,
  Globe,
  Timer,
  FlaskConical,
  Award,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserBadge, BadgeDefinition } from '@/lib/profiles'
import { TIER_VISUALS } from '@/lib/tier-visuals'

// Icon mapping for badges
const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  moon: Moon,
  sparkles: Sparkles,
  satellite: Satellite,
  orbit: Orbit,
  star: Star,
  'building-2': Building2,
  plane: Plane,
  globe: Globe,
  timer: Timer,
  flask: FlaskConical,
}

interface ProfileBadgesProps {
  badges: Array<UserBadge & { badge: BadgeDefinition }>
  isLoading?: boolean
  showAll?: boolean
  /** Whether to hide the section title (useful when wrapped in ProfileSection) */
  hideTitle?: boolean
}

export function ProfileBadges({ badges, isLoading, showAll = false, hideTitle = false }: ProfileBadgesProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h2 className="text-lg font-semibold">
            {t('profile.badges', 'Badges')}
          </h2>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (!badges || badges.length === 0) {
    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h2 className="text-lg font-semibold">
            {t('profile.badges', 'Badges')}
          </h2>
        )}
        <div className="py-8 text-center text-muted-foreground">
          <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('profile.noBadges', 'No badges earned yet')}</p>
        </div>
      </div>
    )
  }

  // Sort by points (higher first)
  const sortedBadges = [...badges].sort((a, b) => {
    return (b.badge.points ?? 0) - (a.badge.points ?? 0)
  })

  const displayBadges = showAll ? sortedBadges : sortedBadges.slice(0, 12)

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t('profile.badges', 'Badges')}
          </h2>
          {badges.length > 12 && !showAll && (
            <Badge variant="secondary">
              +{badges.length - 12} {t('common.more', 'more')}
            </Badge>
          )}
        </div>
      )}

      {/* Horizontal scroll on mobile, flowing wrap on desktop */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible md:pb-0">
        {displayBadges.map(({ badge, earned_at }) => {
          const IconComponent = BADGE_ICONS[badge.icon ?? ''] || Award
          const tierColors = TIER_VISUALS[badge.tier as keyof typeof TIER_VISUALS] ?? TIER_VISUALS.none
          const earnedDate = earned_at ? new Date(earned_at).toLocaleDateString() : null

          return (
            <div
              key={badge.id}
              className="group relative flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-card/50 hover:bg-secondary/50 hover:border-border transition-all duration-200 flex-shrink-0 cursor-default"
              title={earnedDate ? `${badge.description ?? ''}\nEarned: ${earnedDate}` : badge.description ?? ''}
            >
              {/* Tier dot */}
              {badge.tier && badge.tier !== 'none' && (
                <span className={`w-2 h-2 rounded-full ${tierColors.bg} ${tierColors.border} border`} />
              )}

              {/* Icon */}
              <div className={`${tierColors.text}`}>
                <IconComponent className="w-4 h-4" />
              </div>

              {/* Name */}
              <span className="text-sm font-medium whitespace-nowrap">
                {badge.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
