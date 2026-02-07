import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plane, UserX, BarChart3, Trophy, Award } from 'lucide-react'
import { usePublicProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { ProfileBadges } from '@/components/profile/ProfileBadges'
import { ProfileRankings } from '@/components/profile/ProfileRankings'
import { ProfileMiniHeader } from '@/components/profile/ProfileMiniHeader'
import { ProfileSection } from '@/components/profile/ProfileSection'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profileData, isLoading, error } = usePublicProfile(username)

  // Mini-header visibility state
  const [showMiniHeader, setShowMiniHeader] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  const isOwnProfile = user?.id === profileData?.profile?.id

  // Intersection observer for mini-header scroll trigger
  useEffect(() => {
    if (!statsRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show mini-header when Stats section is at or above viewport top
        setShowMiniHeader(!entry.isIntersecting && entry.boundingClientRect.top <= 0)
      },
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    )

    observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [profileData])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-8 pb-safe sm:pb-8">
          <Card className="overflow-hidden">
            <Skeleton className="h-40 rounded-none" />
            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <Skeleton className="w-28 h-28 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  // Not found state
  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-8 pb-safe sm:pb-8">
          <Card className="overflow-hidden">
            <CardContent className="p-12 text-center">
              <UserX className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h1 className="text-2xl font-semibold mb-2">
                {t('profile.notFound', 'Profile not found')}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t('profile.notFoundDescription', 'This user doesn\'t exist or has a private profile.')}
              </p>
              <Button asChild>
                <Link to="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('common.back', 'Back')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const { profile, stats, badges, rankings } = profileData

  // Key stat for mini-header
  const keyStat = stats
    ? t('flights.count', '{{count}} flights', { count: stats.total_flights ?? 0 })
    : ''

  // Private profile view
  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-8 pb-safe sm:pb-8">
          <Card className="overflow-hidden">
            <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} badges={[]} />
          </Card>
        </main>
      </div>
    )
  }

  // Full public profile view
  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Mini-header (mobile only) */}
      <ProfileMiniHeader
        profile={profile}
        keyStat={keyStat}
        visible={showMiniHeader}
      />

      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8 pb-safe sm:pb-8">
        <Card className="overflow-hidden animate-fade-up">
          <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} badges={badges} />
        </Card>

        {/* Stats section (expanded by default on mobile) */}
        <div ref={statsRef}>
          <ProfileSection
            title={t('stats.title', 'Stats')}
            icon={BarChart3}
            defaultOpen={true}
          >
            {stats && <ProfileStats stats={stats} hideTitle />}
          </ProfileSection>
        </div>

        {/* Rankings section (collapsed by default on mobile) */}
        <ProfileSection
          title={t('leaderboard.yourRank', 'Your Rank')}
          icon={Trophy}
          defaultOpen={false}
          emptyState={
            <p className="text-muted-foreground text-sm p-4 text-center">
              {t('leaderboard.rankingsEmpty', 'Add more flights to appear on leaderboards')}
            </p>
          }
        >
          {rankings.length > 0 && <ProfileRankings rankings={rankings} hideTitle />}
        </ProfileSection>

        {/* Badges section (collapsed by default on mobile) */}
        <ProfileSection
          title={t('badges.title', 'Badges')}
          icon={Award}
          defaultOpen={false}
          emptyState={
            <p className="text-muted-foreground text-sm p-4 text-center">
              {t('badges.empty', 'Keep flying to unlock badges')}
            </p>
          }
        >
          {badges.length > 0 && <ProfileBadges badges={badges} hideTitle />}
        </ProfileSection>
      </main>

      {/* Mobile tab bar - only show for logged-in users */}
      {user && <MobileTabBar />}
    </div>
  )
}

// Minimal header for profile pages
function Header() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-[background-color] duration-150">
            <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {t('common.appName')}
          </span>
        </Link>

      </div>
    </header>
  )
}
