import { generateAvatarUrl, type ThemeColorKey } from '@/lib/profiles'
import { cn } from '@/lib/utils'

interface ProfileMiniHeaderProps {
  /** User's profile data */
  profile: {
    id: string
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
    theme_color?: string | null
  }
  /** Key stat to display (e.g., "125 flights") */
  keyStat: string
  /** Whether the mini-header is visible */
  visible: boolean
}

/**
 * ProfileMiniHeader - Sticky mini-header that appears on scroll.
 *
 * Design decisions:
 * - Fixed at top of viewport, appears when main profile header scrolls out
 * - Shows avatar + name + key stat in a compact layout
 * - Uses CSS transform for GPU-accelerated slide animation
 * - Backdrop blur for depth perception
 * - Mobile-only component (hidden on sm+ breakpoints)
 */
export function ProfileMiniHeader({ profile, keyStat, visible }: ProfileMiniHeaderProps) {
  const displayName = profile.display_name || profile.username || 'Anonymous'
  const themeColor = (profile.theme_color as ThemeColorKey) || 'teal'
  const avatarUrl = profile.avatar_url || generateAvatarUrl(profile.id, themeColor)
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header
      className={cn(
        // Positioning
        'fixed top-0 left-0 right-0 z-50',
        // Sizing
        'h-14',
        // Layout
        'flex items-center gap-3 px-4',
        // Styling
        'bg-background/95 backdrop-blur-lg',
        'border-b border-border/50',
        // Animation - transform-based for GPU acceleration
        'transition-transform duration-300 ease-out',
        'will-change-transform',
        // Visibility
        visible ? 'translate-y-0' : '-translate-y-full',
        // Mobile only
        'sm:hidden'
      )}
      aria-hidden={!visible}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
            {initials}
          </div>
        )}
      </div>

      {/* Name - truncated */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-sm">
          {displayName}
        </p>
      </div>

      {/* Key stat */}
      <span className="text-sm text-muted-foreground flex-shrink-0">
        {keyStat}
      </span>
    </header>
  )
}
