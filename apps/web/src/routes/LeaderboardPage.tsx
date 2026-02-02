import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plane, Trophy, Users } from 'lucide-react'
import { useLeaderboard, useUserLeaderboardPositions, useTotalRankedUsers, type LeaderboardCategory } from '@/hooks/useLeaderboard'
import { useFlightStats } from '@/hooks/useStats'
import { useAuth } from '@/hooks/useAuth'
import { CategoryTabs } from '@/components/leaderboard/CategoryTabs'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { UserRankCard } from '@/components/leaderboard/UserRankCard'
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

      {/* Desktop header - hidden on mobile */}
      <header
        data-testid="desktop-header"
        className="hidden sm:block sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              {t('common.appName')}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {user && (
              <Button variant="ghost" asChild>
                <Link to="/dashboard">
                  {t('nav.dashboard', 'Dashboard')}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main className="max-w-4xl mx-auto px-6 py-8 pb-safe sm:pb-8">
        {/* Page header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t('leaderboard.title', 'Leaderboard')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('leaderboard.subtitle', 'See how you rank against other travelers')}
          </p>

          {/* Total users badge */}
          {totalUsers !== undefined && totalUsers > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4" />
              {t('leaderboard.totalUsers', '{{count}} travelers ranked', { count: totalUsers })}
            </div>
          )}
        </div>

        {/* Category tabs */}
        <div className="mb-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        {/* User's rank card (if logged in) */}
        {user && (
          <div className="mb-6 animate-fade-up" style={{ animationDelay: '75ms' }}>
            <UserRankCard
              position={currentPosition}
              category={activeCategory}
              isLoading={isLoadingPositions}
              showOnLeaderboards={profile?.show_on_leaderboards ?? false}
              totalFlights={stats?.totalFlights ?? 0}
            />
          </div>
        )}

        {/* Leaderboard table */}
        <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
          <LeaderboardTable
            entries={leaderboardData?.entries ?? []}
            category={activeCategory}
            isLoading={isLoadingLeaderboard}
            currentUserId={user?.id}
          />
        </div>

        {/* Empty state for non-logged-in users */}
        {!user && (
          <div className="mt-8 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="font-semibold mb-1">
                  {t('leaderboard.joinCta', 'Join the rankings')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('leaderboard.joinCtaDescription', 'Sign up and log 10 flights to appear on the leaderboard')}
                </p>
                <Button asChild>
                  <Link to="/">
                    {t('auth.signIn', 'Sign in')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Mobile tab bar - only show for logged-in users */}
      {user && <MobileTabBar />}
    </div>
  )
}
