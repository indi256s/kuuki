// Continents studies: the metric swap for Crossings. Two figures: a sticker-covered suitcase, and a world-map jigsaw tray.
// Illustrative reading from the local test data (per-airport continents): Europe 36, Asia 27, Africa 3 flights; 3 of 7.
import { readFileSync } from 'node:fs'
import { Scene, roundRect, type IsoFigureData, type P3, type Paint, type Pt } from '../../apps/next/src/client/overview/iso/scene'
import { X, Zd, fit, flat } from './figures'

export type Continent = 'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania' | 'antarctica'
export const CONTINENTS: { key: Continent; label: string; short: string; flights: number }[] = [
  { key: 'europe', label: 'EUROPE', short: 'EU', flights: 36 },
  { key: 'asia', label: 'ASIA', short: 'AS', flights: 27 },
  { key: 'africa', label: 'AFRICA', short: 'AF', flights: 3 },
  { key: 'north-america', label: 'N. AMERICA', short: 'NA', flights: 0 },
  { key: 'south-america', label: 'S. AMERICA', short: 'SA', flights: 0 },
  { key: 'oceania', label: 'OCEANIA', short: 'OC', flights: 0 },
  { key: 'antarctica', label: 'ANTARCTICA', short: 'AN', flights: 0 },
]
const SELECTED: Continent = 'europe'
const flown = (c: Continent) => (CONTINENTS.find((x) => x.key === c)?.flights ?? 0) > 0
const rad = (d: number) => (d * Math.PI) / 180

// ── Shapes in a front plane (x, z), turned by deg.
const ring = (cx: number, cz: number, rx: number, rz: number, deg: number, n = 36): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI, c = Math.cos(rad(deg)), q = Math.sin(rad(deg))
    const u = rx * Math.cos(t), v = rz * Math.sin(t)
    return [cx + u * c - v * q, cz + u * q + v * c]
  })
const rrect = (cx: number, cz: number, w: number, h: number, r: number, deg: number): Pt[] => {
  const c = Math.cos(rad(deg)), q = Math.sin(rad(deg))
  return roundRect(-w / 2, -h / 2, w, h, r).map(([u, v]) => [cx + u * c - v * q, cz + u * q + v * c])
}

