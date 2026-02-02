import { useTranslation } from 'react-i18next'
import { Trophy, TrendingUp, Globe2, MapPin, Building2, Plane } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  flights: 'text-primary',
  distance: 'text-chart-2',
  countries: 'text-chart-3',
  cities: 'text-chart-5',
  airlines: 'text-chart-4',
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!rankings || rankings.length === 0) {
    return null // Don't show section if not on leaderboards
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedRankings.map((ranking) => {
          const IconComponent = CATEGORY_ICONS[ranking.category] || Trophy
          const iconColor = CATEGORY_COLORS[ranking.category] || 'text-foreground'

          // Format value based on category
          const formattedValue = ranking.category === 'distance'
            ? formatDistance(ranking.value)
            : ranking.value.toLocaleString()

          // Percentile determines color intensity
          const percentile = ranking.percentile ?? 50
          const isTopTen = ranking.rank <= 10
          const isTopPercent = percentile >= 90

          return (
            <Card
              key={ranking.category}
              className={`overflow-hidden border-border/50 hover:border-border transition-all duration-300 ${
                isTopTen ? 'ring-1 ring-amber-400/50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Category icon */}
                  <div className={`p-2.5 rounded-xl bg-secondary/50 ${iconColor}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Rank and value */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {t(`leaderboard.categories.${ranking.category}`, ranking.category)}
                      </span>
                      <span className="text-sm font-medium font-data">
                        {formattedValue}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-lg font-semibold ${isTopTen ? 'text-amber-500' : ''}`}>
                        #{ranking.rank}
                      </span>
                      {isTopPercent && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Top {Math.round(100 - percentile)}%
                        </span>
                      )}
                    </div>

                    {/* Percentile bar */}
                    <div className="mt-2">
                      <Progress value={percentile} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
