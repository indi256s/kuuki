import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KuukiIcon } from '@/components/common/KuukiIcon'
import { AccentPicker } from '@/components/common/AccentPicker'
import { useAccentColor } from '@/hooks/useAccentColor'

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
  const { accentColor, setAccentColor } = useAccentColor()

  return (
    <header
      data-testid="mobile-header"
      className="sticky top-0 z-40 sm:hidden bg-background/80 backdrop-blur-xl border-b border-border/50"
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
          <AccentPicker
            value={accentColor}
            onChange={setAccentColor}
          />
          {action}
        </div>
      </div>
    </header>
  )
}
