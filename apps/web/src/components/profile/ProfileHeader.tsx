import { useTranslation } from 'react-i18next'
import { Lock, Calendar, Sparkles, Share2, Check } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  const [copied, setCopied] = useState(false)

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

  const handleShare = async () => {
    const url = `${window.location.origin}/fly/${profile.username}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      {/* Atmospheric banner with radial gradient + grain */}
      <div
        className="relative h-40 md:h-52 overflow-hidden"
      >
        {/* Warm radial gradient — light source from above */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentColor}25 0%, ${accentColor}08 50%, transparent 100%)`,
          }}
        />
        {/* Subtle grain overlay — washi paper texture */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Profile info — generous Ma spacing */}
      <div className="px-6 md:px-8 pb-8">
        {/* Avatar — circular with lantern glow */}
        <div className="relative -mt-16 md:-mt-20 mb-6">
          <div
            className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-background overflow-hidden"
            style={{
              boxShadow: `0 0 24px ${accentColor}30, 0 0 48px ${accentColor}15`,
            }}
          >
            <UserAvatar
              userId={profile.id}
              avatarUrl={profile.avatar_url}
              name={displayName}
              size={144}
            />
          </div>

          {/* Privacy badge */}
          {!profile.is_public && (
            <div className="absolute -bottom-1 -right-1">
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                {t('profile.private', 'Private')}
              </Badge>
            </div>
          )}
        </div>

        {/* Name, username, badges — stacked with breathing room */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">
              {displayName}
            </h1>
            {profile.username && (
              <p className="font-data text-sm text-muted-foreground">
                @{profile.username}
                {isOwnProfile && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-sans">
                    {t('profile.you', 'You')}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-base text-foreground/80 max-w-lg leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Meta pills — member since + founding user */}
          <div className="flex flex-wrap items-center gap-2">
            {isFoundingUser && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/50 text-primary px-3 py-1.5 rounded-full font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                {t('profile.foundingUser')}
              </span>
            )}
            {memberSince && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/50 text-muted-foreground px-3 py-1.5 rounded-full">
                <Calendar className="w-3.5 h-3.5" />
                {t('profile.memberSince', { date: memberSince })}
              </span>
            )}
            {isOwnProfile && profile.username && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-full"
                onClick={handleShare}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? t('common.copied', 'Copied') : t('profile.share', 'Share')}
              </Button>
            )}
          </div>
        </div>

        {/* Privacy notice for private profiles */}
        {!profile.is_public && !isOwnProfile && (
          <div className="mt-6 p-4 rounded-xl bg-secondary/50 text-muted-foreground text-sm">
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
