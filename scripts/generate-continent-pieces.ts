/**
 * Generates apps/next/src/client/overview/iso/continents.generated.ts for the Continents puzzle figure: the 110m country polygons
 * (`apps/next/public/maps/countries-110m-2.0.2-r2.geojson`) assigned to seven continents by airport-level rules (Russia and Kazakhstan split
 * at the Urals, Turkey's Thrace is Europe, Sinai is Asia, the Americas split by subregion from `packages/data/src/countries.json`),
 * clipped where a country straddles a line, and simplified (Douglas–Peucker at 0.7°, pieces under 1.2 deg² dropped, coordinates to 0.1°).
 * Run: pnpm exec tsx scripts/generate-continent-pieces.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Pt = [number, number]
export const CONTINENT_IDS = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
] as const
type Continent = (typeof CONTINENT_IDS)[number]
type Catalog = Record<string, { continent: string; subregion: string }>
type Geo = {
  features: {
    properties: { id: string }
    geometry: { type: string; coordinates: number[][][] | number[][][][] }
  }[]
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(
  ROOT,
  'apps',
  'next',
  'src',
  'client',
  'overview',
  'iso',
  'continents.generated.ts',
)

/** Continent of a point in a country, by airport-level rules. Overseas pieces of European countries (French Guiana, the Caribbean) belong where they lie. */
function continentOf(catalog: Catalog, cc: string, lon: number, lat: number): Continent | null {
  const v = catalog[cc]
  if (!v) return null
  if (cc === 'RU') return lon > 19 && lon < 60 ? 'europe' : 'asia'
  if (cc === 'KZ') return lon < 51.5 ? 'europe' : 'asia'
  if (cc === 'TR') return lon < 29.1 && lat > 40.4 ? 'europe' : 'asia'
  if (cc === 'EG') return lon > 32.6 ? 'asia' : 'africa'
  if (v.continent === 'americas') {
    return v.subregion === 'South America' ? 'south-america' : 'north-america'
  }
  if (v.continent === 'europe' && lon < -30) return lat < 12 ? 'south-america' : 'north-america'
  return v.continent as Continent
}

/** Sutherland–Hodgman against one half-plane, keeping where f(p) >= 0 (f linear). */
function clip(pts: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length],
      fp = f(p),
      fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq)
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  })
  return out
}

/** Douglas–Peucker for a closed ring: split at the point farthest from the start, so neither half is degenerate. */
function simplify(ring: Pt[], tol: number): Pt[] {
  const first = ring[0],
    last = ring[ring.length - 1]
  const open =
    ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring
  if (open.length < 4) return open
  let far = 0
  open.forEach(([x, y], i) => {
    if (
      Math.hypot(x - open[0][0], y - open[0][1]) >
      Math.hypot(open[far][0] - open[0][0], open[far][1] - open[0][1])
    )
      far = i
  })
  return [
    ...dp(open.slice(0, far + 1), tol).slice(0, -1),
    ...dp([...open.slice(far), open[0]], tol).slice(0, -1),
  ]
}
function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts
  const keep = new Array<boolean>(pts.length).fill(false)
  keep[0] = keep[pts.length - 1] = true
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let best = -1,
      idx = -1
    const [ax, ay] = pts[a],
      [bx, by] = pts[b],
      len = Math.hypot(bx - ax, by - ay) || 1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
      if (d > best) {
        best = d
        idx = i
      }
    }
    if (best > tol) {
      keep[idx] = true
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}
const area = (pts: Pt[]) =>
  Math.abs(
    pts.reduce((sum, [x, y], i) => {
      const [x2, y2] = pts[(i + 1) % pts.length]
      return sum + x * y2 - x2 * y
    }, 0),
  ) / 2

export function pieces(geo: Geo, catalog: Catalog): Map<Continent, Pt[][]> {
  const out = new Map<Continent, Pt[][]>()
  const add = (c: Continent | null, r: Pt[]) => {
    if (c && r.length > 2 && area(r) > 1.2) out.set(c, [...(out.get(c) ?? []), r])
  }
  const split: Record<string, [(p: Pt) => number, Continent, Continent]> = {
    RU: [(p) => (p[0] > 19 ? 60 - p[0] : -1), 'europe', 'asia'],
    KZ: [(p) => 51.5 - p[0], 'europe', 'asia'],
    EG: [(p) => 32.6 - p[0], 'africa', 'asia'],
  }
  for (const f of geo.features) {
    const cc = f.properties.id
    const polys = (
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    ) as number[][][][]
    for (const poly of polys) {
      // Antarctica's south edge sits on the pole; the puzzle's tray stops at 84°S.
      const r = simplify(
        poly[0].map(([lon, lat]) => [lon, Math.max(lat, -84)] as Pt),
        0.7,
      )
      if (area(r) < 1.2) continue
      if (split[cc]) {
        const [f0, a, b] = split[cc]
        add(a, clip(r, f0))
        add(
          b,
          clip(r, (p) => -f0(p)),
        )
      } else if (cc === 'TR') {
        add(
          'europe',
          clip(
            clip(r, (p) => 29.1 - p[0]),
            (p) => p[1] - 40.4,
          ),
        )
        add(
          'asia',
          clip(r, (p) => p[0] - 29.1),
        )
        add(
          'asia',
          clip(
            clip(r, (p) => 29.1 - p[0]),
            (p) => 40.4 - p[1],
          ),
        )
      } else {
        add(continentOf(catalog, cc, r[0][0], r[0][1]), r)
      }
    }
  }
  return out
}

const round = (n: number) => Math.round(n * 10) / 10

export function render(map: Map<Continent, Pt[][]>): string {
  const body = CONTINENT_IDS.map((id) => {
    const rings = (map.get(id) ?? []).map(
      (r) => `    [${r.flatMap(([x, y]) => [round(x), round(y)]).join(',')}],`,
    )
    return `  '${id}': [\n${rings.join('\n')}\n  ],`
  }).join('\n')
  const points = [...map.values()].reduce(
    (n, rings) => n + rings.reduce((m, r) => m + r.length, 0),
    0,
  )
  return `// Generated by \`pnpm exec tsx scripts/generate-continent-pieces.ts\` from apps/next/public/maps/countries-110m-2.0.2-r2.geojson and packages/data/src/countries.json: ${points} points; do not edit by hand.
// One entry per continent: rings of lon,lat pairs flattened, simplified at 0.7° and rounded to 0.1°, Antarctica cut at 84°S.
export const CONTINENT_RINGS: Record<
  'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania' | 'antarctica',
  readonly (readonly number[])[]
> = {
${body}
}
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const geo = JSON.parse(
    readFileSync(
      join(ROOT, 'apps', 'next', 'public', 'maps', 'countries-110m-2.0.2-r2.geojson'),
      'utf8',
    ),
  ) as Geo
  const catalog = JSON.parse(
    readFileSync(join(ROOT, 'packages', 'data', 'src', 'countries.json'), 'utf8'),
  ) as Catalog
  writeFileSync(OUTPUT, render(pieces(geo, catalog)))
  console.log(`wrote ${OUTPUT}`)
}
