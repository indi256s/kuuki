import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy, Users } from 'lucide-react'
import { useLeaderboard, useUserLeaderboardPositions, useTotalRankedUsers, type LeaderboardCategory } from '@/hooks/useLeaderboard'
import { useFlightStats } from '@/hooks/useStats'
import { useAuth } from '@/hooks/useAuth'
import { CategoryTabs } from '@/components/leaderboard/CategoryTabs'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { UserRankCard } from '@/components/leaderboard/UserRankCard'
import { AppHeader } from '@/components/common/AppHeader'
import { AppPageShell } from '@/components/layout/AppPageShell'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function LeaderboardPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('flights')

  const leaderboard = useLeaderboard(activeCategory)
  const positions = useUserLeaderboardPositions()
  const totals = useTotalRankedUsers()
  const statsQuery = useFlightStats()
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = leaderboard
  const { data: userPositions, isLoading: isLoadingPositions } = positions
  const totalUsers = totals.data
  const stats = statsQuery.data

  const currentPosition = userPositions?.[activeCategory] ?? null

  return (
    <AppPageShell
      shellClassName="min-h-screen bg-gradient-soft"
      maxWidth="wide"
      className="mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6"
      mobileHeader={<MobileHeader />}
      appHeader={<AppHeader />}
      mobileTabBar={user ? <MobileTabBar /> : undefined}
    >
        <div className="space-y-6 animate-fade-up stagger-children">
          {(leaderboard.error || positions.error || totals.error || statsQuery.error) && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {leaderboardData || userPositions || totalUsers !== undefined || stats
                ? t('errors.backgroundRefresh', 'Some rankings could not refresh. Showing the last loaded data where available.')
                : t('errors.leaderboardLoadFailed', 'Could not load rankings. Please try again.')}
              <Button variant="link" onClick={() => {
                if (leaderboard.error) void leaderboard.refetch()
                if (positions.error) void positions.refetch()
                if (totals.error) void totals.refetch()
                if (statsQuery.error) void statsQuery.refetch()
              }}>{t('common.retry', 'Try again')}</Button>
            </div>
          )}
          {/* Page header */}
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t('leaderboard.title', 'Leaderboard')}
              <span className="ml-3 text-sm font-normal text-muted-foreground hidden sm:inline">
                {t('leaderboard.subtitle', 'See how you rank against other travelers')}
              </span>
            </h1>

            {/* Total users badge */}
            {totalUsers !== undefined && totalUsers > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                <Users className="w-4 h-4" />
                {t('leaderboard.totalUsers', '{{count}} travelers ranked', { count: totalUsers })}
              </div>
            )}
          </div>

          {/* Category tabs */}
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* User's rank card (if logged in) */}
          {user && (isLoadingPositions || userPositions !== undefined) && (!statsQuery.error || stats !== undefined) && (
            <UserRankCard
              position={currentPosition}
              category={activeCategory}
              isLoading={isLoadingPositions}
              showOnLeaderboards={profile?.show_on_leaderboards ?? false}
              totalFlights={stats?.totalFlights ?? 0}
            />
          )}

          {/* Leaderboard table */}
          {(isLoadingLeaderboard || leaderboardData) && (
            <LeaderboardTable
              entries={leaderboardData?.entries ?? []}
              category={activeCategory}
              isLoading={isLoadingLeaderboard}
              currentUserId={user?.id}
            />
          )}

          {/* Empty state for non-logged-in users */}
          {!user && (
            <Card className="rounded-2xl border-dashed border-border/50">
              <CardContent className="p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="font-semibold mb-1">
                  {t('leaderboard.joinCta', 'Join the rankings')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('leaderboard.joinCtaDescription', 'Sign up and log 5 flights to appear on the leaderboard')}
                </p>
                <Button asChild>
                  <Link to="/">
                    {t('auth.signIn', 'Sign in')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
    </AppPageShell>
  )
}
