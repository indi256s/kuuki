import { useTranslation } from 'react-i18next'
import { Plane, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AircraftPendingBadge } from './AircraftPendingBadge'
import { cn } from '@/lib/utils'
import type { EnrichmentStatus } from '@kuuki/shared/types'

interface AircraftShimmerBadgeProps {
  flightId: number
  enrichmentStatus: EnrichmentStatus | null
  className?: string
}

/**
 * Smart badge that shows different states based on enrichment status:
 * - 'pending': Shimmer animation (enrichment in progress)
 * - 'failed': Falls back to AircraftPendingBadge for manual entry
 * - 'enriched'/'skipped': Should not render this component (aircraft is set)
 */
export function AircraftShimmerBadge({
  flightId,
  enrichmentStatus,
  className,
}: AircraftShimmerBadgeProps) {
  const { t } = useTranslation()

  // For 'failed' status, show the manual entry badge
  if (enrichmentStatus === 'failed') {
    return <AircraftPendingBadge flightId={flightId} className={className} />
  }

  // For 'pending' status, show shimmer animation
  // (This shouldn't render for 'enriched' or 'skipped' as aircraft would be set)
  return (
    <Badge
      variant="outline"
      className={cn(
        'relative overflow-hidden gap-1.5 text-muted-foreground border-dashed',
        className
      )}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-muted/40 to-transparent"
        aria-hidden="true"
      />

      {/* Icon - plane for pending, refresh for retrying */}
      <Plane className="w-3 h-3 animate-pulse" />

      {/* Text */}
      <span className="relative">
        {t('flights.enriching', 'Looking up...')}
      </span>
    </Badge>
  )
}