// ── Continents A: a hard-shell suitcase, one sticker per continent flown, clean dashed patches where the rest would go.
function suitcase(k: number) {
  const s = new Scene(k)
  const W = 74, D = 24, H = 64, Z0 = 5
  s.poly(flat([[-3, -2], [W + 5, -2], [W + 5, D + 6], [-3, D + 6]], 0), 'shadow', 'none')
  // Spinner wheels at the far corners first, the near ones after the shell.
  const wheel = (x: number, y: number) => {
    s.box(x - 2, y - 2, 2.5, 4, 4, Z0 - 2.5, { top: 'side' })
    s.poly(s.circle([x, y + 2, 1.8], X, [0, 0, 1], 0, 0, 1.8, 16), 'glass', 'line')
  }
  wheel(6, 4)
  wheel(W - 6, 4)
  s.rbox(0, 0, Z0, W, D, H, 6)
  const front = (pts: readonly Pt[], y = D): P3[] => pts.map(([x, z]) => [x, y, z + Z0])
  // Shell ribs, the seam round the side and over the top.
  s.segs([16, 30, 44, 58].map((x) => front([[x, 3], [x, H - 3]])), 'detail', 0.7)
  s.line([[W, D / 2, Z0 + 2], [W, D / 2, Z0 + H]], 'detail', 0.9)
  s.line([[W - 6, D / 2, Z0 + H], [6, D / 2, Z0 + H]], 'detail', 0.9)
  wheel(6, D - 3)
  wheel(W - 6, D - 3)
  // Telescoping handle.
  s.box(19, 9, Z0 + H, 3, 4, 13, { top: 'top' })
  s.box(52, 9, Z0 + H, 3, 4, 13, { top: 'top' })
  s.box(17, 8.5, Z0 + H + 13, 40, 5, 3.5)
  const sticker = (pts: Pt[], deg: number, cx: number, cz: number, label: string, n: number, kind: 'hot' | 'flown' | 'empty', big: number) => {
    const c = Math.cos(rad(deg)), q = Math.sin(rad(deg))
    const U: P3 = [c, 0, q], V: P3 = [q, 0, -c]
    const at = (u: number, v: number): P3 => [cx + u * c + v * q, D, Z0 + cz + u * q - v * c]
    if (kind === 'empty') {
      s.line([...front(pts), front(pts)[0]], 'detail', 0.8, '2 1.6')
      s.text(label, at(0, 1.4), U, V, { size: 3.4, fill: 'detail', weight: 700, mono: true, anchor: 'middle' })
      return
    }
    const hot = kind === 'hot'
    s.poly(front(pts), hot ? 'accent' : 'muted', hot ? 'accent' : 'line')
    s.text(label, at(0, -1.2), U, V, { size: big * 0.62, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
    s.text(`${n} FLIGHTS`, at(0, big * 0.62 + 0.4), U, V, { size: 2.9, fill: 'on-accent', weight: 600, mono: true, anchor: 'middle' })
  }
  const kind = (c: Continent) => (c === SELECTED ? 'hot' : flown(c) ? 'flown' : 'empty') as 'hot' | 'flown' | 'empty'
  const n = (c: Continent) => CONTINENTS.find((x) => x.key === c)!.flights
  sticker(ring(21, 47, 12.5, 12.5, 0), 0, 21, 47, 'EUROPE', n('europe'), kind('europe'), 7.4)
  sticker(rrect(52, 51, 29, 16, 3, -7), -7, 52, 51, 'ASIA', n('asia'), kind('asia'), 9)
  sticker(ring(38, 29, 14, 8, 8), 8, 38, 29, 'AFRICA', n('africa'), kind('africa'), 7.6)
  sticker(rrect(15.5, 23, 21, 10, 2, -5), -5, 15.5, 23, 'N. AMERICA', 0, kind('north-america'), 0)
  sticker(ring(62, 28, 8.4, 8.4, 0), 0, 62, 28, 'S. AMER', 0, kind('south-america'), 0)
  sticker(rrect(55, 10, 22, 9.5, 2, 6), 6, 55, 10, 'OCEANIA', 0, kind('oceania'), 0)
  sticker(ring(24, 9, 14, 5.6, -3), -3, 24, 9, 'ANTARCTICA', 0, kind('antarctica'), 0)
  return s.done()
}

// ── Continents B: a world-map jigsaw in its tray; flown continents are pieces in place, the rest are empty sockets.
type Geo = { features: { properties: { id: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }
const COUNTRIES = JSON.parse(readFileSync('packages/data/src/countries.json', 'utf8')) as Record<string, { continent: string; subregion: string }>

/** Continent of a point in a country, by airport-level rules: Russia and Kazakhstan split at the Urals, Turkey's Thrace is Europe, Sinai is Asia, the Americas split by subregion. */
function continentOf(cc: string, lon: number, lat: number): Continent | null {
  const v = COUNTRIES[cc]
  if (!v) return null
  if (cc === 'RU') return lon > 19 && lon < 60 ? 'europe' : 'asia'
  if (cc === 'KZ') return lon < 51.5 ? 'europe' : 'asia'
  if (cc === 'TR') return lon < 29.1 && lat > 40.4 ? 'europe' : 'asia'
  if (cc === 'EG') return lon > 32.6 ? 'asia' : 'africa'
  if (v.continent === 'americas') return v.subregion === 'South America' ? 'south-america' : 'north-america'
  // Overseas pieces of European countries (French Guiana, the Caribbean) belong where they lie.
  if (v.continent === 'europe' && lon < -30) return lat < 12 ? 'south-america' : 'north-america'
  return v.continent as Continent
}
/** Sutherland–Hodgman against one half-plane, keep where f(p) ≥ 0 (f linear). */
function clip(pts: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], fp = f(p), fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]) }
  })
  return out
}
/** Douglas–Peucker for a closed ring: split at the point farthest from the start, so neither half is degenerate. */
function simplify(ring: Pt[], tol: number): Pt[] {
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
  if (open.length < 4) return open
  let far = 0
  open.forEach(([x, y], i) => { if (Math.hypot(x - open[0][0], y - open[0][1]) > Math.hypot(open[far][0] - open[0][0], open[far][1] - open[0][1])) far = i })
  return [...dp(open.slice(0, far + 1), tol).slice(0, -1), ...dp([...open.slice(far), open[0]], tol).slice(0, -1)]
}
function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts
  const keep = new Array(pts.length).fill(false)
  keep[0] = keep[pts.length - 1] = true
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let best = -1, idx = -1
    const [ax, ay] = pts[a], [bx, by] = pts[b], len = Math.hypot(bx - ax, by - ay) || 1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
      if (d > best) { best = d; idx = i }
    }
    if (best > tol) { keep[idx] = true; stack.push([a, idx], [idx, b]) }
  }
  return pts.filter((_, i) => keep[i])
}
const area = (pts: Pt[]) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x * y2 - x2 * y }, 0)) / 2

