import { coverage, type Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'

export interface ShareRow { key: string; flights: number }
export interface Fleet {
  topType: { icao: string; share: number } | null
  byBodyType: ShareRow[]; byManufacturer: ShareRow[]
  families: number; types: number; typed: number; total: number
}

function add(counts: Map<string, number>, key: string | null | undefined, weight: number): void {
  if (key) counts.set(key, (counts.get(key) ?? 0) + weight)
}

function shares(counts: Map<string, number>): ShareRow[] {
  return [...counts].map(([key, flights]) => ({ key, flights }))
    .sort((a, b) => b.flights - a.flights || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export function fleet(rows: OverviewRow[], refs: OverviewPayload['refs']): Gate<Fleet> {
  const { typed, total } = coverage(rows)
  if (typed < 5) return { status: 'below', have: typed, need: 5 }
  const types = new Map<string, number>(), manufacturers = new Map<string, number>(), bodyTypes = new Map<string, number>()
  const families = new Set<string>()
  for (const row of rows) {
    if (!row.aircraft) continue
    const ref = refs.aircraft[row.aircraft]
    add(types, row.aircraft, row.weight)
    add(manufacturers, ref?.manufacturer, row.weight)
    add(bodyTypes, ref?.type, row.weight)
    if (ref?.family) families.add(ref.family)
  }
  const top = shares(types)[0]
  return { status: 'ready', value: {
    topType: top ? { icao: top.key, share: top.flights / typed } : null,
    byBodyType: shares(bodyTypes), byManufacturer: shares(manufacturers),
    families: families.size, types: types.size, typed, total,
  } }
}
