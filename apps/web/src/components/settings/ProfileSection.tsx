import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { User, Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile } from '@/lib/auth'
import { LEADERBOARD_KEY, USER_POSITIONS_KEY, TOTAL_USERS_KEY } from '@/hooks/useLeaderboard'

export function ProfileSection() {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [showOnLeaderboards, setShowOnLeaderboards] = useState(false)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
      setIsPublic(profile.is_public ?? false)
      setShowOnLeaderboards(profile.show_on_leaderboards ?? false)
    }
  }, [profile])

  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const result = await updateProfile(user.id, {
        display_name: displayName || null,
        bio: bio || null,
        is_public: isPublic,
        show_on_leaderboards: showOnLeaderboards,
      })

      if (!result.success) {
        setError(result.error || 'Failed to save')
        return
      }

      await refreshProfile()

      // Invalidate leaderboard caches so the board reflects the change
      if (showOnLeaderboards !== (profile?.show_on_leaderboards ?? false)) {
        queryClient.invalidateQueries({ queryKey: [LEADERBOARD_KEY] })
        queryClient.invalidateQueries({ queryKey: [USER_POSITIONS_KEY] })
        queryClient.invalidateQueries({ queryKey: [TOTAL_USERS_KEY] })
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges =
    displayName !== (profile?.display_name ?? '') ||
    bio !== (profile?.bio ?? '') ||
    isPublic !== (profile?.is_public ?? false) ||
    showOnLeaderboards !== (profile?.show_on_leaderboards ?? false)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          {t('profile.title', 'Profile')}
        </CardTitle>
        <CardDescription>
          {t('profile.settingsDescription', 'Customize your public profile')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
          <p className="text-xs text-muted-foreground">
            {t('profile.displayNameHint', 'Your display name or leave empty to use @{{username}}', {
              username: profile?.username
            })}
          </p>
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

        <Separator />

        {/* Privacy settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">{t('profile.visibility', 'Visibility')}</h3>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(checked) => {
                setIsPublic(checked === true)
                // If unchecking public, also uncheck leaderboards
                if (!checked) {
                  setShowOnLeaderboards(false)
                }
              }}
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

        {/* Save button */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveSuccess && <Check className="w-4 h-4" />}
            {t('common.save', 'Save')}
          </Button>

          {saveSuccess && (
            <span className="text-sm text-muted-foreground animate-in fade-in-50">
              {t('common.saved', 'Saved')}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
