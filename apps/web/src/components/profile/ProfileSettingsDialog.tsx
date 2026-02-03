import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ExternalLink, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ThemeColorPicker } from './ThemeColorPicker'
import { updateProfile } from '@/lib/auth'
import { generateAvatarUrl, type ThemeColorKey } from '@/lib/profiles'
import { useAuth } from '@/hooks/useAuth'

interface ProfileSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileSettingsDialog({ isOpen, onClose }: ProfileSettingsDialogProps) {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [themeColor, setThemeColor] = useState<ThemeColorKey>('teal')
  const [isPublic, setIsPublic] = useState(false)
  const [showOnLeaderboards, setShowOnLeaderboards] = useState(false)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
      setThemeColor((profile.theme_color as ThemeColorKey) ?? 'teal')
      setIsPublic(profile.is_public ?? false)
      setShowOnLeaderboards(profile.show_on_leaderboards ?? false)
    }
  }, [profile])

  const profileUrl = profile?.username
    ? `${window.location.origin}/fly/${profile.username}`
    : null

  const handleCopyUrl = async () => {
    if (!profileUrl) return
    await navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    setError(null)

    try {
      const result = await updateProfile(user.id, {
        display_name: displayName || null,
        bio: bio || null,
        theme_color: themeColor,
        is_public: isPublic,
        show_on_leaderboards: showOnLeaderboards,
      })

      if (!result.success) {
        setError(result.error || 'Failed to save')
        return
      }

      await refreshProfile()
      onClose()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const avatarUrl = profile?.avatar_url || generateAvatarUrl(user?.id ?? '', themeColor)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.title', 'Profile')}</DialogTitle>
          <DialogDescription>
            {t('profile.settingsDescription', 'Customize your public profile')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="w-16 h-16 rounded-xl object-cover"
              style={{ backgroundColor: `${profile?.theme_color ?? themeColor}20` }}
            />
            <div className="flex-1">
              <p className="font-medium">{displayName || profile?.username || 'Your Name'}</p>
              <p className="text-sm text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>

          <Separator />

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName', 'Display Name')}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={profile?.username ?? ''}
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">{t('profile.bio', 'Bio')}</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.bioPlaceholder', 'Tell us about yourself...')}
              maxLength={140}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/140
            </p>
          </div>

          {/* Theme color */}
          <ThemeColorPicker value={themeColor} onChange={setThemeColor} />

          <Separator />

          {/* Privacy settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('profile.visibility', 'Visibility')}</h3>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="isPublic" className="cursor-pointer">
                  {t('profile.publicProfile', 'Public Profile')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profile.publicProfileDescription', 'Anyone can view your stats and badges')}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="showOnLeaderboards"
                checked={showOnLeaderboards}
                onCheckedChange={(checked) => setShowOnLeaderboards(checked === true)}
                disabled={!isPublic}
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="showOnLeaderboards"
                  className={`cursor-pointer ${!isPublic ? 'text-muted-foreground' : ''}`}
                >
                  {t('profile.showOnLeaderboards', 'Show on Leaderboards')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profile.showOnLeaderboardsDescription', 'Appear in public rankings (requires 10+ flights)')}
                </p>
              </div>
            </div>
          </div>

          {/* Profile URL */}
          {profileUrl && isPublic && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>{t('profile.profileUrl', 'Profile URL')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={profileUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyUrl}
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
