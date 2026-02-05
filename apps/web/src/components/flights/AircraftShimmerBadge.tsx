import { AircraftPendingBadge } from './AircraftPendingBadge'

interface AircraftShimmerBadgeProps {
  flightId: number
  className?: string
}

/**
 * Shows a static clickable badge for non-enriched states.
 * No loading animations - enrichment happens in background, user can set aircraft immediately.
 */
export function AircraftShimmerBadge({
  flightId,
  className,
}: AircraftShimmerBadgeProps) {
  // Always show the clickable badge for pending/failed enrichment
  // This gives users immediate control to set aircraft manually
  return <AircraftPendingBadge flightId={flightId} className={className} />
}
