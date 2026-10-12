import { matches, rowCountries } from '@kuuki/shared/overview/filter'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { REGION_KEYS, type RegionKey } from '@kuuki/shared/theme/palette'

export type CountryEvidence = { code: string; value: number }
export type RegionEvidence = { region: string; value: number; countries: CountryEvidence[] }

/** The region bucket of a country whose airports carry no region; its tiles take the Unknown role. */
export const UNKNOWN_REGION = 'unknown'
export type RegionRole = RegionKey | typeof UNKNOWN_REGION
const AMERICAS = new Set(['north-america', 'south-america', 'central-america', 'caribbean'])

/**
 * The palette region for a payload region code. The payload carries the six catalog regions (both Americas are
 * already `americas`); the Americas sub-regions are folded in defensively. Anything else is Unknown, never Other.
 */
export function regionKey(code: string | null | undefined): RegionRole {
  const key = code?.trim().toLowerCase() ?? ''
  return (REGION_KEYS as readonly string[]).includes(key)
    ? (key as RegionKey)
    : AMERICAS.has(key)
      ? 'americas'
      : UNKNOWN_REGION
}

/** Each logged flight contributes its weight once per unsuppressed country, including both countries internationally. */
export function countryEvidence(
  payload: OverviewPayload,
  filter: OverviewFilter,
): RegionEvidence[] {
  const regions = new Map<string, Map<string, number>>()
  for (const row of payload.rows) {
    if (row.state !== 'logged' || !matches(row, filter, payload.refs)) continue
    for (const code of rowCountries(row, payload.refs)) {
      const region = payload.refs.regions[code] || UNKNOWN_REGION
      const countries = regions.get(region) ?? new Map<string, number>()
      countries.set(code, (countries.get(code) ?? 0) + row.weight)
      regions.set(region, countries)
    }
  }
  return [...regions]
    .map(([region, counts]) => ({
      region,
      value: [...counts.values()].reduce((sum, value) => sum + value, 0),
      countries: [...counts]
        .map(([code, value]) => ({ code, value }))
        .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => b.value - a.value || a.region.localeCompare(b.region))
}
