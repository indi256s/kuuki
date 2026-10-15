import { hasAviationFacet, isEmptyFilter } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter } from '@kuuki/shared/overview/model'

/** The view has nothing to show: no flight and no ground journey (planned included) passes the filter. */
export function isZeroScope(scope: OverviewScope, filter: OverviewFilter): boolean {
  const { figures, globe } = scope
  if (figures.scope === 'ground') return figures.groundJourneys === 0 && globe.ground.length === 0
  return (
    figures.flights === 0 &&
    figures.groundJourneys === 0 &&
    globe.ground.length === 0 &&
    !isEmptyFilter(filter)
  )
}

/** Under По земле a flight facet excludes every ground journey; the page says so instead of showing an empty map. */
export function isAviationFacetNote(scope: OverviewScope, filter: OverviewFilter): boolean {
  return scope.figures.scope === 'ground' && hasAviationFacet(filter)
}
