import {
  Plane,
  Route,
  Building2,
  Building,
  Clock,
  Globe,
  TowerControl,
  Flag,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBadgeTier } from '@/hooks/useBadgeTier'
import { getTierVisual } from '@/lib/tier-visuals'
import { getFlavorText, getTimeRelatable } from '@/lib/glados-dashboard'
import { BADGE_TRACKS, type BadgeTrackId } from '@/lib/badge-tracks'
import { formatDistance } from '@/lib/geo'
import { formatDuration } from '@/lib/formatDuration'
import { cn } from '@/lib/utils'

const TRACK_ICONS: Record<BadgeTrackId, React.ElementType> = {
  flights: Plane,
  distance: Route,
  airlines: Building2,
  aircraft: Plane,
  cities: Building,
  time_in_air: Clock,
  continents: Globe,
  airports: TowerControl,
  countries: Flag,
}

function formatValue(trackId: BadgeTrackId, value: number): string {
  const track = BADGE_TRACKS[trackId]
  switch (track.format) {
    case 'distance':
      return formatDistance(value)
    case 'duration':
      return formatDuration(value, { style: 'adaptive' })
    case 'number':
    default:
      return value.toLocaleString()
  }
}

export function MicroBadgeStatCard({
  trackId,
  className,
}: {
  trackId: BadgeTrackId
  className?: string
}) {
  const { t } = useTranslation()
  const { tier, tierIndex, value } = useBadgeTier(trackId)
  const visual = getTierVisual(tier)
  const track = BADGE_TRACKS[trackId]
  const Icon = TRACK_ICONS[trackId]

  const badgeName =
    tierIndex >= 0 ? track.thresholds[tierIndex].name : null

  const flavorText = getFlavorText(trackId, tierIndex, value)
  const subtitle =
    trackId === 'time_in_air'
      ? getTimeRelatable(value) || flavorText
      : flavorText

  return (
    <div
      className={cn(
        'group rounded-2xl border bg-card p-4',
        'transition-all duration-300',
        visual.border,
        'hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon with tier-colored background */}
        <div
          className={cn(
            'flex items-center justify-center rounded-xl size-10 shrink-0',
            'transition-transform duration-300 group-hover:scale-110',
            visual.iconBg,
          )}
        >
          <Icon className={cn('size-5', visual.text)} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-mono font-bold tracking-tight leading-none">
            {formatValue(trackId, value)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t(`dashboard.track.${trackId}`, trackId)}
          </div>
          {badgeName && (
            <div className={cn('text-xs font-medium mt-0.5', visual.text)}>
              {badgeName}
            </div>
          )}
          <div className="text-[11px] italic text-muted-foreground/60 mt-1 leading-snug">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  )
}
