import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plane, UserX } from 'lucide-react'
import { usePublicProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { ProfileBadges } from '@/components/profile/ProfileBadges'
import { ProfileRankings } from '@/components/profile/ProfileRankings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profileData, isLoading, error } = usePublicProfile(username)

  const isOwnProfile = user?.id === profileData?.profile?.id

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-8">
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
        <main className="max-w-3xl mx-auto px-6 py-8">
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

  // Private profile view
  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-8">
          <Card className="overflow-hidden">
            <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
          </Card>
        </main>
      </div>
    )
  }

  // Full public profile view
  return (
    <div className="min-h-screen bg-gradient-soft">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <Card className="overflow-hidden animate-fade-up">
          <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
        </Card>

        {/* Stats section */}
        {stats && (
          <div className="mt-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <ProfileStats stats={stats} />
          </div>
        )}

        {/* Rankings section */}
        {rankings.length > 0 && (
          <div className="mt-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <ProfileRankings rankings={rankings} />
          </div>
        )}

        {/* Badges section */}
        <div className="mt-6 animate-fade-up" style={{ animationDelay: '150ms' }}>
          <ProfileBadges badges={badges} />
        </div>
      </main>
    </div>
  )
}

// Minimal header for profile pages
function Header() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {t('common.appName')}
          </span>
        </Link>

        <ThemeToggle />
      </div>
    </header>
  )
}
