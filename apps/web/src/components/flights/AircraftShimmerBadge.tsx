import { useTranslation } from 'react-i18next'
import { Plane } from 'lucide-react'
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

  // For 'pending' status, show loading badge with pulse animation
  // (This shouldn't render for 'enriched' or 'skipped' as aircraft would be set)
  return (
    <Badge
      className={cn(
        'gap-1.5 text-primary/70 bg-primary/5 border-primary/20 animate-pulse',
        className
      )}
    >
      <Plane className="w-3 h-3" />
      <span>{t('flights.enriching', 'Looking up...')}</span>
    </Badge>
  )
}
