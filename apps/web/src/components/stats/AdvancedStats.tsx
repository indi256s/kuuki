import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane, Globe2, Clock } from 'lucide-react'
import { useFlightStats } from '@/hooks/useStats'
import { useUnlockProgress } from '@/hooks/useAdvancedStats'
import { OverviewTier } from './OverviewTier'
import { TierContainer } from './TierContainer'
import { UnlockToast } from './UnlockToast'
import { AviaGeekTier } from './AviaGeekTier'
import { CountryGeekTier } from './CountryGeekTier'
import { DurationStatsTier } from './DurationStatsTier'

export function AdvancedStats() {
  const { t } = useTranslation()
  const { data: stats } = useFlightStats()
  const { data: unlockProgress } = useUnlockProgress()

  // Track newly unlocked tiers for celebration
  const previousUnlocksRef = useRef<{
    aviaGeek: boolean
    countryGeek: boolean
    duration: boolean
  } | null>(null)
  const [newlyUnlocked, setNewlyUnlocked] = useState<string | null>(null)

  // Detect new unlocks
  useEffect(() => {
    if (!unlockProgress) return

    const prev = previousUnlocksRef.current
    if (prev === null) {
      // First load - just set the baseline
      previousUnlocksRef.current = {
        aviaGeek: unlockProgress.aviaGeek.unlocked,
        countryGeek: unlockProgress.countryGeek.unlocked,
        duration: unlockProgress.duration.unlocked,
      }
      return
    }

    // Check for new unlocks
    if (!prev.aviaGeek && unlockProgress.aviaGeek.unlocked) {
      setNewlyUnlocked('aviaGeek')
    } else if (!prev.countryGeek && unlockProgress.countryGeek.unlocked) {
      setNewlyUnlocked('countryGeek')
    } else if (!prev.duration && unlockProgress.duration.unlocked) {
      setNewlyUnlocked('duration')
    }

    previousUnlocksRef.current = {
      aviaGeek: unlockProgress.aviaGeek.unlocked,
      countryGeek: unlockProgress.countryGeek.unlocked,
      duration: unlockProgress.duration.unlocked,
    }
  }, [unlockProgress])

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
          title={t('stats.aviaGeekLabel', 'Avia Geek')}
          icon={Plane}
          isUnlocked={unlockProgress?.aviaGeek.unlocked ?? false}
          progress={unlockProgress?.aviaGeek}
          delay={200}
        >
          <AviaGeekTier />
        </TierContainer>

        {/* Country Geek Tier */}
        <TierContainer
          tier="countryGeek"
          title={t('stats.countryGeekLabel', 'Country Geek')}
          icon={Globe2}
          isUnlocked={unlockProgress?.countryGeek.unlocked ?? false}
          progress={unlockProgress?.countryGeek}
          delay={275}
        >
          <CountryGeekTier />
        </TierContainer>
      </div>

      {/* Duration Tier - Full width */}
      <TierContainer
        tier="duration"
        title={t('stats.timeGeekLabel', 'Time Geek')}
        icon={Clock}
        isUnlocked={unlockProgress?.duration.unlocked ?? false}
        progress={unlockProgress?.duration}
        delay={350}
      >
        <DurationStatsTier />
      </TierContainer>

      {/* Unlock celebration toast */}
      <UnlockToast
        tier={newlyUnlocked}
        onDismiss={() => setNewlyUnlocked(null)}
      />
    </div>
  )
}
