import { matches, rowCountries } from '@kuuki/shared/overview/filter'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'

export type CountryEvidence = { code: string; value: number }
export type RegionEvidence = { region: string; value: number; countries: CountryEvidence[] }
const REGIONS = new Set(['africa', 'americas', 'antarctica', 'asia', 'europe', 'oceania'])

/** Each logged flight contributes its weight once per unsuppressed country, including both countries internationally. */
export function countryEvidence(
  payload: OverviewPayload,
  filter: OverviewFilter,
): RegionEvidence[] {
  const regions = new Map<string, Map<string, number>>()
  for (const row of payload.rows) {
    if (row.state !== 'logged' || !matches(row, filter, payload.refs)) continue
    for (const code of rowCountries(row, payload.refs)) {
      const region = payload.refs.regions[code]
      if (!REGIONS.has(region)) continue
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
