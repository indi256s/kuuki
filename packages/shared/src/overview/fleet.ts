import { MAKER_SLOTS, makerOf, type MakerSlot } from '../../../data/src/aircraft-makers'
import { coverage, preciseDurationSamples, type Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'

export interface ShareRow {
  key: string
  flights: number
}
export interface Fleet {
  topType: { icao: string; share: number } | null
  /** Top exact ICAO types, ranked by flight count; separate from family totals. */
  topTypes: ShareRow[]
  byBodyType: ShareRow[]
  byManufacturer: ShareRow[]
  families: number
  types: number
  typed: number
  total: number
  bodies: Array<{ key: string; body: 'narrow' | 'wide'; maker: MakerSlot; flights: number }>
  untyped: number
  familyRows: Array<{
    key: string
    family: string
    maker: MakerSlot
    body: 'narrow' | 'wide'
    flights: number
    minutes: number[]
  }>
  topFamily: { family: string; flights: number } | null
}

function add(counts: Map<string, number>, key: string | null | undefined, weight: number): void {
  if (key) counts.set(key, (counts.get(key) ?? 0) + weight)
}

function shares(counts: Map<string, number>): ShareRow[] {
  return [...counts]
    .map(([key, flights]) => ({ key, flights }))
    .sort((a, b) => b.flights - a.flights || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export function fleet(
  rows: OverviewRow[],
  refs: OverviewPayload['refs'],
  mode: OverviewPayload['mode'] = 'flights',
): Gate<Fleet> {
  const { typed, total } = coverage(rows)
  if (typed < 5) return { status: 'below', have: typed, need: 5 }
  const types = new Map<string, number>(),
    manufacturers = new Map<string, number>(),
    bodyTypes = new Map<string, number>()
  const families = new Set<string>()
  const bodies = new Map<string, Fleet['bodies'][number]>()
  const familyRows = new Map<string, Fleet['familyRows'][number]>()
  for (const row of rows) {
    if (!row.aircraft) continue
    const ref = refs.aircraft[row.aircraft]
    add(types, row.aircraft, row.weight)
    add(manufacturers, ref?.manufacturer, row.weight)
    add(bodyTypes, ref?.type, row.weight)
    if (ref?.family) families.add(ref.family)
    const maker = makerOf(row.aircraft)
    const body =
      ref?.type === 'widebody'
        ? 'wide'
        : ['narrowbody', 'regional', 'bizjet', 'turboprop', 'piston'].includes(ref?.type ?? '')
          ? 'narrow'
          : null
    if (maker === 'unknown' || body === null || row.weight <= 0) continue
    const key = `${body}:${maker}`
    const band = bodies.get(key) ?? { key, body, maker, flights: 0 }
    band.flights += row.weight
    bodies.set(key, band)
    if (ref?.family) {
      const key = `${body}:${maker}:${ref.family}`
      const family = familyRows.get(key) ?? {
        key,
        family: ref.family,
        maker,
        body,
        flights: 0,
        minutes: [],
      }
      family.flights += row.weight
      family.minutes.push(...preciseDurationSamples(row, mode === 'flights'))
      familyRows.set(key, family)
    }
  }
  const ranked = shares(types)
  const top = ranked[0]
  const rowsByFamily = [...familyRows.values()]
  for (const family of rowsByFamily) family.minutes.sort((a, b) => a - b)
  const topFamily = [...rowsByFamily].sort(
    (a, b) =>
      b.flights - a.flights ||
      a.family.localeCompare(b.family) ||
      MAKER_SLOTS.indexOf(a.maker) - MAKER_SLOTS.indexOf(b.maker),
  )[0]
  return {
    status: 'ready',
    value: {
      topType: top ? { icao: top.key, share: top.flights / typed } : null,
      topTypes: ranked.slice(0, 5),
      byBodyType: shares(bodyTypes),
      byManufacturer: shares(manufacturers),
      families: families.size,
      types: types.size,
      typed,
      total,
      bodies: [...bodies.values()].sort(
        (a, b) =>
          a.body.localeCompare(b.body) ||
          MAKER_SLOTS.indexOf(a.maker) - MAKER_SLOTS.indexOf(b.maker),
      ),
      untyped: total - typed,
      familyRows: rowsByFamily.sort(
        (a, b) =>
          a.body.localeCompare(b.body) ||
          b.flights - a.flights ||
          a.family.localeCompare(b.family) ||
          MAKER_SLOTS.indexOf(a.maker) - MAKER_SLOTS.indexOf(b.maker),
      ),
      topFamily: topFamily ? { family: topFamily.family, flights: topFamily.flights } : null,
    },
  }
}
