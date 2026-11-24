import type { Locale } from '../../../lib/format'
import type { VisitPoint } from '../model'
import {
  TRAVEL_REGION_NAMES,
  TRAVEL_REGIONS,
  travelRegionOf,
  type TravelRegion,
} from './travel-regions'

export type AtlasAxis = 'regions' | 'years'
export type AtlasPage = {
  id: TravelRegion | 'world' | 'undated' | number
  codes: string[]
}

const UNDATED: Record<Locale, string> = { en: 'No year', ru: 'Без года' }

export function pageName(locale: Locale, id: AtlasPage['id']): string {
  if (typeof id === 'number') return String(id)
  return id === 'undated' ? UNDATED[locale] : TRAVEL_REGION_NAMES[locale][id]
}

export const isRegionPage = (page: AtlasPage): page is AtlasPage & { id: TravelRegion } =>
  typeof page.id === 'string' && page.id !== 'world' && page.id !== 'undated'

const pointKey = (point: VisitPoint) => point.date ?? `${point.year}`

export function atlasPages(
  axis: AtlasAxis,
  visits: ReadonlyMap<string, number>,
  pending: readonly string[],
  name: (code: string) => string,
  first: (code: string) => VisitPoint | null = () => null,
): AtlasPage[] {
  const codes = [...visits.keys(), ...pending.filter((code) => !visits.has(code))]
  const groups = new Map<AtlasPage['id'], string[]>()
  for (const code of codes) {
    const id = axis === 'years' ? (first(code)?.year ?? 'undated') : travelRegionOf(code)
    if (!id) continue
    const group = groups.get(id)
    if (group) group.push(code)
    else groups.set(id, [code])
  }
  const byName = (a: string, b: string) => name(a).localeCompare(name(b))
  if (axis === 'years') {
    const years = [...groups.keys()].filter((id): id is number => typeof id === 'number')
    const dated = years
      .sort((a, b) => a - b)
      .map((year) => ({
        id: year,
        codes: groups
          .get(year)!
          .sort((a, b) => pointKey(first(a)!).localeCompare(pointKey(first(b)!)) || byName(a, b)),
      }))
    const undated = groups.get('undated')
    return [
      { id: 'world', codes },
      ...dated,
      ...(undated ? [{ id: 'undated' as const, codes: undated.sort(byName) }] : []),
    ]
  }
  const order = (a: string, b: string) =>
    (visits.get(b) ?? 0) - (visits.get(a) ?? 0) || byName(a, b)
  return [
    { id: 'world', codes },
    ...TRAVEL_REGIONS.filter((id) => groups.has(id)).map((id) => ({
      id,
      codes: groups.get(id)!.sort(order),
    })),
  ]
}

export type Box = readonly [number, number, number, number]

export const unionBox = (a: Box | null, b: Box | null): Box | null =>
  !a
    ? b
    : !b
      ? a
      : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]

export function pageBox(page: AtlasPage, frameOf: (code: string) => Box | null): Box | null {
  let box: Box | null = null
  for (const code of page.codes) box = unionBox(box, frameOf(code))
  return box
}

const MIN_SPAN = { lon: 24, lat: 14 }
export function widen([west, south, east, north]: Box): Box {
  const x = (west + east) / 2,
    y = (south + north) / 2
  const halfWidth = Math.max((east - west) / 2, MIN_SPAN.lon / 2),
    halfHeight = Math.max((north - south) / 2, MIN_SPAN.lat / 2)
  return [x - halfWidth, Math.max(-80, y - halfHeight), x + halfWidth, Math.min(84, y + halfHeight)]
}

export const mercator = (lng: number, lat: number) => ({
  x: (lng + 180) / 360,
  y: (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360,
})

export function minSidePx([west, south, east, north]: Box, zoom: number): number {
  const a = mercator(west, north),
    b = mercator(east, south)
  return Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 512 * 2 ** zoom
}

export type Camera = { x: number; y: number; zoom: number }

export function between(a: Camera, b: Camera, t: number, fitBoth: number): Camera {
  const dip = Math.max(0, Math.min(a.zoom, b.zoom) - fitBoth)
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    zoom: a.zoom + (b.zoom - a.zoom) * t - dip * Math.sin(Math.PI * t),
  }
}
