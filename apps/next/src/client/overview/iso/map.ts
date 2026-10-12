import { LAND_RINGS } from './land.generated'
import { Scene, r3, type P3, type Pt } from './scene'

// The sheet folds like an accordion: fold lines at X, each at height Z.
const X = [0, 46, 92, 138, 184],
  Z = [0, 13, 1, 13, 0],
  D = 84
/** How far each fold line sinks when the map unfolds a little on hover, in iso units. */
const UNFOLD = [0, 5, 0, 5, 0]
// Where the pins stand when the airports have no coordinates, and the margin real pins keep from the sheet's edges (their heads and labels need it).
const A0 = [30, 40] as const,
  B0 = [158, 52] as const,
  EDGE = { x0: 26, x1: 158, y0: 24, y1: 62 }
/** The narrowest window the sheet shows, in degrees, so a short hop zooms the map in until its route fills the sheet, yet still sits on a recognisable coast. */
const MIN_SPAN = 8
// Screen-space dash pattern of the route, in px, at every scale.
const DASH = 3,
  GAP = 3

export type MapPin = { code: string; lat: number | null; lon: number | null }
/** A pin for `code`, placed by its airport's coordinates when the payload has them. */
export const mapPin = (
  code: string,
  airport?: { lat: number | null; lon: number | null },
): MapPin => ({ code, lat: airport?.lat ?? null, lon: airport?.lon ?? null })
type Plan = readonly [number, number]

const RAD = Math.PI / 180
/** Points along the great circle from `a` to `b` ([lon, lat] in degrees), with longitudes unwrapped so the path never jumps at the antimeridian. */
function greatCircle(a: Plan, b: Plan, n: number): Plan[] {
  const v = ([lon, lat]: Plan) => [
    Math.cos(lat * RAD) * Math.cos(lon * RAD),
    Math.cos(lat * RAD) * Math.sin(lon * RAD),
    Math.sin(lat * RAD),
  ]
  const p = v(a),
    q = v(b),
    w = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])))
  const out: Plan[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      f = w < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / Math.sin(w),
      g = w < 1e-9 ? t : Math.sin(t * w) / Math.sin(w)
    const [x, y, z] = [0, 1, 2].map((j) => f * p[j] + g * q[j])
    let lon = Math.atan2(y, x) / RAD
    const prev = out.length ? out[out.length - 1][0] : a[0]
    lon += Math.round((prev - lon) / 360) * 360
    out.push([lon, Math.atan2(z, Math.hypot(x, y)) / RAD])
  }
  return out
}

/**
 * Lays an equirectangular window on the sheet that holds the whole great circle. The sheet turns so the route runs along its long side, as a folded map is held, but never more than a quarter turn, so north stays on the far half.
 * Returns `plan`, which places any [lon, lat] on the sheet, and the window's centre longitude.
 */
function windowOf(path: readonly Plan[]) {
  const lons = path.map((p) => p[0]),
    lats = path.map((p) => p[1])
  const cLon = (Math.min(...lons) + Math.max(...lons)) / 2,
    cLat = (Math.min(...lats) + Math.max(...lats)) / 2,
    squeeze = Math.cos(cLat * RAD)
  const flat = ([lon, lat]: Plan): Plan => [(lon - cLon) * squeeze, cLat - lat]
  const [a, b] = [flat(path[0]), flat(path[path.length - 1])]
  let turn = Math.atan2(b[1] - a[1], b[0] - a[0])
  if (turn > Math.PI / 2) turn -= Math.PI
  if (turn <= -Math.PI / 2) turn += Math.PI
  const c = Math.cos(turn),
    q = Math.sin(turn)
  const turned = (p: Plan): Plan => {
    const [u, v] = flat(p)
    return [u * c + v * q, v * c - u * q]
  }
  const pts = path.map(turned),
    us = pts.map((p) => p[0]),
    vs = pts.map((p) => p[1])
  const u0 = (Math.min(...us) + Math.max(...us)) / 2,
    v0 = (Math.min(...vs) + Math.max(...vs)) / 2
  const spanU = Math.max(Math.max(...us) - Math.min(...us), MIN_SPAN),
    spanV = Math.max(Math.max(...vs) - Math.min(...vs), 1)
  const scale = Math.min((EDGE.x1 - EDGE.x0) / spanU, (EDGE.y1 - EDGE.y0) / spanV)
  const cx = (EDGE.x0 + EDGE.x1) / 2,
    cy = (EDGE.y0 + EDGE.y1) / 2
  return {
    cLon,
    /** Plan units per degree of latitude. */
    scale,
    plan: (p: Plan): Plan => {
      const [u, v] = turned(p)
      return [cx + (u - u0) * scale, cy + (v - v0) * scale]
    },
  }
}

