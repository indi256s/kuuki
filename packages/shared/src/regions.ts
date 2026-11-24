import { COUNTRY_REGION, type RegionId } from './countryRegions.generated'

export type { RegionId }

export const catalogRegionOf = (code: string | null | undefined): RegionId | null =>
  code && Object.hasOwn(COUNTRY_REGION, code) ? COUNTRY_REGION[code] : null
