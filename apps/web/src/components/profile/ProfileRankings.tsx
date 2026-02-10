import { useTranslation } from 'react-i18next'
import { Trophy, TrendingUp, Globe2, MapPin, Building2, Plane } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistance } from '@/lib/geo'
import type { LeaderboardEntry } from '@/lib/profiles'

// Category icons
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flights: Plane,
  distance: TrendingUp,
  countries: Globe2,
  cities: MapPin,
  airlines: Building2,
}

interface ProfileRankingsProps {
  rankings: LeaderboardEntry[]
  isLoading?: boolean
  /** Whether to hide the section title (useful when wrapped in ProfileSection) */
  hideTitle?: boolean
}

export function ProfileRankings({ rankings, isLoading, hideTitle = false }: ProfileRankingsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h2 className="text-lg font-semibold">
            {t('leaderboard.title', 'Rankings')}
          </h2>
        )}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!rankings || rankings.length === 0) {
    return null
  }

  // Sort by rank (best first)
  const sortedRankings = [...rankings].sort((a, b) => a.rank - b.rank)

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold">
            {t('leaderboard.title', 'Rankings')}
          </h2>
        </div>
      )}

      <div className="space-y-2">
        {sortedRankings.map((ranking) => {
          const IconComponent = CATEGORY_ICONS[ranking.category] || Trophy

          // Format value based on category
          const formattedValue = ranking.category === 'distance'
            ? formatDistance(ranking.value)
            : ranking.value.toLocaleString()

          const percentile = ranking.percentile ?? 50
          const isTopTen = ranking.rank <= 10
          const isTopPercent = percentile >= 90

          return (
            <div
              key={ranking.category}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors duration-200 ${
                isTopTen
                  ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.1]'
                  : 'hover:bg-secondary/50'
              }`}
            >
              {/* Rank number */}
              <span className={`text-lg font-data font-semibold w-10 text-right tabular-nums ${
                isTopTen ? 'text-amber-500' : 'text-muted-foreground'
              }`}>
                #{ranking.rank}
              </span>

              {/* Category icon */}
              <div className="p-1.5 rounded-lg bg-secondary/50">
                <IconComponent className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Category name + progress */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {t(`leaderboard.categories.${ranking.category}`, ranking.category)}
                  </span>
                  <span className="text-sm font-data text-muted-foreground tabular-nums">
                    {formattedValue}
                  </span>
                </div>
                <Progress value={percentile} className="h-1" />
              </div>

              {/* Top X% badge */}
              {isTopPercent && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full whitespace-nowrap">
                  Top {Math.round(100 - percentile)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
