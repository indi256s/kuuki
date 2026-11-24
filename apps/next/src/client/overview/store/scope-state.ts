import { hasAviationFacet, isEmptyFilter } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter } from '@kuuki/shared/overview/model'

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

export function isAviationFacetNote(scope: OverviewScope, filter: OverviewFilter): boolean {
  return scope.figures.scope === 'ground' && hasAviationFacet(filter)
}
