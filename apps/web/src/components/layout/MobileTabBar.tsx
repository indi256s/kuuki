import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Plane,
  Upload,
  Globe2,
  Settings,
  Route,
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

  // Build tabs array - replaced Profile with Settings since profile is accessible via settings
  const tabs: TabItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/flights', icon: Plane, labelKey: 'nav.flights' },
    { path: '/journey', icon: Route, labelKey: 'nav.journey' },
    { path: '/import', icon: Upload, labelKey: 'nav.import' },
    { path: '/passport', icon: Globe2, labelKey: 'nav.passport' },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
  ]

  const isActive = (path: string) => {
    // Handle exact match for dashboard and settings
    if (path === '/dashboard' || path === '/settings') {
      return location.pathname === path
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
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] h-full px-2 transition-colors ${active
                ? 'text-primary'
                : 'text-muted-foreground active:text-foreground'
                }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''
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
