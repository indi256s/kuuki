import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy, ArrowRight, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistance } from '@/lib/geo'
import type { LeaderboardEntry } from '@/lib/profiles'
import type { LeaderboardCategory } from '@/hooks/useLeaderboard'

interface UserRankCardProps {
  position: LeaderboardEntry | null
  category: LeaderboardCategory
  isLoading?: boolean
  showOnLeaderboards?: boolean
  totalFlights?: number
}

const MIN_FLIGHTS = 10

export function UserRankCard({
  position,
  category,
  isLoading,
  showOnLeaderboards,
  totalFlights = 0,
}: UserRankCardProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Not enough flights
  if (totalFlights < MIN_FLIGHTS) {
    const flightsNeeded = MIN_FLIGHTS - totalFlights

    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-secondary/50 text-muted-foreground">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {t('leaderboard.notEligible', 'Not yet eligible')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('leaderboard.needMoreFlights', 'Log {{count}} more flights to appear on leaderboards', {
                  count: flightsNeeded,
                })}
              </p>
              <Progress value={(totalFlights / MIN_FLIGHTS) * 100} className="h-1.5 mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Opted out of leaderboards
  if (!showOnLeaderboards) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary/50 text-muted-foreground">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t('leaderboard.optedOut', 'Leaderboards disabled')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('leaderboard.enableInSettings', 'Enable in profile settings')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings">
                {t('settings.title', 'Settings')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No position yet (shouldn't happen if opted in and has enough flights)
  if (!position) {
    return null
  }

  // Format value
  const formattedValue = category === 'distance'
    ? formatDistance(position.value)
    : position.value.toLocaleString()

  const percentile = position.percentile ?? 50
  const isTopTen = position.rank <= 10

  return (
    <Card className={isTopTen ? 'ring-1 ring-amber-400/50' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isTopTen ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-secondary/50'}`}>
              <Trophy className={`w-5 h-5 ${isTopTen ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('leaderboard.yourRank', 'Your Rank')}
              </p>
              <p className="text-2xl font-semibold font-data">
                #{position.rank}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg font-semibold font-data">
              {formattedValue}
            </p>
            {percentile >= 90 && (
              <p className="text-xs text-primary">
                Top {Math.round(100 - percentile)}%
              </p>
            )}
          </div>
        </div>

        <Progress value={percentile} className="h-1.5 mt-3" />
      </CardContent>
    </Card>
  )
}
