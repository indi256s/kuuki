import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy, ArrowRight, AlertCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistance } from '@/lib/geo'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/leaderboard'
import type { LeaderboardCategory } from '@/hooks/useLeaderboard'

interface UserRankCardProps {
  position: LeaderboardEntry | null
  category: LeaderboardCategory
  isLoading?: boolean
  showOnLeaderboards?: boolean
  totalFlights?: number
}

const MIN_FLIGHTS = 5
const RANK_STORAGE_KEY = 'kuuki_last_rank'

// Get stored ranks from localStorage
function getStoredRanks(): Record<string, number> {
  try {
    const stored = localStorage.getItem(RANK_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Store rank for a category
function storeRank(category: string, rank: number): void {
  try {
    const ranks = getStoredRanks()
    ranks[category] = rank
    localStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(ranks))
  } catch {
    // Ignore storage errors
  }
}

export function UserRankCard({
  position,
  category,
  isLoading,
  showOnLeaderboards,
  totalFlights = 0,
}: UserRankCardProps) {
  const { t } = useTranslation()
  const [isImproved, setIsImproved] = useState(false)
  const [improvement, setImprovement] = useState(0)

  // Check for rank improvement
  useEffect(() => {
    if (!position || isLoading) return

    const storedRanks = getStoredRanks()
    const previousRank = storedRanks[category]

    if (previousRank !== undefined && position.rank < previousRank) {
      // Rank improved! Trigger celebration
      setIsImproved(true)
      setImprovement(previousRank - position.rank)

      // Clear celebration after animation
      const timer = setTimeout(() => setIsImproved(false), 3000)
      return () => clearTimeout(timer)
    }

    // Store current rank
    storeRank(category, position.rank)
  }, [position, category, isLoading])

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
            <Button variant="outline" asChild>
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
    <Card
      className={cn(
        isTopTen && 'ring-1 ring-amber-400/50',
        isImproved && 'animate-perimeter-glow motion-reduce:animate-none'
      )}
    >
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
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold font-data">
                  #{position.rank}
                </p>
                {/* Rank improvement badge */}
                {isImproved && improvement > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium animate-fade-up">
                    <TrendingUp className="w-3 h-3" />
                    +{improvement}
                  </span>
                )}
              </div>
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
