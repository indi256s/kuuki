import type { FacetKey, OverviewFilter } from '@kuuki/shared/overview/model'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'

export type FacetValue<K extends FacetKey> = NonNullable<OverviewFilter[K]>[number]
export function addValue<K extends FacetKey>(filter: OverviewFilter, facet: K, value: FacetValue<K>): OverviewFilter {
  const values = filter[facet] as FacetValue<K>[] | undefined
  if (values?.includes(value)) return filter
  return { ...filter, [facet]: [...(values ?? []), value] }
}
export function removeValue<K extends FacetKey>(filter: OverviewFilter, facet: K, value: FacetValue<K>): OverviewFilter {
  const values = filter[facet] as FacetValue<K>[] | undefined
  if (!values?.includes(value)) return filter
  const next = values.filter(item => item !== value)
  return next.length ? { ...filter, [facet]: next } : removeFacet(filter, facet)
}
export function removeFacet(filter: OverviewFilter, facet: keyof OverviewFilter): OverviewFilter {
  if (!Object.hasOwn(filter, facet)) return filter
  const next = { ...filter }
  delete next[facet]
  return next
}
export function setPeriod(filter: OverviewFilter, period: OverviewFilter['period'] | null): OverviewFilter {
  return period ? { ...filter, period } : removeFacet(filter, 'period')
}
export function clearAll(): OverviewFilter { return {} }
export function removeLast(filter: OverviewFilter): OverviewFilter {
  const key = (Object.keys(filter) as (keyof OverviewFilter)[]).findLast(key => !isEmptyFilter({ [key]: filter[key] }))
  if (!key) return filter
  if (key === 'period') return removeFacet(filter, key)
  const values = filter[key]
  return values && values.length > 1 ? { ...filter, [key]: values.slice(0, -1) } : removeFacet(filter, key)
}
