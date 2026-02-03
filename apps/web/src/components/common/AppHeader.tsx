import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, LogOut, Languages, Settings } from 'lucide-react'
import { KuukiIcon } from '@/components/common/KuukiIcon'

interface AppHeaderProps {
  onAddFlight?: () => void
  showAddButton?: boolean
}

export function AppHeader({ onAddFlight, showAddButton = false }: AppHeaderProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard', 'Dashboard') },
    { path: '/flights', label: t('nav.flights', 'Flights') },
    { path: '/import', label: t('nav.import', 'Import') },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <header
      data-testid="desktop-header"
      className="hidden sm:block sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <KuukiIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              {t('common.appName')}
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${isActive(item.path)
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {showAddButton && onAddFlight && (
            <Button onClick={onAddFlight} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('flights.addFlight', 'Add Flight')}</span>
            </Button>
          )}

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
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  {t('nav.settings')}
                </Link>
              </DropdownMenuItem>
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
  )
}
