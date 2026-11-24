import { CONTINENT_IDS, type ContinentId, type Continents } from '@kuuki/shared/overview/continents'
import { formatCount, formatNumber, type Locale } from '../../../../lib/format'
import { forms, t } from '../../copy'

export type { ContinentId }
export const TOTAL = CONTINENT_IDS.length

const NAMES: Record<ContinentId, { en: string; ru: string }> = {
  europe: { en: 'Europe', ru: 'Европа' },
  asia: { en: 'Asia', ru: 'Азия' },
  africa: { en: 'Africa', ru: 'Африка' },
  'north-america': { en: 'North America', ru: 'Северная Америка' },
  'south-america': { en: 'South America', ru: 'Южная Америка' },
  oceania: { en: 'Oceania', ru: 'Океания' },
  antarctica: { en: 'Antarctica', ru: 'Антарктида' },
}
export const continentName = (id: ContinentId, locale: Locale) => t(NAMES[id], locale)

type Row = Continents['rows'][number]

export const byFlights = (rows: readonly Row[]) =>
  rows.filter((row) => row.flights > 0).toSorted((a, b) => b.flights - a.flights)

export function displayOrder(rows: readonly Row[], view: 'flights' | 'firsts'): Row[] {
  const flown = byFlights(rows)
  if (view === 'firsts') flown.sort((a, b) => (a.firstYear ?? Infinity) - (b.firstYear ?? Infinity))
  return [...flown, ...rows.filter((row) => !row.flights)]
}

export function flightsUnit(locale: Locale, n: number) {
  return formatCount(locale, n, forms.flights).replace(formatNumber(locale, n), '').trim()
}