/** The runs of a plan polyline that lie on the sheet. */
function onSheet(line: readonly Plan[]): Plan[][] {
  const inside = ([x, y]: Plan) => x >= 0 && x <= X[4] && y >= 0 && y <= D
  const runs: Plan[][] = []
  let run: Plan[] = []
  for (const p of line) {
    if (inside(p)) run.push(p)
    else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs.filter((r) => r.length > 1)
}

/** Land rings in sheet plan, cut to the sheet. Each ring is tried at the copies of the world either side, so a window across the antimeridian still finds its coast. */
function landOn(cLon: number, plan: (p: Plan) => Plan): Pt[][] {
  const out: Pt[][] = []
  for (const flat of LAND_RINGS)
    for (const shift of [-360, 0, 360]) {
      if (Math.abs(flat[0] + shift - cLon) > 270) continue
      const ring: Pt[] = []
      for (let i = 0; i < flat.length; i += 2) ring.push(plan([flat[i] + shift, flat[i + 1]]))
      const clipped = clipRect(ring, 0, 0, X[4], D)
      if (clipped.length > 2) out.push(clipped)
    }
  return out
}

/** Sutherland–Hodgman against an axis-aligned rectangle. */
function clipRect(ring: readonly Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  let pts: readonly Pt[] = ring
  for (const [axis, edge, side] of [
    [0, x0, 1],
    [0, x1, -1],
    [1, y0, 1],
    [1, y1, -1],
  ] as const) {
    const inside = (p: Pt) => (p[axis] - edge) * side >= 0
    pts = pts.flatMap((p, j) => {
      const q = pts[(j + 1) % pts.length]
      const out: Pt[] = inside(p) ? [p] : []
      if (inside(p) !== inside(q)) {
        const f = (edge - p[axis]) / (q[axis] - p[axis])
        out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f])
      }
      return out
    })
    if (!pts.length) return []
  }
  return [...pts]
}

/** Liang–Barsky: the part of segment a–b inside the sheet's plan rectangle, or null. */
function clipSeg(a: Plan, b: Plan): [Plan, Plan] | null {
  let t0 = 0,
    t1 = 1
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  for (const [p, q] of [
    [-dx, a[0]],
    [dx, X[4] - a[0]],
    [-dy, a[1]],
    [dy, D - a[1]],
  ] as const) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) t0 = Math.max(t0, r)
    else t1 = Math.min(t1, r)
  }
  if (t1 - t0 < 1e-6) return null
  // Clamped, so rounding never leaves an end a hair outside the sheet.
  const on = (t: number): Plan => [
    Math.min(X[4], Math.max(0, a[0] + dx * t)),
    Math.min(D, Math.max(0, a[1] + dy * t)),
  ]
  return [on(t0), on(t1)]
}

const NICE = [1, 2, 5, 10, 15, 20, 30, 45],
  KM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]

const panelOf = (x: number) => Math.min(3, Math.max(0, X.findIndex((x1) => x <= x1) - 1))
const lerp = (a: number[], i: number, x: number) =>
  a[i] + ((x - X[i]) / (X[i + 1] - X[i])) * (a[i + 1] - a[i])
const zAt = (x: number) => lerp(Z, panelOf(x), x)
const sinkAt = (x: number) => lerp(UNFOLD, panelOf(x), x)

/** Splits a 3D polyline where it crosses a fold line, so each piece lies on one panel. A cut keeps the mark's height above the paper, so it lands on the fold rather than on the chord under it. */
function byPanel(pts: readonly P3[]): { panel: number; pts: P3[] }[] {
  const out: { panel: number; pts: P3[] }[] = []
  let piece: P3[] = [pts[0]],
    panel = panelOf(pts[0][0])
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const next = panelOf(b[0])
    if (next !== panel) {
      const fx = X[Math.max(panel, next)]
      const f = (fx - a[0]) / (b[0] - a[0])
      const cut: P3 = [fx, a[1] + (b[1] - a[1]) * f, zAt(fx) + (a[2] - zAt(a[0]))]
      piece.push(cut)
      out.push({ panel, pts: piece })
      piece = [cut]
      panel = next
    }
    piece.push(b)
  }
  out.push({ panel, pts: piece })
  return out.filter((p) => p.pts.length > 1)
}

