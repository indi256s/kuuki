import { useTranslation } from 'react-i18next'
import { Lock, Calendar, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { THEME_COLORS, type ThemeColorKey } from '@/lib/profiles'
import type { Profile } from '@/lib/profiles'

interface ProfileHeaderProps {
  profile: Profile
  isOwnProfile?: boolean
  badges?: Array<{ badge: { code: string } }>
}

export function ProfileHeader({ profile, isOwnProfile, badges }: ProfileHeaderProps) {
  const { t } = useTranslation()

  const themeColor = (profile.theme_color as ThemeColorKey) || 'teal'
  const accentColor = THEME_COLORS[themeColor]
  const displayName = profile.display_name || profile.username || 'Anonymous'
  const isFoundingUser = badges?.some(b => b.badge.code === 'founding-user')
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : null

  return (
    <div className="relative">
      {/* Gradient banner with theme color */}
      <div
        className="h-32 md:h-40 rounded-t-2xl"
        style={{
          background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`,
        }}
      />

      {/* Profile info */}
      <div className="px-6 pb-6">
        {/* Avatar - positioned to overlap banner */}
        <div className="relative -mt-16 mb-4">
          <div
            className="w-28 h-28 md:w-32 md:h-32 rounded-2xl border-4 border-background shadow-lg overflow-hidden"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <UserAvatar
              userId={profile.id}
              avatarUrl={profile.avatar_url}
              name={displayName}
              size={128}
            />
          </div>

          {/* Privacy badge */}
          {!profile.is_public && (
            <div className="absolute -bottom-2 -right-2">
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                {t('profile.private', 'Private')}
              </Badge>
            </div>
          )}
        </div>

        {/* Name and username */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2 flex-wrap">
            {displayName}
            {isFoundingUser && (
              <span className="inline-flex items-center gap-1 text-sm bg-primary/15 text-primary px-2.5 py-0.5 rounded-full font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                {t('profile.foundingUser')}
              </span>
            )}
          </h1>
          {profile.username && (
            <p className="text-muted-foreground">
              @{profile.username}
              {isOwnProfile && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {t('profile.you', 'You')}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-foreground/80 max-w-xl">
            {profile.bio}
          </p>
        )}

        {/* Member since */}
        {memberSince && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {t('profile.memberSince', { date: memberSince })}
          </div>
        )}

        {/* Privacy notice for private profiles */}
        {!profile.is_public && !isOwnProfile && (
          <div className="mt-4 p-4 rounded-xl bg-secondary/50 text-muted-foreground text-sm">
            <p className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {t('profile.prefersPrivacy', 'This user prefers privacy')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
