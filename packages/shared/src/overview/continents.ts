import type { Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'
import { dateInstant } from './records'

export const CONTINENT_IDS = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
] as const
export type ContinentId = (typeof CONTINENT_IDS)[number]
export interface Continents {
  rows: { id: ContinentId; flights: number; firstYear: number | null }[]
  flown: number
  placed: number
  unplaced: number
}

type Refs = OverviewPayload['refs']

const SOUTH_AMERICA = new Set([
  'AR',
  'BO',
  'BR',
  'CL',
  'CO',
  'EC',
  'FK',
  'GF',
  'GY',
  'PE',
  'PY',
  'SR',
  'UY',
  'VE',
])
const DIRECT: Record<string, ContinentId> = {
  africa: 'africa',
  antarctica: 'antarctica',
  asia: 'asia',
  europe: 'europe',
  oceania: 'oceania',
}

const finite = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value)

/** Continent of one airport, or null when the reference data cannot place it. Splits transcontinental countries by coordinates. */
export function continentOf(refs: Refs, code: string): ContinentId | null {
  const airport = refs.airports[code]
  const country = airport?.country
  if (!airport || !country) return null
  const region = refs.regions[country]
  if (!region) return null
  const { lat, lon } = airport
  switch (country) {
    case 'RU':
      return finite(lon) ? (lon >= 19 && lon < 60 ? 'europe' : 'asia') : null
    case 'KZ':
      return finite(lon) ? (lon < 51.5 ? 'europe' : 'asia') : null
    case 'TR':
      return finite(lon) && finite(lat) ? (lon < 29.1 && lat > 40.4 ? 'europe' : 'asia') : null
    case 'EG':
      return finite(lon) ? (lon > 32.6 ? 'asia' : 'africa') : null
  }
  if (region === 'americas') return SOUTH_AMERICA.has(country) ? 'south-america' : 'north-america'
  return DIRECT[region] ?? null
}

function rowContinents(row: OverviewRow, refs: Refs): ContinentId[] {
  const found = new Set<ContinentId>()
  for (const [bit, code] of [
    [1, row.origin],
    [2, row.destination],
  ] as const) {
    if (row.suppressed & bit) continue
    const continent = continentOf(refs, code)
    if (continent) found.add(continent)
  }
  return [...found]
}

export function continents(rows: OverviewRow[], refs: Refs): Gate<Continents> {
  const byId = new Map(
    CONTINENT_IDS.map((id) => [id, { id, flights: 0, firstYear: null as number | null }]),
  )
  let placed = 0,
    unplaced = 0
  for (const row of rows) {
    const found = rowContinents(row, refs)
    if (!found.length) {
      unplaced += row.weight
      continue
    }
    placed += row.weight
    const year = dateInstant(row.date) === null ? null : Number(row.date.slice(0, 4))
    for (const id of found) {
      const entry = byId.get(id)!
      entry.flights += row.weight
      if (year !== null && (entry.firstYear === null || year < entry.firstYear))
        entry.firstYear = year
    }
  }
  if (placed < 3) return { status: 'below', have: placed, need: 3 }
  const list = CONTINENT_IDS.map((id) => byId.get(id)!)
  return {
    status: 'ready',
    value: {
      rows: list,
      flown: list.filter((entry) => entry.flights > 0).length,
      placed,
      unplaced,
    },
  }
}