export function pieces(): Map<Continent, Pt[][]> {
  const geo = JSON.parse(readFileSync('apps/next/public/maps/countries-110m-2.0.2-r2.geojson', 'utf8')) as Geo
  const out = new Map<Continent, Pt[][]>()
  const add = (c: Continent | null, r: Pt[]) => { if (c && r.length > 2 && area(r) > 1.2) out.set(c, [...(out.get(c) ?? []), r]) }
  for (const f of geo.features) {
    const cc = f.properties.id
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][]
    for (const poly of polys) {
      let r = simplify(poly[0].map(([lon, lat]) => [lon, Math.max(lat, -84)] as Pt), 0.7)
      if (area(r) < 1.2) continue
      const split: Record<string, [(p: Pt) => number, Continent, Continent]> = {
        RU: [(p) => (p[0] > 19 ? 60 - p[0] : -1), 'europe', 'asia'],
        KZ: [(p) => 51.5 - p[0], 'europe', 'asia'],
        EG: [(p) => 32.6 - p[0], 'africa', 'asia'],
      }
      if (split[cc]) {
        const [f0, a, b] = split[cc]
        add(a, clip(r, f0))
        add(b, clip(r, (p) => -f0(p)))
      } else if (cc === 'TR') {
        const thrace = clip(clip(r, (p) => 29.1 - p[0]), (p) => p[1] - 40.4)
        add('europe', thrace)
        add('asia', clip(r, (p) => p[0] - 29.1))
        add('asia', clip(clip(r, (p) => 29.1 - p[0]), (p) => 40.4 - p[1]))
      } else {
        const [lon, lat] = r[0]
        add(continentOf(cc, lon, lat), r)
      }
    }
  }
  return out
}

export type PuzzleOpts = { lit?: Continent; lift?: number; socket?: Continent }
/** lit: the coral piece; lift: how far it is raised out of the tray; socket: an empty socket outlined in coral. */
export function puzzle(k: number, { lit = SELECTED, lift = 0, socket }: PuzzleOpts = {}) {
  const s = new Scene(k)
  const SC = 0.6, LAT0 = 84, LAT1 = -84
  const W = 360 * SC, D = (LAT0 - LAT1) * SC
  const plan = (r: Pt[]): Pt[] => r.map(([lon, lat]) => [(lon + 180) * SC, (LAT0 - lat) * SC])
  s.poly(flat([[-12, -10], [W + 14, -10], [W + 14, D + 14], [-12, D + 14]], 0), 'shadow', 'none')
  s.rbox(-9, -9, 0, W + 18, D + 18, 4, 4, { top: 'front' })
  const T = 4, R = 6.5
  const map = pieces()
  /** A continent's outline without its internal borders: stroked wide, then filled over. */
  const layer = (c: Continent, z: number, fill: Paint, stroke: Paint, width = 1.6) => {
    const rings = (map.get(c) ?? []).map(plan)
    for (const r of rings) s.poly(flat(r, z), fill, stroke, undefined, width)
    for (const r of rings) s.poly(flat(r, z), fill, 'none')
  }
  // Sockets for every continent, then the pieces that are in, far to near.
  for (const { key } of CONTINENTS) layer(key, T, 'glass', key === socket ? 'accent' : 'detail', 1.6)
  // A lifted piece paints last, so it passes over its neighbours on the way up.
  const order: Continent[] = ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania', 'antarctica']
  const paint = lift > 0 ? [...order.filter((c) => c !== lit), lit] : order
  for (const c of paint) {
    if (!flown(c)) continue
    const hot = c === lit, up = hot ? lift : 0
    layer(c, T + up, hot ? 'accent-side' : 'side', 'line', 1.8)
    layer(c, R + up, hot ? 'accent' : ('mark' as Paint), hot ? 'accent' : 'line', 1.6)
  }
  // A frame label, and the count where a tray would print its contents.
  s.text('3 OF 7 PIECES', [W + 4, D + 9, T], X, [0, 1, 0], { size: 6, fill: 'muted', weight: 700, mono: true, anchor: 'end' })
  return s.done()
}

export const figures: Record<string, () => IsoFigureData> = {
  'continents-a-suitcase': fit(suitcase),
  'continents-b-puzzle': fit((k) => puzzle(k)),
}