/** Clips a closed plan outline to panel `i` (Sutherland–Hodgman against its two fold lines) and lays it on that panel. */
function onPanel(i: number, outline: readonly Pt[]): P3[] {
  let pts = outline
  for (const [fx, side] of [
    [X[i], 1],
    [X[i + 1], -1],
  ] as const) {
    const inside = (p: Pt) => (p[0] - fx) * side >= 0
    pts = pts.flatMap((p, j) => {
      const q = pts[(j + 1) % pts.length]
      const out: Pt[] = inside(p) ? [p] : []
      if (inside(p) !== inside(q))
        out.push([fx, p[1] + ((q[1] - p[1]) * (fx - p[0])) / (q[0] - p[0])])
      return out
    })
  }
  return pts.map(([x, y]) => [x, y, lerp(Z, i, x)])
}

/**
 * Records: a folded map with the longest flight pinned to it, `from` → `to`. With both airports' coordinates the sheet is a real equirectangular window: land is the true coast, the pins stand on the airports and the route is the great circle between them. Without, the pins take fixed places on a blank sheet.
 * `equator` draws the line the flight crosses.
 * Parts: `fold` (one per panel and layer; carries --fold-y/--fold-s/--fold-k, the screen transform that flattens that panel by UNFOLD), `dash` (a lit copy of one route dash; --t is its place along the route, 0 at `from`) and `pin` (carries --lift-y).
 */
