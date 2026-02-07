import { useMemo } from 'react'
import { useDashboardStats } from './useDashboardStats'
import { useAdvancedStats } from './useAdvancedStats'
import {
  BADGE_TRACKS,
  BADGE_TRACK_IDS,
  type BadgeTier,
  type BadgeTrackId,
} from '@/lib/badge-tracks'

export interface BadgeTierResult {
  tier: BadgeTier | null
  tierIndex: number
  value: number
}

/**
 * Returns badge tier info for a single track
 */
export function useBadgeTier(trackId: BadgeTrackId): BadgeTierResult {
  const { data: stats } = useDashboardStats()
  const { data: advanced } = useAdvancedStats()

  return useMemo(() => {
    if (!stats) return { tier: null, tierIndex: -1, value: 0 }

    const value = getStatValue(trackId, stats, advanced)
    return computeTier(trackId, value)
  }, [trackId, stats, advanced])
}

/**
 * Returns badge tier info for all tracks at once
 */
export function useAllBadgeTiers(): Record<BadgeTrackId, BadgeTierResult> {
  const { data: stats } = useDashboardStats()
  const { data: advanced } = useAdvancedStats()

  return useMemo(() => {
    const result = {} as Record<BadgeTrackId, BadgeTierResult>

    for (const trackId of BADGE_TRACK_IDS) {
      if (!stats) {
        result[trackId] = { tier: null, tierIndex: -1, value: 0 }
      } else {
        const value = getStatValue(trackId, stats, advanced)
        result[trackId] = computeTier(trackId, value)
      }
    }

    return result
  }, [stats, advanced])
}

function getStatValue(
  trackId: BadgeTrackId,
  stats: NonNullable<ReturnType<typeof useDashboardStats>['data']>,
  advanced: ReturnType<typeof useAdvancedStats>['data'],
): number {
  const track = BADGE_TRACKS[trackId]

  // Special case: continents come from advanced stats
  if (track.statKey === 'continentsCount') {
    if (!advanced?.continentBreakdown) return 0
    return Object.keys(advanced.continentBreakdown).length
  }

  return (stats[track.statKey as keyof typeof stats] as number) ?? 0
}

function computeTier(trackId: BadgeTrackId, value: number): BadgeTierResult {
  const track = BADGE_TRACKS[trackId]
  let tierIndex = -1

  for (let i = track.thresholds.length - 1; i >= 0; i--) {
    if (value >= track.thresholds[i].value) {
      tierIndex = i
      break
    }
  }

  return {
    tier: tierIndex >= 0 ? track.thresholds[tierIndex].tier : null,
    tierIndex,
    value,
  }
}
