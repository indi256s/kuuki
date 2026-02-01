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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserBadge, BadgeDefinition } from '@/lib/profiles'

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

// Tier colors for badge styling
const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bronze: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  silver: { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
  gold: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-400 dark:border-yellow-600' },
  platinum: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-400 dark:border-cyan-600' },
  diamond: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-400 dark:border-violet-600' },
}

interface ProfileBadgesProps {
  badges: Array<UserBadge & { badge: BadgeDefinition }>
  isLoading?: boolean
  showAll?: boolean
}

export function ProfileBadges({ badges, isLoading, showAll = false }: ProfileBadgesProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {t('profile.badges', 'Badges')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!badges || badges.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {t('profile.badges', 'Badges')}
        </h2>
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('profile.noBadges', 'No badges earned yet')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filter out secret badges that haven't been earned (shouldn't happen, but safety check)
  // Also sort by tier and points
  const sortedBadges = [...badges].sort((a, b) => {
    // Sort by points (higher first)
    return (b.badge.points ?? 0) - (a.badge.points ?? 0)
  })

  const displayBadges = showAll ? sortedBadges : sortedBadges.slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t('profile.badges', 'Badges')}
        </h2>
        {badges.length > 8 && !showAll && (
          <Badge variant="secondary">
            +{badges.length - 8} {t('common.more', 'more')}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {displayBadges.map(({ badge, earned_at }) => {
          const IconComponent = BADGE_ICONS[badge.icon ?? ''] || Award
          const tierColors = TIER_COLORS[badge.tier ?? ''] || {
            bg: 'bg-secondary',
            text: 'text-foreground',
            border: 'border-border',
          }
          const earnedDate = earned_at ? new Date(earned_at).toLocaleDateString() : null

          return (
            <Card
              key={badge.id}
              className={`relative overflow-hidden border ${tierColors.border} hover:shadow-md transition-all duration-300 group`}
            >
              <div className={`absolute inset-0 ${tierColors.bg} opacity-50`} />

              <CardContent className="relative p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={`p-2.5 rounded-xl ${tierColors.bg} ${tierColors.text} group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="w-6 h-6" />
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-tight">
                      {badge.name}
                    </p>
                    {badge.tier && (
                      <Badge variant="outline" className={`text-xs ${tierColors.text} ${tierColors.border}`}>
                        {badge.tier}
                      </Badge>
                    )}
                  </div>

                  {badge.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {badge.description}
                    </p>
                  )}

                  {earnedDate && (
                    <p className="text-xs text-muted-foreground/70">
                      {earnedDate}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
