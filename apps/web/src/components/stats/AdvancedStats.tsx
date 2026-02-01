import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane, Globe2, Clock } from 'lucide-react'
import { useFlightStats } from '@/hooks/useStats'
import { useUnlockProgress } from '@/hooks/useAdvancedStats'
import { OverviewTier } from './OverviewTier'
import { TierContainer } from './TierContainer'
import { UnlockToast } from './UnlockToast'

// Placeholder tiers for Phase 5b/5c - will be replaced with actual implementations
function AviaGeekPlaceholder() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Aircraft insights coming in Phase 5b...
      </p>
      <div className="flex gap-2">
        {['Airbus', 'Boeing', 'Embraer'].map((name) => (
          <div
            key={name}
            className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}

function CountryGeekPlaceholder() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Country analytics coming in Phase 5b...
      </p>
      <div className="grid grid-cols-3 gap-2">
        {['EU', 'AS', 'NA', 'SA', 'AF', 'OC'].map((code) => (
          <div
            key={code}
            className="px-3 py-2 rounded-lg bg-muted/50 text-center"
          >
            <span className="text-xs font-mono text-muted-foreground">{code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DurationPlaceholder() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Duration stats coming in Phase 5c...
      </p>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-3/4 bg-primary/40 rounded-full" />
        </div>
        <span className="text-xs font-mono text-muted-foreground">0h</span>
      </div>
    </div>
  )
}

export function AdvancedStats() {
  const { t } = useTranslation()
  const { data: stats } = useFlightStats()
  const { data: unlockProgress } = useUnlockProgress()

  // Track newly unlocked tiers for celebration
  const [previousUnlocks, setPreviousUnlocks] = useState<{
    aviaGeek: boolean
    countryGeek: boolean
    duration: boolean
  } | null>(null)
  const [newlyUnlocked, setNewlyUnlocked] = useState<string | null>(null)

  // Detect new unlocks
  useEffect(() => {
    if (!unlockProgress) return

    if (previousUnlocks === null) {
      // First load - just set the baseline
      setPreviousUnlocks({
        aviaGeek: unlockProgress.aviaGeek.unlocked,
        countryGeek: unlockProgress.countryGeek.unlocked,
        duration: unlockProgress.duration.unlocked,
      })
      return
    }

    // Check for new unlocks
    if (!previousUnlocks.aviaGeek && unlockProgress.aviaGeek.unlocked) {
      setNewlyUnlocked('aviaGeek')
    } else if (!previousUnlocks.countryGeek && unlockProgress.countryGeek.unlocked) {
      setNewlyUnlocked('countryGeek')
    } else if (!previousUnlocks.duration && unlockProgress.duration.unlocked) {
      setNewlyUnlocked('duration')
    }

    setPreviousUnlocks({
      aviaGeek: unlockProgress.aviaGeek.unlocked,
      countryGeek: unlockProgress.countryGeek.unlocked,
      duration: unlockProgress.duration.unlocked,
    })
  }, [unlockProgress, previousUnlocks])

  const hasFlights = (stats?.totalFlights ?? 0) > 0

  if (!hasFlights) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Overview Tier - Always visible */}
      <section>
        <OverviewTier />
      </section>

      {/* Specialized Tiers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Avia Geek Tier */}
        <TierContainer
          tier="aviaGeek"
          title={t('stats.aviaGeek', 'Avia Geek')}
          icon={Plane}
          isUnlocked={unlockProgress?.aviaGeek.unlocked ?? false}
          progress={unlockProgress?.aviaGeek}
          delay={200}
        >
          <AviaGeekPlaceholder />
        </TierContainer>

        {/* Country Geek Tier */}
        <TierContainer
          tier="countryGeek"
          title={t('stats.countryGeek', 'Country Geek')}
          icon={Globe2}
          isUnlocked={unlockProgress?.countryGeek.unlocked ?? false}
          progress={unlockProgress?.countryGeek}
          delay={275}
        >
          <CountryGeekPlaceholder />
        </TierContainer>
      </div>

      {/* Duration Tier - Full width */}
      <TierContainer
        tier="duration"
        title={t('stats.timeGeek', 'Time Geek')}
        icon={Clock}
        isUnlocked={unlockProgress?.duration.unlocked ?? false}
        progress={unlockProgress?.duration}
        delay={350}
      >
        <DurationPlaceholder />
      </TierContainer>

      {/* Unlock celebration toast */}
      <UnlockToast
        tier={newlyUnlocked}
        onDismiss={() => setNewlyUnlocked(null)}
      />
    </div>
  )
}
