// Collection-region policy (ADR 0001 §4, "Region models"). Overview, Passport and geographic progress
// group countries by the catalog's six regions, computed at read time from the published country
// evidence and never persisted, so a policy bump needs no dirty mark.
//
// The other two models stay where they are and are versioned by what they feed:
//   * `continentOf7` (`./continents.ts`): `continents_count` and continent badges, `badge-continents-v1`.
//     Badges are award-only, so a changed input never revokes an earned award.
//   * `regionOf` (`./continents.ts`): the persisted `user_advanced_stats` breakdowns.
import {
  COUNTRY_REGION,
  REGION_IDS,
  REGION_TOTALS,
  type RegionId,
} from './countryRegions.generated'

export type { RegionId }

/** Bump when the grouping, the catalog map or what counts as "reached" changes; Passport reports it. */
export const REGION_POLICY = { version: 1, id: 'catalog-regions-v1', regions: REGION_IDS } as const

export const catalogRegionOf = (code: string | null | undefined): RegionId | null =>
  code && Object.hasOwn(COUNTRY_REGION, code) ? COUNTRY_REGION[code] : null

export interface RegionProgress {
  id: RegionId
  total: number
  pressed: number
  pending: number
}

/** Distinct collection regions among `codes`; codes outside the catalog count nowhere. */
export function regionCount(codes: Iterable<string | null | undefined>): number {
  const regions = new Set<RegionId>()
  for (const code of codes) {
    const region = catalogRegionOf(code)
    if (region) regions.add(region)
  }
  return regions.size
}

/** All six regions, with distinct pressed and pending countries kept apart. */
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
