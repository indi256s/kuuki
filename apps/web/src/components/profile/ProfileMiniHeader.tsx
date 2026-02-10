import { UserAvatar } from '@/components/common/UserAvatar'
import { THEME_COLORS, type ThemeColorKey } from '@/lib/profiles'
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
 * Circular avatar with theme color accent line at top.
 */
export function ProfileMiniHeader({ profile, keyStat, visible }: ProfileMiniHeaderProps) {
  const displayName = profile.display_name || profile.username || 'Anonymous'
  const themeColor = (profile.theme_color as ThemeColorKey) || 'teal'
  const accentColor = THEME_COLORS[themeColor]

  return (
    <header
      className={cn(
        // Positioning
        'fixed top-0 left-0 right-0 z-50',
        // Layout
        'flex flex-col',
        // Styling
        'bg-background/95 backdrop-blur-lg',
        'border-b border-border/50',
        // Animation
        'transition-transform duration-300 ease-out',
        'will-change-transform',
        // Visibility
        visible ? 'translate-y-0' : '-translate-y-full',
        // Mobile only
        'sm:hidden'
      )}
      aria-hidden={!visible}
    >
      {/* Theme color accent line */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Content */}
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Avatar — circular */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
          <UserAvatar
            userId={profile.id}
            avatarUrl={profile.avatar_url}
            name={displayName}
            size={32}
          />
        </div>

        {/* Name - truncated */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate text-sm">
            {displayName}
          </p>
        </div>

        {/* Key stat */}
        <span className="text-sm font-data text-muted-foreground flex-shrink-0 tabular-nums">
          {keyStat}
        </span>
      </div>
    </header>
  )
}
