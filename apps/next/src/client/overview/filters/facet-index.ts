import { allianceAt, formerAlliance, type Alliance } from '@kuuki/data/alliance-membership'
import { makerOf, type MakerKey } from '@kuuki/data/aircraft-makers'
import { bandOf, haulOf, routeKey, rowCountries } from '@kuuki/shared/overview/filter'
import { calendarDay } from '@kuuki/shared/overview/next'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import type { Locale } from '../../../lib/format'
import type { OverviewLabels } from '../labels'
import { facetValueLabel, type FilterFacet } from './chip-label'

export interface FacetOption {
  facet: FilterFacet
  value: string
  label: string
  sublabel?: string
  count: number
  mark?: { kind: 'maker'; key: MakerKey } | { kind: 'alliance'; key: Alliance }
  searchText?: string
}
export const FACET_ORDER: readonly FilterFacet[] = ['period', 'countries', 'airports', 'airlines', 'alliances', 'routes', 'aircraft', 'families', 'makers', 'bodies', 'haul', 'domestic', 'departureBands', 'depHours', 'arrHours', 'regions']
const ranked = (a: FacetOption, b: FacetOption) => b.count - a.count || a.value.localeCompare(b.value, 'en')

export function buildFacetIndex(payload: OverviewPayload, labels: OverviewLabels, locale: Locale): FacetOption[] {
  const options = new Map<string, FacetOption>(), latest = new Map<string, string>()
  const { refs } = payload
  for (const row of payload.rows) {
    if (row.state !== 'logged' && row.state !== 'awaiting') continue
    if (!Number.isFinite(row.weight) || row.weight <= 0) continue
    const add = (facet: FilterFacet, value: string | number | null | undefined, searchText?: string) => {
      if (value === null || value === undefined || value === '') return
      const code = String(value), key = `${facet}:${code}`, existing = options.get(key)
      if (existing) { existing.count += row.weight; return }
      const label = facet === 'aircraft' ? refs.aircraft[code]?.name || labels.aircraft(code) || code
        : facet === 'airports' && labels.airport(code) === code && refs.airports[code]?.city ? `${code} · ${refs.airports[code].city}`
          : facetValueLabel(facet, value, labels, locale)
      options.set(key, { facet, value: code, label, count: row.weight, searchText })
    }
    if (calendarDay(row.date) !== null) {
      add('period', Number(row.date.slice(0, 4)))
      if (row.airline && row.date > (latest.get(row.airline) ?? '')) latest.set(row.airline, row.date)
    }
    const countries = rowCountries(row, refs)
    for (const country of countries) add('countries', country)
    for (const region of new Set(countries.map(country => refs.regions[country]).filter(Boolean))) add('regions', region)
    for (const airport of new Set([row.origin, row.destination])) add('airports', airport, `${refs.airports[airport]?.city ?? ''} ${refs.airports[airport]?.name ?? ''}`)
    add('airlines', row.airline)
    const alliance = allianceAt(row.airline, row.date)
    add('alliances', alliance)
    if (alliance) options.get(`alliances:${alliance}`)!.mark = { kind: 'alliance', key: alliance }
    if (row.origin && row.destination) add('routes', routeKey(row.origin, row.destination), [row.origin, row.destination].map(code => `${labels.airport(code)} ${refs.airports[code]?.city ?? ''}`).join(' '))
    add('aircraft', row.aircraft)
    const aircraft = row.aircraft ? refs.aircraft[row.aircraft] : undefined
    add('families', aircraft?.family)
    const maker = makerOf(row.aircraft)
    add('makers', maker)
    options.get(`makers:${maker}`)!.mark = { kind: 'maker', key: maker }
    const body = aircraft?.type === 'widebody' ? 'wide' : ['narrowbody', 'regional', 'bizjet', 'turboprop', 'piston'].includes(aircraft?.type ?? '') ? 'narrow' : null
    add('bodies', body)
    const distance = row.distanceKm === null ? null : row.distanceKm / row.weight
    if (distance !== null && Number.isFinite(distance) && distance >= 0) add('haul', haulOf(distance))
    const origin = refs.airports[row.origin]?.country, destination = refs.airports[row.destination]?.country
    if (origin && destination) add('domestic', origin === destination ? 'domestic' : 'international')
    for (const [facet, minute] of [['depHours', row.depMinute], ['arrHours', row.arrMinute]] as const) {
      if (minute !== null && Number.isFinite(minute) && minute >= 0 && minute <= 1439) {
        add(facet, Math.floor(minute / 60))
        if (facet === 'depHours') add('departureBands', bandOf(minute))
      }
    }
  }
  for (const option of options.values()) {
    if (option.facet !== 'airlines') continue
    const date = latest.get(option.value)
    if (!date) continue
    const alliance = allianceAt(option.value, date), former = formerAlliance(option.value, date)
    const membership = alliance ? facetValueLabel('alliances', alliance, labels, locale) : former
      ? `${locale === 'ru' ? 'покинула' : 'left'} ${facetValueLabel('alliances', former.alliance, labels, locale)} ${former.leftYear}` : null
    // Qualify the note by the latest actual source flight, including mixed historical memberships.
    if (membership) option.sublabel = `${option.value} · ${membership} · ${locale === 'ru' ? 'на дату рейса' : 'as of flight'} ${date}`
  }
  return FACET_ORDER.flatMap(facet => [...options.values()].filter(option => option.facet === facet).sort(ranked))
}
export function searchFacets(index: FacetOption[], query: string, locale: Locale) {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale)
  const needle = normalize(query.trim())
  return FACET_ORDER.map(facet => ({ facet, options: index.filter(option => option.facet === facet && normalize(`${option.label} ${option.value} ${option.searchText ?? ''}`).includes(needle)).slice(0, 8) })).filter(group => group.options.length)
}
export function topPicks(index: FacetOption[]): FacetOption[] {
  return (['countries', 'airlines', 'routes'] as const).flatMap(facet => [...index].filter(option => option.facet === facet).sort(ranked).slice(0, 1))
}
