import { rowCountries } from '@kuuki/shared/overview/filter'
import type { FacetKey, OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { periodDays } from '@kuuki/shared/overview/range'
import { defaultSort, emptyFilters } from '../../journal/model'
import { journalSearch } from '../../journal/url'

/**
 * The Journal view for the Overview's flight count. A facet carries only where the Journal matches it the same way:
 * period, airline, alliance, and airports, countries, aircraft or families on their own. The Journal ORs airports with
 * countries and aircraft with families, and counts suppressed transit countries, so those pairs keep the narrower facet
 * and name the other as dropped. Both lists cover logged and awaiting flights. Ground scope has no flight count to link.
 */
export function journalLinkFor(
  filter: OverviewFilter,
  payload: Pick<OverviewPayload, 'rows' | 'refs'>,
): { href: string; dropped: FacetKey[] } {
  const filters = emptyFilters()
  const dropped: FacetKey[] = []
  const period = filter.period
  if (period && 'years' in period) filters.years = [...period.years]
  else if (period) {
    const days = periodDays(period)
    if (days) {
      filters.from = days.from
      filters.to = days.to
    }
  }
  filters.airlines = [...(filter.airlines ?? [])]
  filters.alliances = [...(filter.alliances ?? [])]
  if (filter.airports?.length) {
    filters.airports = [...filter.airports]
    if (filter.countries?.length) dropped.push('countries')
  } else if (filter.countries?.length) {
    const countries = filter.countries
    // A flight whose endpoint country Overview suppresses would still match in the Journal.
    const suppressed = payload.rows.some((row) => {
      if (!row.suppressed) return false
      const evidence = rowCountries(row, payload.refs)
      return [row.origin, row.destination].some((code) => {
        const country = payload.refs.airports[code]?.country
        return !!country && countries.includes(country) && !evidence.includes(country)
      })
    })
    if (suppressed) dropped.push('countries')
    else filters.countries = [...countries]
  }
  if (filter.aircraft?.length) {
    filters.aircraft = [...filter.aircraft]
    if (filter.families?.length) dropped.push('families')
  } else if (filter.families?.length) filters.families = [...filter.families]
  const carried = new Set<string>([
    'scope',
    'period',
    'airlines',
    'alliances',
    'airports',
    'countries',
    'aircraft',
    'families',
  ])
  for (const [key, values] of Object.entries(filter))
    if (!carried.has(key) && Array.isArray(values) && values.length) dropped.push(key as FacetKey)
  const search = journalSearch({ filters, sort: defaultSort, flight: null, review: false })
  return { href: search ? `/journal?${search}` : '/journal', dropped }
}
