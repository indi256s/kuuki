import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useFlightStats } from '@/hooks/useStats'
import { useSyncUpcomingFlights } from '@/hooks/useFlights'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentFlights } from '@/components/dashboard/RecentFlights'
import { RouteMap } from '@/components/map/RouteMap'
import { FlightForm } from '@/components/flights/FlightForm'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ProfileSettingsDialog } from '@/components/profile/ProfileSettingsDialog'
import { CompareModal } from '@/components/compare/CompareModal'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Plane, LogOut, Languages, User, Trophy, GitCompare } from 'lucide-react'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const { data: stats } = useFlightStats()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)

  // Sync upcoming flights on dashboard load
  useSyncUpcomingFlights()

  const hasFlights = (stats?.totalFlights ?? 0) > 0 || (stats?.upcomingFlights ?? 0) > 0

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  const handleAddFlight = useCallback(() => {
    setIsFormOpen(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Header - clean, minimal */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
              </div>
              <span className="text-lg font-semibold tracking-tight">
                {t('common.appName')}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/flights"
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
              >
                {t('nav.flights', 'Flights')}
              </Link>
              <Link
                to="/passport"
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
              >
                {t('nav.passport', 'Passport')}
              </Link>
              <Link
                to="/import"
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
              >
                {t('nav.import', 'Import')}
              </Link>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasFlights && (
              <Button onClick={handleAddFlight} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('flights.addFlight', 'Add Flight')}</span>
              </Button>
            )}

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative w-9 h-9 rounded-full">
                  <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                    {initials}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                  <User className="w-4 h-4 mr-2" />
                  {t('nav.profile', 'Profile')}
                </DropdownMenuItem>
                {profile?.username && (
                  <DropdownMenuItem asChild>
                    <Link to={`/fly/${profile.username}`}>
                      <Trophy className="w-4 h-4 mr-2" />
                      {t('profile.viewPublic', 'View Public Profile')}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsCompareOpen(true)}>
                  <GitCompare className="w-4 h-4 mr-2" />
                  {t('compare.title', 'Compare Stats')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/leaderboard">
                    <Trophy className="w-4 h-4 mr-2" />
                    {t('nav.leaderboard', 'Leaderboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleLanguage}>
                  <Languages className="w-4 h-4 mr-2" />
                  {currentLanguage === 'en' ? 'Русский' : 'English'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('auth.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome section */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
            {t('dashboard.welcome', { name: displayName })}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {hasFlights
              ? t('dashboard.subtitle', 'Here\'s your travel overview')
              : t('dashboard.emptySubtitle', 'Start tracking your flights')}
          </p>
        </div>

        {hasFlights ? (
          <div className="space-y-8">
            {/* Stats grid */}
            <StatsCards />

            {/* Route map */}
            <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm">
                <RouteMap height="320px" />
              </div>
            </div>

            {/* Recent & upcoming flights */}
            <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
              <RecentFlights onAddFlight={handleAddFlight} />
            </div>
          </div>
        ) : (
          <EmptyState onAddFlight={handleAddFlight} />
        )}
      </main>

      {/* Flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
      />

      {/* Profile settings modal */}
      <ProfileSettingsDialog
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Compare modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />
    </div>
  )
}
