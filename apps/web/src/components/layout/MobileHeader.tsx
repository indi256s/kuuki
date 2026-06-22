import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { KuukiIcon } from '@/components/common/KuukiIcon'
import { AppearanceToggle } from '@/components/common/AppearanceToggle'
import { useUserBadges } from '@/hooks/useBadges'

interface MobileHeaderProps {
  /** Optional title to show instead of/alongside the logo */
  title?: string
  /** Optional action element (button, dropdown, etc.) for the right side */
  action?: React.ReactNode
}

/**
 * Minimal header for mobile screens.
 *
 * - Only visible on screens < 640px (sm breakpoint)
 * - Sticky positioning with backdrop blur
 * - Shows logo on left, optional action on right
 * - Height: 56px (14 * 4 = 3.5rem)
 */
export function MobileHeader({ title, action }: MobileHeaderProps) {
  const { t } = useTranslation()
  const { data: badges } = useUserBadges()
  const isFoundingUser = badges?.some(b => b.badge.code === 'founding-user')

  return (
    <header
      data-testid="mobile-header"
      className="sticky top-0 z-40 sm:hidden bg-background/95 border-b border-border/50"
    >
      <div className="px-4 h-14 flex items-center justify-between">
        {/* Logo / Title */}
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <KuukiIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {title || t('common.appName')}
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <AppearanceToggle />
          {isFoundingUser && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-1 rounded-full font-medium">
              <Sparkles className="w-3 h-3" />
              {t('profile.foundingUser')}
            </span>
          )}
          {action}
        </div>
      </div>
    </header>
  )
}
