import { useTranslation } from 'react-i18next'
import { Award, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useBadgeProgress, useAllBadges, useUserBadges } from '@/hooks/useBadges'

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  flights: 'Mission Stages',
  distance: 'Spacecraft',
  airlines: 'Airline Collector',
  aircraft: 'Aircraft Spotter',
  achievement: 'Achievements',
  secret: 'Secret',
}

export function BadgeProgress() {
  const { t } = useTranslation()
  const { total, earned, progress, byCategory } = useBadgeProgress()
  const { data: allBadges } = useAllBadges()
  const { data: earnedBadges } = useUserBadges()

  const earnedIds = new Set(earnedBadges?.map(b => b.badge_id) ?? [])

  // Group badges by category
  const badgesByCategory: Record<string, typeof allBadges> = {}
  for (const badge of allBadges ?? []) {
    const category = badge.category ?? 'other'
    // Hide secret badges that aren't earned
    if (category === 'secret' && !earnedIds.has(badge.id)) continue
    if (!badgesByCategory[category]) {
      badgesByCategory[category] = []
    }
    badgesByCategory[category].push(badge)
  }

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            {t('badges.progress', 'Badge Progress')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('badges.earnedCount', '{{earned}} of {{total}} badges earned', { earned, total })}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Badges by category */}
      {Object.entries(badgesByCategory).map(([category, badges]) => {
        const categoryStats = byCategory[category]
        const categoryProgress = categoryStats?.total > 0
          ? Math.round((categoryStats.earned / categoryStats.total) * 100)
          : 0

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {CATEGORY_NAMES[category] || category}
                </CardTitle>
                <Badge variant="secondary">
                  {categoryStats?.earned ?? 0}/{categoryStats?.total ?? 0}
                </Badge>
              </div>
              <Progress value={categoryProgress} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badges?.map((badge) => {
                  const isEarned = earnedIds.has(badge.id)
                  const isSecret = badge.category === 'secret'

                  return (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        isEarned
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-secondary/30 border-transparent opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!isEarned && (
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${!isEarned ? 'text-muted-foreground' : ''}`}>
                            {isSecret && !isEarned ? '???' : badge.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {isSecret && !isEarned
                              ? t('badges.secretHint', 'Keep exploring to unlock')
                              : badge.description}
                          </p>
                          {badge.tier && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {badge.tier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
