import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Plane,
  Upload,
  Globe2,
  User,
  type LucideIcon,
} from 'lucide-react'

interface TabItem {
  path: string
  icon: LucideIcon
  labelKey: string
}

/**
 * Mobile bottom tab navigation bar.
 *
 * - Only visible on screens < 640px (sm breakpoint)
 * - Fixed to bottom with safe area padding for notched devices
 * - Uses React Router's location for active state (URL as source of truth)
 * - Always shows labels for accessibility
 * - Profile tab dynamically links to user's public profile if username exists
 */
export function MobileTabBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { profile } = useAuth()

  // Build tabs array with dynamic profile path
  const tabs: TabItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/flights', icon: Plane, labelKey: 'nav.flights' },
    { path: '/import', icon: Upload, labelKey: 'nav.import' },
    { path: '/passport', icon: Globe2, labelKey: 'nav.passport' },
    {
      // Link to user's own public profile if they have a username, else dashboard
      path: profile?.username ? `/fly/${profile.username}` : '/dashboard',
      icon: User,
      labelKey: 'nav.profile',
    },
  ]

  const isActive = (path: string) => {
    // Handle exact match for dashboard
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    // Handle profile - check both /fly/ prefix and exact match
    if (path.startsWith('/fly/')) {
      return location.pathname.startsWith('/fly/')
    }
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      data-testid="mobile-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 h-tab-bar"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          const Icon = tab.icon

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] h-full px-2 transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  active ? 'scale-110' : ''
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] leading-tight ${active ? 'font-medium' : ''}`}>
                {t(tab.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
