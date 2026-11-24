import {
  REGION_IDS,
  REGION_TOTALS,
  type RegionId,
} from '../../../packages/shared/src/countryRegions.generated'
import { catalogRegionOf } from '../../../packages/shared/src/regions'

export type { RegionId }
export { catalogRegionOf }

export const REGION_POLICY = { version: 1, id: 'catalog-regions-v1', regions: REGION_IDS } as const

export const isCatalogCountry = (code: string): boolean => catalogRegionOf(code) !== null

export interface RegionProgress {
  id: RegionId
  total: number
  pressed: number
  pending: number
}

export function regionCount(codes: Iterable<string | null | undefined>): number {
  const regions = new Set<RegionId>()
  for (const code of codes) {
    const region = catalogRegionOf(code)
    if (region) regions.add(region)
  }
  return regions.size
}

export function regionProgress(
  pressed: Iterable<string>,
  pending: Iterable<string>,
): RegionProgress[] {
  const count = (codes: Iterable<string>) => {
    const counts = new Map<RegionId, number>()
    for (const code of new Set(codes)) {
      const region = catalogRegionOf(code)
      if (region) counts.set(region, (counts.get(region) ?? 0) + 1)
    }
    return counts
  }
  const pressedCounts = count(pressed)
  const pendingCounts = count(pending)
  return REGION_IDS.map((id) => ({
    id,
    total: REGION_TOTALS[id],
    pressed: pressedCounts.get(id) ?? 0,
    pending: pendingCounts.get(id) ?? 0,
  }))
}