export function foldedMap(from: MapPin, to: MapPin, k = 1, equator = false) {
  const located =
    from.lat !== null && from.lon !== null && to.lat !== null && to.lon !== null
      ? greatCircle([from.lon, from.lat], [to.lon, to.lat], 60)
      : null
  const sheet = located ? windowOf(located) : null
  const course: Plan[] = sheet
    ? located!.map(sheet.plan)
    : Array.from({ length: 61 }, (_, i) => {
        // No coordinates: the route bows north between the fixed pins.
        const u = i / 60
        return [
          A0[0] + (B0[0] - A0[0]) * u,
          A0[1] + (B0[1] - A0[1]) * u - Math.sin(Math.PI * u) * 14,
        ]
      })
  const A = course[0],
    B = course[60]
  const land = sheet ? landOn(sheet.cLon, sheet.plan) : []
  // Graticule: lines of longitude and latitude are straight in the equirectangular plan, so each is one segment clipped to the sheet and ends on its edge.
  const graticule: [Plan, Plan][] = []
  let scaleBar: { km: number; len: number } | null = null
  if (sheet) {
    const want = 22 / sheet.scale,
      step = NICE.find((n) => n >= want) ?? 45
    for (let l = Math.ceil((sheet.cLon - 200) / step) * step; l <= sheet.cLon + 200; l += step) {
      const seg = clipSeg(sheet.plan([l, -85]), sheet.plan([l, 85]))
      if (seg) graticule.push(seg)
    }
    for (let f = -85; f <= 85; f += step) {
      const seg = clipSeg(sheet.plan([sheet.cLon - 260, f]), sheet.plan([sheet.cLon + 260, f]))
      if (seg) graticule.push(seg)
    }
    const km = [...KM].reverse().find((n) => (n / 111.2) * sheet.scale <= 34) ?? KM[0]
    scaleBar = { km, len: (km / 111.2) * sheet.scale }
  } else {
    for (const x of [23, 69, 115, 161])
      graticule.push([
        [x, 0],
        [x, D],
      ])
    for (const y of [21, 42, 63])
      graticule.push([
        [0, y],
        [X[4], y],
      ])
    scaleBar = { km: 0, len: 32 }
  }
  // The equator is a line of latitude, so on a turned sheet it runs at the same angle; sampled every 2° and kept where it lies on the paper.
  const equatorLines: Plan[][] = sheet
    ? onSheet(Array.from({ length: 201 }, (_, i) => sheet.plan([sheet.cLon - 200 + i * 2, 0])))
    : [X.map((x): Plan => [x, 46])]
  const s = new Scene(k)
  // Lowering fold heights shears each panel along z linearly in x; projected, that is one 2D affine map per panel, solved from three of its corners.
  const fold = (i: number) => {
    const corners: P3[] = [
      [X[i], 0, Z[i]],
      [X[i + 1], 0, Z[i + 1]],
      [X[i], D, Z[i]],
    ]
    const src = corners.map((p) => s.project(p)),
      dst = corners.map(([x, y, z]) => s.project([x, y, z - sinkAt(x)]))
    // x stays put, y' = b·x + d·y + f.
    const [[x0, y0], [x1, y1], [x2, y2]] = src
    const det = x0 * (y1 - y2) - y0 * (x1 - x2) + (x1 * y2 - x2 * y1)
    const [v0, v1, v2] = dst.map((p) => p[1])
    const b = (v0 * (y1 - y2) - y0 * (v1 - v2) + (v1 * y2 - v2 * y1)) / det,
      d = (x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1)) / det,
      f = (x0 * (y1 * v2 - y2 * v1) - y0 * (x1 * v2 - x2 * v1) + v0 * (x1 * y2 - x2 * y1)) / det
    return {
      '--fold-y': `${r3(f)}px`,
      '--fold-s': `${r3(d)}`,
      '--fold-k': `${r3((Math.atan(b / d) * 180) / Math.PI)}deg`,
    }
  }
  const folds = [0, 1, 2, 3].map(fold)

  // A segment is cut at every fold it crosses before it is laid on the panels.
  const graticulePieces = graticule.flatMap(([a, b]) => {
    const [lo, hi] = a[0] <= b[0] ? [a, b] : [b, a],
      cuts = X.slice(1, 4).filter((fx) => fx > lo[0] && fx < hi[0]),
      at = (x: number): P3 => {
        const y = lo[1] + ((hi[1] - lo[1]) * (x - lo[0])) / (hi[0] - lo[0] || 1)
        return [x, y, zAt(x) + 0.05]
      },
      xs = [lo[0], ...cuts, hi[0]]
    return xs.slice(1).flatMap((x, j) => {
      const p0 = j === 0 ? ([lo[0], lo[1], zAt(lo[0]) + 0.05] as P3) : at(xs[j])
      const p1 = j === xs.length - 2 ? ([hi[0], hi[1], zAt(hi[0]) + 0.05] as P3) : at(x)
      // A piece belongs to the panel its middle lies on, not the one an end sits on at a fold.
      return [{ panel: panelOf((p0[0] + p1[0]) / 2), pts: [p0, p1] }]
    })
  })
  // Scale bar on the last panel's front edge: banded strip, ticks hanging from it, its length in km above.
  const legend = ({ km, len }: { km: number; len: number }) => {
    const x0 = X[4] - 8 - len,
      y0 = D - 9,
      y1 = D - 6,
      n = 4,
      at = (x: number, y: number): P3 => [x, y, zAt(x) + 0.05]
    for (let j = 0; j < n; j++)
      s.poly(
        [
          at(x0 + (len * j) / n, y0),
          at(x0 + (len * (j + 1)) / n, y0),
          at(x0 + (len * (j + 1)) / n, y1),
          at(x0 + (len * j) / n, y1),
        ],
        j % 2 ? 'top' : 'line',
        'line',
        undefined,
        0.5,
      )
    s.segs(
      Array.from({ length: n + 1 }, (_, j) => [
        at(x0 + (len * j) / n, y1),
        at(x0 + (len * j) / n, y1 + 1.8),
      ]),
      'line',
      0.5,
    )
    if (km)
      s.text(
        `${km} KM`,
        [x0, y0 - 2.2, zAt(x0) + 0.05],
        [1, 0, (Z[4] - Z[3]) / (X[4] - X[3])],
        [0, 1, 0],
        {
          size: 5,
          fill: 'muted',
          weight: 600,
          mono: true,
        },
      )
  }

  for (let i = 0; i < 4; i++)
    s.group(
      'fold',
      () => {
        const up = Z[i + 1] > Z[i]
        s.poly(
          [
            [X[i], D, Z[i]],
            [X[i + 1], D, Z[i + 1]],
            [X[i + 1], D, Z[i + 1] - 2.5],
            [X[i], D, Z[i] - 2.5],
          ],
          'side',
        )
        // The far end of the sheet shows its thickness too.
        if (i === 3)
          s.poly(
            [
              [X[4], 0, Z[4]],
              [X[4], D, Z[4]],
              [X[4], D, Z[4] - 2.5],
              [X[4], 0, Z[4] - 2.5],
            ],
            'side',
          )
        const panel: P3[] = [
          [X[i], 0, Z[i]],
          [X[i + 1], 0, Z[i + 1]],
          [X[i + 1], D, Z[i + 1]],
          [X[i], D, Z[i]],
        ]
        // Land sits between the paper and its edges, so the creases stay crisp where a coast crosses them.
        s.poly(panel, up ? 'front' : 'top', 'none')
        s.group('land', () => {
          for (const outline of land) {
            const piece = onPanel(i, outline)
            if (piece.length > 2) s.poly(piece, 'land', 'detail', undefined, 0.9)
          }
        })
        // Folds shade the paper beside them: deep in a valley, light on a ridge.
        for (const [fx, dir, valley] of [
          [X[i], 1, Z[i] < Z[i - 1]],
          [X[i + 1], -1, Z[i + 1] < Z[i]],
        ] as const) {
          if ((dir === 1 && i === 0) || (dir === -1 && i === 3)) continue
          for (const bw of valley ? [6, 3.5, 1.5] : [3.5, 1.5]) {
            const [xa, xb] = dir === 1 ? [fx, fx + bw] : [fx - bw, fx]
            s.poly(
              [xa, xb, xb, xa].map((x, j) => [x, j < 2 ? 0 : D, lerp(Z, i, x)] as P3),
              'shade',
              'none',
              undefined,
              undefined,
              valley ? 0.4 : 0.3,
            )
          }
        }
        for (const piece of graticulePieces.filter((g) => g.panel === i))
          s.line(piece.pts, 'detail', 0.5)
        // Paper corners: a mounting triangle tucked into each corner of the sheet.
        for (const [cx, cy] of i === 0
          ? ([
              [0, 0],
              [0, D],
            ] as const)
          : i === 3
            ? ([
                [X[4], 0],
                [X[4], D],
              ] as const)
            : [])
          s.poly(
            onPanel(i, [
              [cx, cy],
              [cx + (cx ? -7 : 7), cy],
              [cx, cy + (cy ? -7 : 7)],
            ]),
            'side',
            'crease',
            undefined,
            0.7,
          )
        if (i === 3 && scaleBar) legend(scaleBar)
        s.poly(panel, 'none')
      },
      { vars: folds[i] },
    )

  const on = (pts: readonly (readonly [number, number])[], lift: number): P3[] =>
    pts.map(([x, y]) => [x, y, zAt(x) + lift])
  const equatorPieces = equator ? equatorLines.flatMap((line) => byPanel(on(line, 0.2))) : []

  // Dashes are cut in screen space so the pattern matches the design at every scale.
  const route: P3[] = course.map(([x, y]) => [x, y, zAt(x) + 0.6])
  const screen = route.map((p) => s.project(p))
  const len = [0]
  for (let i = 1; i < screen.length; i++) len.push(len[i - 1] + dist(screen[i - 1], screen[i]))
  const total = len[len.length - 1]
  const at = (l: number): P3 => {
    let i = 1
    while (i < len.length - 1 && len[i] < l) i++
    const f = (l - len[i - 1]) / (len[i] - len[i - 1] || 1)
    const [a, b] = [route[i - 1], route[i]],
      x = a[0] + (b[0] - a[0]) * f
    return [x, a[1] + (b[1] - a[1]) * f, zAt(x) + (a[2] - zAt(a[0]))]
  }
  const dashes: { t: number; panel: number; pts: P3[] }[] = []
  const count = Math.floor((total + GAP) / (DASH + GAP))
  for (let j = 0; j < count; j++) {
    const l0 = j * (DASH + GAP),
      l1 = Math.min(total, l0 + DASH)
    const pts = [at(l0), ...route.filter((_, i) => len[i] > l0 && len[i] < l1), at(l1)]
    const t = count > 1 ? Math.round((j / (count - 1)) * 100) / 100 : 0
    for (const piece of byPanel(pts)) dashes.push({ t, ...piece })
  }

  const m = route[27],
    n = route[29],
    hd = Math.atan2(n[1] - m[1], n[0] - m[0])
  const glyph: P3[] = (
    [
      [4, 0],
      [1, 0.8],
      [0.2, 4.2],
      [-0.9, 4.2],
      [-0.4, 0.9],
      [-3, 0.9],
      [-3.8, 2.2],
      [-4.4, 2.2],
      [-4, 0],
      [-4.4, -2.2],
      [-3.8, -2.2],
      [-3, -0.9],
      [-0.4, -0.9],
      [-0.9, -4.2],
      [0.2, -4.2],
      [1, -0.8],
    ] as const
  ).map(([a, b]) => {
    const c = Math.cos(hd),
      q = Math.sin(hd)
    return [m[0] + (a * c - b * q) * 1.5, m[1] + (a * q + b * c) * 1.5, m[2] + 2]
  })

  // Everything lying on a panel rides that panel's fold; drawn after all panels so a later panel never covers it.
  for (let i = 0; i < 4; i++)
    s.group(
      'fold',
      () => {
        for (const e of equatorPieces.filter((p) => p.panel === i))
          s.line(e.pts, 'detail', 0.9, '2 3')
        const mine = dashes.filter((d) => d.panel === i)
        if (mine.length)
          s.segs(
            mine.map((d) => d.pts),
            'muted',
            1.3,
          )
        for (const d of mine)
          s.group(
            'dash',
            () => {
              s.glow(1.6, () => s.segs([d.pts], 'accent', 2))
              s.segs([d.pts], 'accent', 1.7)
            },
            { vars: { '--t': `${d.t}` } },
          )
        if (panelOf(m[0]) === i) s.poly(glyph, 'ink', 'ink')
      },
      { vars: folds[i] },
    )

  // Pins stand off the sheet, so they rise and sink whole instead of shearing with it.
  // The destination's label stands above the sheet's back-right edge, which would otherwise cut through it.
  // Each label sits on its pin's outer side, so close pins never share one: the right pin's above and right of its head, clear of the sheet's back-right edge; the left pin's to the left.
  const right = B[0] - B[1] >= A[0] - A[1]
  for (const [[x, y], code, outer] of [
    [A, from.code, !right],
    [B, to.code, right],
  ] as const) {
    const z = zAt(x) + 0.3
    const [, liftY] = s.vector(0, 0, -sinkAt(x))
    s.group(
      'pin',
      () => {
        s.lit(s.circle([x, y, z], [1, 0, 0], [0, 1, 0], 0, 0, 3.4, 20), 4.2)
        s.line(
          [
            [x, y, z],
            [x, y, z + 30],
          ],
          'accent',
          1.4,
        )
        s.glow(4.2, () =>
          s.poly(
            [
              [x - 3, y - 3, z + 36],
              [x + 3, y - 3, z + 36],
              [x + 3, y + 3, z + 36],
              [x - 3, y + 3, z + 36],
            ],
            'accent',
            'none',
          ),
        )
        s.box(x - 3, y - 3, z + 29, 6, 6, 7, {
          top: 'accent',
          front: 'accent',
          side: 'accent',
          stroke: 'accent',
        })
        // The x-facing side in shade; the accent stroke stays as its rim, so the head keeps its size at tile scale.
        s.poly(
          [
            [x + 3, y - 3, z + 36],
            [x + 3, y + 3, z + 36],
            [x + 3, y + 3, z + 29],
            [x + 3, y - 3, z + 29],
          ],
          'accent-side',
          'none',
        )
        // The label rides a small plate hung on the head's outer side, riveted at both ends; a blank sheet has none.
        if (code) {
          const [hx, hy] = s.P(x, y, z + 32.5),
            pw = Math.max(1, code.length) * 4.4 + 5,
            ph = 9,
            dir = outer ? 1 : -1,
            px0 = hx + dir * 5.4,
            px1 = px0 + dir * pw
          s.poly2(
            [
              [px0, hy - ph / 2],
              [px1, hy - ph / 2],
              [px1, hy + ph / 2],
              [px0, hy + ph / 2],
            ],
            'front',
            'line',
            0.8,
          )
          for (const rx of [px0 + dir * 1.6, px1 - dir * 1.6])
            s.poly2(
              [
                [rx - 0.5, hy - ph / 2 + 1.2],
                [rx + 0.5, hy - ph / 2 + 1.2],
                [rx + 0.5, hy - ph / 2 + 2.2],
                [rx - 0.5, hy - ph / 2 + 2.2],
              ],
              'crease',
              'none',
            )
          s.screenText(code, [x, y, z + 32.5], {
            dx: dir * (5.4 + pw / 2),
            dy: 2.5,
            size: 7,
            fill: 'ink',
            weight: 600,
            anchor: 'middle',
          })
        }
      },
      { vars: { '--lift-y': `${liftY}px` } },
    )
  }
  return s.done()
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
