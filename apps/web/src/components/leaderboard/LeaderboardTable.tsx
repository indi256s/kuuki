import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy, Crown, Medal } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/common/UserAvatar'
import { formatDistance } from '@kuuki/client/geo'
import type { LeaderboardEntryWithProfile, LeaderboardCategory } from '@/hooks/useLeaderboard'

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithProfile[]
  category: LeaderboardCategory
  isLoading?: boolean
  currentUserId?: string
}

// Rank badges for top 3
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Crown className="w-5 h-5 text-yellow-500" />
  }
  if (rank === 2) {
    return <Medal className="w-5 h-5 text-slate-400" />
  }
  if (rank === 3) {
    return <Medal className="w-5 h-5 text-amber-600" />
  }
  return <span className="text-muted-foreground font-data">{rank}</span>
}

export function LeaderboardTable({
  entries,
  category,
  isLoading,
  currentUserId,
}: LeaderboardTableProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t('leaderboard.rank', 'Rank')}</TableHead>
              <TableHead>{t('leaderboard.user', 'User')}</TableHead>
              <TableHead className="text-right">{t('leaderboard.value', 'Value')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30 animate-fade-up" />
        <p className="text-muted-foreground">
          {t('leaderboard.empty', 'No rankings yet. Be the first!')}
        </p>
      </div>
    )
  }

  // Format value based on category
  const formatValue = (value: number) => {
    if (category === 'distance') {
      return formatDistance(value)
    }
    return value.toLocaleString()
  }

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t('leaderboard.rank', 'Rank')}</TableHead>
            <TableHead>{t('leaderboard.user', 'User')}</TableHead>
            <TableHead className="text-right">{t('leaderboard.value', 'Value')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCurrentUser = entry.user_id === currentUserId
            const displayName = entry.displayName || entry.username || 'Anonymous'

            return (
              <TableRow
                key={entry.id}
                className={cn(
                  'transition-colors hover:bg-accent/50',
                  isCurrentUser && 'bg-primary/5',
                  entry.rank <= 3 && !isCurrentUser && 'bg-amber-50/50 dark:bg-amber-950/10',
                )}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center justify-center w-8">
                    <RankBadge rank={entry.rank} />
                  </div>
                </TableCell>
                <TableCell className="py-2 sm:py-3">
                  <Link
                    to={`/fly/${entry.username}`}
                    className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shrink-0">
                      <UserAvatar
                        userId={entry.user_id}
                        avatarUrl={entry.avatarUrl}
                        name={displayName}
                        size={40}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-medium truncate">
                        {displayName}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {t('profile.you', 'You')}
                          </Badge>
                        )}
                      </p>
                      {entry.username && (
                        <p className="text-xs text-muted-foreground hidden sm:block">
                          @{entry.username}
                        </p>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right py-2 sm:py-3">
                  <div>
                    <span className="font-data font-medium">
                      {formatValue(entry.value)}
                    </span>
                    {entry.percentile && entry.percentile >= 90 && (
                      <span className="sm:ml-2 text-xs text-primary block sm:inline mt-0.5 sm:mt-0">
                        Top {Math.round(100 - entry.percentile)}%
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
