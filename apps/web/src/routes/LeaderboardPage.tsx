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
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function LeaderboardPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('flights')

  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useLeaderboard(activeCategory)
  const { data: userPositions, isLoading: isLoadingPositions } = useUserLeaderboardPositions()
  const { data: totalUsers } = useTotalRankedUsers()
  const { data: stats } = useFlightStats()

  const currentPosition = userPositions?.[activeCategory] ?? null

  return (
    <div className="min-h-screen bg-gradient-soft">

      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop header */}
      <AppHeader />

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main id="main-content" className="max-w-7xl 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6">
        <div className="space-y-6 animate-fade-up stagger-children">
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
          {user && (
            <UserRankCard
              position={currentPosition}
              category={activeCategory}
              isLoading={isLoadingPositions}
              showOnLeaderboards={profile?.show_on_leaderboards ?? false}
              totalFlights={stats?.totalFlights ?? 0}
            />
          )}

          {/* Leaderboard table */}
          <LeaderboardTable
            entries={leaderboardData?.entries ?? []}
            category={activeCategory}
            isLoading={isLoadingLeaderboard}
            currentUserId={user?.id}
          />

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
      </main>

      {/* Mobile tab bar - only show for logged-in users */}
      {user && <MobileTabBar />}
    </div>
  )
}
