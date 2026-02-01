import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { X, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UserSearchInput } from './UserSearchInput'
import { CompareChart } from './CompareChart'
import { useUserStats } from '@/hooks/useProfile'
import { useCompareStats } from '@/hooks/useCompare'
import { useAuth } from '@/hooks/useAuth'
import { generateAvatarUrl, type Profile } from '@/lib/profiles'

interface CompareModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CompareModal({ isOpen, onClose }: CompareModalProps) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)

  const { data: myStats, isLoading: isLoadingMyStats } = useUserStats()
  const { data: theirStats, isLoading: isLoadingTheirStats } = useCompareStats(selectedUser?.id ?? null)

  const handleSelectUser = (profile: Profile) => {
    setSelectedUser(profile)
  }

  const handleClear = () => {
    setSelectedUser(null)
  }

  const myName = profile?.display_name || profile?.username || 'You'
  const theirName = selectedUser?.display_name || selectedUser?.username || 'Them'
  const theirAvatarUrl = selectedUser?.avatar_url || (selectedUser ? generateAvatarUrl(selectedUser.id, 'teal') : null)

  const isLoading = isLoadingMyStats || isLoadingTheirStats
  const hasData = myStats && theirStats

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('compare.title', 'Compare Stats')}</DialogTitle>
          <DialogDescription>
            {t('compare.description', 'See how your travel stats stack up against another traveler')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Search or selected user */}
          {selectedUser ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3">
                <img
                  src={theirAvatarUrl ?? ''}
                  alt={theirName}
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <div>
                  <p className="font-medium">{theirName}</p>
                  <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/fly/${selectedUser.username}`} target="_blank">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <UserSearchInput
              onSelect={handleSelectUser}
              excludeUserId={user?.id}
              placeholder={t('compare.searchPlaceholder', 'Search for a traveler to compare...')}
            />
          )}

          {/* Comparison chart */}
          {selectedUser && (
            <div className="min-h-[300px]">
              {isLoading ? (
                <div className="space-y-6">
                  <Skeleton className="h-16 rounded-xl" />
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8" />
                      <Skeleton className="h-8" />
                    </div>
                  ))}
                </div>
              ) : hasData ? (
                <CompareChart
                  yourStats={myStats}
                  theirStats={theirStats}
                  yourName={myName}
                  theirName={theirName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>{t('compare.noData', 'Unable to load comparison data')}</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selectedUser && (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <p className="text-sm text-center">
                {t('compare.emptyState', 'Search for another traveler to compare your stats')}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
