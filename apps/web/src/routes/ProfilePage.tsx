import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, UserX, BarChart3, Trophy, Award, Lock, Plane } from 'lucide-react'
import { usePublicProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { ProfileBadges } from '@/components/profile/ProfileBadges'
import { ProfileRankings } from '@/components/profile/ProfileRankings'
import { ProfileMiniHeader } from '@/components/profile/ProfileMiniHeader'
import { ProfileSection } from '@/components/profile/ProfileSection'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
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
        setShowMiniHeader(!entry.isIntersecting && entry.boundingClientRect.top <= 0)
      },
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    )

    observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [profileData])

  // Loading state — matches new layout shapes
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <SharedHeader user={user} />
        <main className="max-w-3xl mx-auto px-6 py-8 pb-safe sm:pb-8">
          {/* Header skeleton */}
          <div className="animate-fade-up">
            <div className="px-6 md:px-8 pt-8 md:pt-12 pb-8">
              <div className="relative mb-6">
                <Skeleton className="w-28 h-28 md:w-36 md:h-36 rounded-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="mt-12 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="space-y-2">
              <Skeleton className="h-16 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Not found — atmospheric 404
  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
        {/* Subtle grain background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        <SharedHeader user={user} />
        <main className="max-w-3xl mx-auto px-6 py-8 pb-safe sm:pb-8 relative">
          <div className="py-16 md:py-24 text-center animate-fade-up">
            <UserX className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" strokeWidth={1} />
            <h1 className="text-2xl font-display font-semibold mb-2">
              {t('profile.notFound', 'Profile not found')}
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('profile.notFoundDescription', 'This user doesn\'t exist or has a private profile.')}
            </p>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back', 'Back')}
              </Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const { profile, stats, badges, rankings } = profileData

  // Key stat for mini-header
  const keyStat = stats
    ? t('flights.count', '{{count}} flights', { count: stats.total_flights ?? 0 })
    : ''

  // Private profile — header with frosted overlay where stats would be
  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
        {/* Background watermark */}
        <Watermark />
        <SharedHeader user={user} />
        <main className="max-w-3xl mx-auto px-6 py-8 pb-safe sm:pb-8 relative">
          <div className="animate-fade-up">
            <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} badges={[]} />
          </div>

          {/* Frosted privacy overlay */}
          <div className="mt-12 animate-fade-up relative rounded-2xl overflow-hidden" style={{ animationDelay: '100ms' }}>
            <div className="absolute inset-0 bg-background/60 backdrop-blur-md z-10" />
            <div className="relative z-20 py-16 text-center">
              <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                {t('profile.prefersPrivacy', 'This user prefers privacy')}
              </p>
            </div>
            {/* Ghost content behind blur */}
            <div className="absolute inset-0 p-8 opacity-30">
              <div className="h-16 w-32 bg-muted/30 rounded mb-4" />
              <div className="grid grid-cols-3 gap-8">
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div className="h-8 w-16 bg-muted/30 rounded mb-2" />
                    <div className="h-3 w-12 bg-muted/20 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Full public profile view
  return (
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      {/* Background watermark */}
      <Watermark />

      {/* Mini-header (mobile only) */}
      <ProfileMiniHeader
        profile={profile}
        keyStat={keyStat}
        visible={showMiniHeader}
      />

      <SharedHeader user={user} />

      <main className="max-w-3xl mx-auto px-6 py-8 pb-safe sm:pb-8 relative space-y-12 md:space-y-16">
        {/* Header section */}
        <div className="animate-fade-up">
          <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} badges={badges} />
        </div>

        {/* Stats section */}
        <div ref={statsRef} className="animate-fade-up" style={{ animationDelay: '80ms' }}>
          <ProfileSection
            title={t('stats.title', 'Stats')}
            icon={BarChart3}
            defaultOpen={true}
          >
            {stats && <ProfileStats stats={stats} hideTitle />}
          </ProfileSection>
        </div>

        {/* Rankings section */}
        <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <ProfileSection
            title={t('leaderboard.yourRank', 'Your Rank')}
            icon={Trophy}
            defaultOpen={false}
            emptyState={
              <p className="text-muted-foreground text-sm py-4 text-center">
                {t('leaderboard.rankingsEmpty', 'Add more flights to appear on leaderboards')}
              </p>
            }
          >
            {rankings.length > 0 && <ProfileRankings rankings={rankings} hideTitle />}
          </ProfileSection>
        </div>

        {/* Badges section */}
        <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
          <ProfileSection
            title={t('badges.title', 'Badges')}
            icon={Award}
            defaultOpen={false}
            emptyState={
              <p className="text-muted-foreground text-sm py-4 text-center">
                {t('badges.empty', 'Keep flying to unlock badges')}
              </p>
            }
          >
            {badges.length > 0 && <ProfileBadges badges={badges} hideTitle />}
          </ProfileSection>
        </div>
      </main>

      {/* Mobile tab bar - only show for logged-in users */}
      {user && <MobileTabBar />}
    </div>
  )
}

// Subtle くうき watermark for brand texture
function Watermark() {
  return (
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span className="text-[12rem] md:text-[16rem] font-display font-bold text-foreground opacity-[0.012] dark:opacity-[0.008] leading-none whitespace-nowrap">
        くうき
      </span>
    </div>
  )
}

// Shared header: full navbar for logged-in users, minimal for visitors
function SharedHeader({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  if (user) {
    return (
      <>
        <AppHeader />
        <MobileHeader />
      </>
    )
  }
  return <MinimalHeader />
}

// Minimal header for logged-out visitors
function MinimalHeader() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
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
