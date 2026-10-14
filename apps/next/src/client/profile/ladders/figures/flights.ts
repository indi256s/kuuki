import { Scene, hull, roundRect, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { cylX, cylY } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

// Flights: the aircraft that grows. Paper plane, light single, turboprop, narrowbody, widebody.
// Frame: the nose points +x (right-down on screen), the viewer sees the +y flank and the top; the ground is z = 3 (top of the apron slab).

const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1],
  NZ: P3 = [0, 0, -1]
const D2R = Math.PI / 180
const GROUND = 3

/** Fuselage station: x, half-width, half-height, centre height. */
type Stn = readonly [x: number, ry: number, rz: number, zc: number]

function at(st: readonly Stn[], x: number) {
  let i = 0
  while (i < st.length - 2 && x > st[i + 1][0]) i++
  const [x0, a0, b0, c0] = st[i],
    [x1, a1, b1, c1] = st[i + 1]
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
  return { ry: a0 + (a1 - a0) * t, rz: b0 + (b1 - b0) * t, zc: c0 + (c1 - c0) * t }
}
/** Flank y at height z on the fuselage at x. */
function sideY(st: readonly Stn[], x: number, z: number) {
  const { ry, rz, zc } = at(st, x)
  const q = Math.max(-1, Math.min(1, (z - zc) / rz))
  return ry * Math.sqrt(1 - q * q) + 0.04
}
/** Point on the fuselage skin at angle `deg` (0 = flank, 90 = crown). */
function skin(st: readonly Stn[], x: number, deg: number): P3 {
  const { ry, rz, zc } = at(st, x)
  return [x, ry * Math.cos(deg * D2R), zc + rz * Math.sin(deg * D2R)]
}

/** Lofted fuselage: visible half of each ring, three tones, silhouette last. */
function loft(s: Scene, st: readonly Stn[], hero: boolean) {
  const step = hero ? 15 : 22.5
  const angles: number[] = []
  for (let a = -45; a <= 135 + 1e-9; a += step) angles.push(a)
  const rings = st.map((_, i) => angles.map((a) => skin(st, st[i][0], a)))
  const outline = hull(rings.flat().map(([x, y, z]) => s.P(x, y, z)))
  s.poly2(outline, 'front', 'none')
  const tones: [number, number, Paint][] = [
    [-45, 0, 'side'],
    [0, 45, 'front'],
    [45, 135, 'top'],
  ]
  for (let i = 0; i < rings.length - 1; i++)
    for (const [lo, hi, paint] of tones) {
      const ids = angles.flatMap((a, j) => (a >= lo - 1e-9 && a <= hi + 1e-9 ? [j] : []))
      s.poly(
        [...ids.map((j) => rings[i][j]), ...[...ids].reverse().map((j) => rings[i + 1][j])],
        paint,
        paint,
        undefined,
        0.6,
      )
    }
  // The nose end faces the viewer.
  const last = st[st.length - 1]
  const cap: P3[] = []
  for (let a = 0; a < 360; a += 20) cap.push(skin(st, last[0], a))
  s.poly(cap, 'side', 'line')
  s.poly2(outline, 'none', 'line', hero ? 1 : 1.4)
}
/** Ring seams across the visible half. */
function seams(s: Scene, st: readonly Stn[], xs: readonly number[]) {
  for (const x of xs) {
    const pts: P3[] = []
    for (let a = -45; a <= 135; a += 15) pts.push(skin(st, x, a))
    s.line(pts, 'crease', 0.6)
  }
}
/** A line along the fuselage at skin angle `deg`, between two stations. */
function belt(s: Scene, st: readonly Stn[], deg: number, x0: number, x1: number, paint: Paint) {
  const xs = st.map((p) => p[0]).filter((x) => x > x0 && x < x1)
  s.line(
    [x0, ...xs, x1].map((x) => skin(st, x, deg)),
    paint,
    0.6,
  )
}
function winRect(s: Scene, st: readonly Stn[], xa: number, xb: number, za: number, zb: number) {
  const p = (x: number, z: number): P3 => [x, sideY(st, x, z), z]
  s.poly([p(xa, za), p(xb, za), p(xb, zb), p(xa, zb)], 'glass', 'crease', 1, 0.6)
}
function winRound(s: Scene, st: readonly Stn[], x: number, z: number, r: number) {
  s.poly(s.circle([x, sideY(st, x, z), z], X, Z, 0, 0, r, 8), 'glass', 'crease', 1, 0.6)
}
function door(s: Scene, st: readonly Stn[], xa: number, xb: number, za: number, zb: number) {
  s.poly(
    roundRect(xa, za, xb - xa, zb - za, 1.2, 3).map(([a, b]): P3 => [a, sideY(st, a, b), b]),
    'none',
    'crease',
    1,
    0.7,
  )
}
const dot = (s: Scene, p: P3, r: number, paint: Paint = 'ink') =>
  s.poly(s.circle(p, X, Y, 0, 0, r, 6), paint, 'none')

/** Horizontal slab with a thickness: visible edges, then the top. Points carry their bottom height. */
function plate(s: Scene, pts: readonly P3[], t: number, f: { top?: Paint } = {}) {
  const area = pts.reduce((a, [x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length]
    return a + x * y2 - x2 * y
  }, 0)
  const sg = area > 0 ? 1 : -1
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const nx = sg * (q[1] - p[1]),
      ny = -sg * (q[0] - p[0])
    if (nx + ny > 1e-6)
      s.poly(
        [p, q, [q[0], q[1], q[2] + t], [p[0], p[1], p[2] + t]],
        nx > ny ? 'side' : 'front',
        'line',
      )
  })
  s.poly(
    pts.map(([x, y, z]): P3 => [x, y, z + t]),
    f.top ?? 'top',
    'line',
  )
}
/** Upright plate in the x–z plane, from y to y + t. Points are [x, z]. */
function vplate(s: Scene, y: number, t: number, pts: readonly Pt[], face: Paint = 'front') {
  const area = pts.reduce((a, [x, z], i) => {
    const [x2, z2] = pts[(i + 1) % pts.length]
    return a + x * z2 - x2 * z
  }, 0)
  const sg = area > 0 ? 1 : -1
  pts.forEach(([x, z], i) => {
    const [x2, z2] = pts[(i + 1) % pts.length]
    const nx = sg * (z2 - z),
      nz = -sg * (x2 - x)
    if (nx + nz > 1e-6)
      s.poly(
        [
          [x, y, z],
          [x2, y, z2],
          [x2, y + t, z2],
          [x, y + t, z],
        ],
        nz > nx ? 'top' : 'side',
        'line',
      )
  })
  s.poly(
    pts.map(([x, z]): P3 => [x, y + t, z]),
    face,
    'line',
  )
}

type Wing = {
  root: number
  tip: number
  le: readonly [number, number]
  te: readonly [number, number]
  z: number
  t: number
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const leX = (w: Wing, y: number) => lerp(w.le[0], w.le[1], (y - w.root) / (w.tip - w.root))
const teX = (w: Wing, y: number) => lerp(w.te[0], w.te[1], (y - w.root) / (w.tip - w.root))
function wing(s: Scene, w: Wing, sg: number, rootY = w.root) {
  plate(
    s,
    [
      [leX(w, rootY), sg * rootY, w.z],
      [w.le[1], sg * w.tip, w.z],
      [w.te[1], sg * w.tip, w.z],
      [teX(w, rootY), sg * rootY, w.z],
    ],
    w.t,
  )
}
/** A line along the span at chord fraction f, from y0 to y1, on the wing top. */
function chordLine(
  s: Scene,
  w: Wing,
  sg: number,
  f: number,
  y0: number,
  y1: number,
  paint: Paint = 'crease',
) {
  s.line(
    [y0, y1].map((y): P3 => [lerp(leX(w, y), teX(w, y), f), sg * y, w.z + w.t]),
    paint,
    0.6,
  )
}
/** A line across the chord at span y, between fractions f0 and f1. */
function spanLine(s: Scene, w: Wing, sg: number, y: number, f0: number, f1: number) {
  s.line(
    [f0, f1].map((f): P3 => [lerp(leX(w, y), teX(w, y), f), sg * y, w.z + w.t]),
    'crease',
    0.6,
  )
}

function leg(s: Scene, a: P3, b: P3, w = 1.6) {
  s.line([a, b], 'line', w + 1.2)
  s.line([a, b], 'front', w)
}
function wheel(s: Scene, x: number, y: number, z: number, r: number, d: number, hero: boolean) {
  cylY(s, x, y - d / 2, z, r, d, { face: 'front', body: 'shade' }, hero ? 20 : 12)
  if (hero)
    s.poly(s.circle([x, y + d / 2 + 0.03, z], X, NZ, 0, 0, r * 0.5, 10), 'top', 'crease', 1, 0.6)
}

/** Apron slab, its joints and the taxi line. */
function apron(s: Scene, x0: number, x1: number, y0: number, y1: number, hero: boolean) {
  s.rbox(x0, y0, 0, x1 - x0, y1 - y0, GROUND, 3)
  if (!hero) return
  const n = Math.round((x1 - x0) / 36)
  for (let i = 1; i < n; i++) {
    const x = lerp(x0, x1, i / n)
    s.line(
      [
        [x, y0, GROUND],
        [x, y1, GROUND],
      ],
      'crease',
      0.6,
    )
  }
  for (let x = x0 + 8; x < x1 - 12; x += 14)
    s.poly(
      [
        [x, -0.5, GROUND],
        [x + 8, -0.5, GROUND],
        [x + 8, 0.5, GROUND],
        [x, 0.5, GROUND],
      ],
      'detail',
      'none',
    )
}
function shadowEll(s: Scene, cx: number, cy: number, rx: number, ry: number) {
  const pts: P3[] = []
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * 2 * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a), GROUND + 0.03])
  }
  s.poly(pts, 'shadow', 'none')
}

/** Blades of a propeller in the plane facing +x. */
function blades(s: Scene, cx: number, cy: number, cz: number, R: number, ang: number[], bw = 1) {
  const at2 = s.on([cx, cy, cz], Y, NZ)
  const pts = (phi: number) => {
    const d = phi * D2R
    const p = (a: number, b: number) =>
      at2(a * Math.sin(d) + b * Math.cos(d), a * Math.cos(d) - b * Math.sin(d))
    return [
      p(1.8, -bw),
      p(R * 0.5, -2.2 * bw),
      p(R, -bw),
      p(R, bw),
      p(R * 0.5, 2.2 * bw),
      p(1.8, bw),
    ]
  }
  for (const phi of ang) s.poly(pts(phi), 'accent', 'accent')
}
/** `light` thins the disc (low wash, fine rim) and the blades, so a twin does not read as a quad. */
function propLit(s: Scene, props: readonly P3[], R: number, hero: boolean, light = false) {
  s.group('lit', () => {
    for (const [cx, cy, cz] of props) {
      const rim = s.circle([cx, cy, cz], Y, NZ, 0, 0, R, 32)
      s.poly(rim, 'accent', 'none', undefined, undefined, light ? 0.05 : 0.14)
      s.poly(rim, 'none', 'accent', light ? 0.6 : 0.9, light ? (hero ? 0.7 : 1.1) : hero ? 1 : 1.6)
      if (!light) s.glow(4, () => blades(s, cx, cy, cz, R, [24, 204]))
      blades(s, cx, cy, cz, R, [24, 204], light ? 0.6 : 1)
    }
  })
}
function spinner(s: Scene, x: number, y: number, z: number, r: number, hero: boolean) {
  cylX(s, x, y, z, r, r * 1.5, { body: 'top', face: 'front' }, hero ? 20 : 12)
  cylX(s, x + r * 1.5, y, z, r * 0.45, r * 0.6, { body: 'top', face: 'front' }, 10)
}

/** Engine cowl in the lit group: accent lip, dark intake, fan. */
function cowl(
  s: Scene,
  xa: number,
  xf: number,
  y: number,
  zc: number,
  r: number,
  hero: boolean,
  fan: number,
) {
  const disc = s.circle([xf, y, zc], Y, NZ, 0, 0, r, 24)
  s.glow(3.5, () => s.poly(disc, 'accent', 'none'))
  cylX(s, xa, y, zc, r, xf - xa, { body: 'accent-side', face: 'accent', stroke: 'accent' }, 24)
  s.poly(s.circle([xf + 0.03, y, zc], Y, NZ, 0, 0, r * 0.76, 24), 'shade', 'detail', 1, 0.6)
  if (!hero) return
  const hub = s.circle([xf + 0.05, y, zc], Y, NZ, 0, 0, r * 0.2, 10)
  const inner = s.circle([xf + 0.05, y, zc], Y, NZ, 0, 0, r * 0.15, fan)
  const outer = s.circle([xf + 0.05, y, zc], Y, NZ, 0, 0, r * 0.74, fan)
  s.segs(
    inner.map((p, i) => [p, outer[(i + 1) % fan]]),
    'detail',
    0.7,
  )
  s.poly(hub, 'top', 'detail', 1, 0.6)
}
/** Engine body behind the cowl, with its pylon and exhaust cone. */
function engineBody(
  s: Scene,
  xr: number,
  xc: number,
  y: number,
  zc: number,
  r: number,
  wingTop: number,
  hero: boolean,
) {
  const ztop = zc + r
  vplate(s, y - 0.8, 1.6, [
    [xr - 2, ztop - 2],
    [xr - 2, wingTop],
    [xr + 10, ztop + 0.3],
    [xr + 10, ztop - 2],
  ])
  cylX(s, xr - 3, y, zc, r * 0.6, 3, { body: 'side', face: 'shade' }, 14)
  cylX(s, xr, y, zc, r, xc - xr, { body: 'front', face: 'side' }, hero ? 24 : 16)
  if (hero)
    s.line(
      [-45, -15, 15, 45, 75, 105, 135].map((a): P3 => [
        xr + (xc - xr) * 0.45,
        y + r * Math.cos(a * D2R),
        zc + r * Math.sin(a * D2R),
      ]),
      'crease',
      0.6,
    )
}

// ---------------------------------------------------------------- rung 1: paper plane
function paper(s: Scene, hero: boolean) {
  apron(s, -30, 30, -26, 26, hero)
  shadowEll(s, 0, 0, 25, 20)
  for (const x of [-17, -6]) {
    s.rbox(x, -4.5, GROUND, 6, 9, 5, 1.2)
    if (hero)
      s.line(
        [
          [x + 3, -4.5, 8],
          [x + 3, 4.5, 8],
        ],
        'crease',
        0.6,
      )
  }
  const zk = 15
  const N: P3 = [20, 0, zk + 0.5],
    R: P3 = [-20, 0, zk + 0.5],
    TF: P3 = [-14, -19, zk + 8],
    TN: P3 = [-14, 19, zk + 8]
  const mix = (a: P3, b: P3, t: number): P3 => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ]
  const folds = (T: P3, paint: Paint = 'crease') =>
    hero
      ? s.segs(
          [
            [mix(N, T, 0.45), mix(N, R, 0.55)],
            [mix(N, T, 0.8), mix(N, R, 0.9)],
            [mix(N, T, 0.2), mix(N, R, 0.25)],
          ],
          paint,
          paint === 'accent' ? 0.9 : 0.6,
        )
      : undefined
  s.poly([N, TF, R], 'top', 'line')
  folds(TF)
  vplate(s, -0.6, 1.2, [
    [20, zk],
    [-20, zk],
    [-20, 8],
    [4, 8],
  ])
  if (hero)
    s.line(
      [
        [20, 0.7, zk],
        [-20, 0.7, zk],
      ],
      'crease',
      0.6,
    )
  s.group('lit', () => {
    // Outline and a light wash, not a slab; the creases carry the accent.
    s.glow(3, () => s.poly([N, TN, R], 'none', 'accent', 1, 1.6))
    s.poly([N, TN, R], 'accent', 'accent', 1, hero ? 1.2 : 1.6, 0.22)
    folds(TN, 'accent')
  })
}

// ---------------------------------------------------------------- rung 2: light single
const CESSNA: Stn[] = [
  [-30, 0.8, 1, 23.6],
  [-24, 1.6, 2.2, 22.8],
  [-14, 3.2, 4, 20.8],
  [-6, 4.6, 5.8, 18.6],
  [0, 5.2, 6.8, 17.2],
  [12, 5.2, 6.8, 17.2],
  [19, 4.6, 6, 16.6],
  [26, 4.2, 5.4, 16],
  [28.5, 4, 5, 15.6],
]
const CESSNA_WING: Wing = { root: 0, tip: 34, le: [11, 8], te: [-4.5, -3], z: 23.6, t: 1.4 }

function cessna(s: Scene, hero: boolean) {
  const st = CESSNA,
    w = CESSNA_WING
  apron(s, -40, 40, -38, 38, hero)
  shadowEll(s, -1, 0, 32, 30)
  const gear = (sg: number) => {
    leg(s, [-2, sg * 4.6, 11.4], [-2, sg * 10.4, 6.6], 1.8)
    wheel(s, -2, sg * 11.4, 6.4, 3.4, 1.8, hero)
    if (hero) s.box(1.6, sg * 11.4 - 1.4, GROUND, 2.4, 2.8, 1.4)
  }
  const strut = (sg: number) => {
    leg(s, [3, sg * sideY(st, 3, 13), 13], [1.5, sg * 19, w.z], 1.3)
    if (hero) dot(s, [3, sg * sideY(st, 3, 13) + 0.1, 13], 0.8, 'detail')
  }
  const stab = (sg: number) =>
    plate(
      s,
      [
        [-17, sg * 1.6, 21.6],
        [-22, sg * 15, 21.6],
        [-27.5, sg * 15, 21.6],
        [-28, sg * 1.6, 21.6],
      ],
      0.9,
    )
  gear(-1)
  strut(-1)
  stab(-1)
  loft(s, st, hero)
  if (hero) {
    seams(s, st, [-20, -10, 18])
    belt(s, st, 12, -14, 19, 'crease')
  }
  s.poly(
    [skin(st, 12.6, 40), skin(st, 18.2, 50), skin(st, 18.2, 105), skin(st, 12.6, 110)],
    'glass',
    'crease',
    1,
    0.6,
  )
  winRect(s, st, 4.2, 11.8, 17.4, 21.6)
  winRect(s, st, -3.4, 2.2, 17.4, 21.6)
  if (hero) {
    winRect(s, st, -9, -5.4, 17.8, 21)
    door(s, st, 3.2, 12.8, 11, 22.6)
    dot(s, [11.8, sideY(st, 11.8, 15) + 0.1, 15], 0.5, 'detail')
  }
  // cowl face
  s.poly(s.circle([28.55, 0, 15.6], Y, NZ, 0, 0, 3.9, 20), 'side', 'line')
  if (hero)
    for (const sg of [-1, 1])
      s.poly(s.circle([28.6, sg * 2, 14.4], Y, NZ, 0, 0, 1, 8), 'shade', 'none')
  gear(1)
  leg(s, [20.5, 0, 9.6], [22.2, 0, 5.8], 1.2)
  wheel(s, 22.2, 0, 5.8, 2.8, 1.6, hero)
  vplate(s, -0.6, 1.2, [
    [-10, 23.6],
    [-21, 41],
    [-27, 41],
    [-28, 23.4],
  ])
  if (hero) {
    s.line(
      [
        [-26, 0.65, 24],
        [-25.2, 0.65, 40.6],
      ],
      'crease',
      0.6,
    )
    dot(s, [-24, 0.65, 40.8], 0.8, 'detail')
  }
  stab(1)
  strut(1)
  wing(s, w, -1)
  wing(s, w, 1)
  if (hero)
    for (const sg of [-1, 1]) {
      chordLine(s, w, sg, 0.72, 0, 34)
      spanLine(s, w, sg, 18, 0.72, 1)
      dot(s, [-1.6, sg * 32.6, w.z + w.t + 0.02], 0.9)
      s.line(
        [
          [leX(w, 14), sg * 14, w.z + 0.5],
          [leX(w, 14) + 3, sg * 14, w.z + 0.5],
        ],
        'line',
        1,
      )
    }
  spinner(s, 28.6, 0, 15.6, 2.3, hero)
  propLit(s, [[31.4, 0, 15.6]], 11.5, hero)
  cylX(s, 31.4 + 0.05, 0, 15.6, 1, 1.4, { body: 'top', face: 'front' }, 10)
}

// ---------------------------------------------------------------- rung 3: turboprop
const TPROP: Stn[] = [
  [-42, 1.2, 1.6, 22],
  [-34, 3, 4, 21],
  [-22, 5.5, 6.3, 19],
  [-12, 7.2, 7.8, 17.2],
  [0, 7.6, 8, 17],
  [22, 7.6, 8, 17],
  [30, 6.9, 7.4, 16.6],
  [37, 5.4, 5.8, 16.2],
  [42, 3.6, 3.8, 16],
]
const TPROP_WING: Wing = { root: 0, tip: 44, le: [12, 5], te: [-10, -6], z: 24.2, t: 2.2 }

function turboprop(s: Scene, hero: boolean) {
  const st = TPROP,
    w = TPROP_WING
  apron(s, -50, 50, -34, 34, hero)
  shadowEll(s, 0, 0, 42, 30)
  const YN = 17
  const nacelle = (sg: number) => {
    const y = sg * YN
    // gear sponson and wheel
    leg(s, [-2, y, 14], [-2, y, 7], 2)
    wheel(s, -2, y, 7, 4, 3, hero)
    s.rbox(-12, y - 3.2, 11.5, 16, 6.4, 8, 2.4)
    // nacelle and gearbox
    cylX(s, -18, y, 22.5, 4.4, 42, { body: 'front', face: 'side' }, hero ? 24 : 14)
    cylX(s, 24, y, 22.5, 3.4, 4.5, { body: 'top', face: 'front' }, 16)
    if (hero)
      s.line(
        [-30, -10, 10, 30, 50, 70, 90, 110, 135].map((a): P3 => [
          14,
          y + 4.4 * Math.cos(a * D2R),
          22.5 + 4.4 * Math.sin(a * D2R),
        ]),
        'crease',
        0.6,
      )
  }
  const stab = (sg: number) =>
    plate(
      s,
      [
        [-36.5, sg * 1.2, 51],
        [-39, sg * 19, 51],
        [-45, sg * 19, 51],
        [-44.5, sg * 1.2, 51],
      ],
      1.4,
    )
  stab(-1)
  loft(s, st, hero)
  if (hero) {
    seams(s, st, [-30, -18, 10, 30])
    belt(s, st, 0, -34, 36, 'crease')
    for (let x = -22; x <= 16; x += 4) winRound(s, st, x, 20.2, 1.2)
    door(s, st, 22, 27.5, 10.5, 23.5)
    door(s, st, -31, -26, 12, 22.5)
    winRect(s, st, 36.5, 39.5, 18.8, 20.6)
  } else winRect(s, st, -22, 16, 19.2, 21.2)
  s.poly(s.circle([42.02, 0, 16], Y, NZ, 0, 0, 3.4, 16), 'side', 'line')
  // nose gear
  leg(s, [33, 0, 9.2], [33.6, 0, 6.4], 1.4)
  wheel(s, 33.6, 0, 6.2, 3.2, 2, hero)
  vplate(s, -0.7, 1.4, [
    [-20, 25],
    [-37, 52],
    [-44, 52],
    [-44, 23],
  ])
  if (hero)
    s.line(
      [
        [-41.5, 0.75, 24],
        [-41.5, 0.75, 51.6],
      ],
      'crease',
      0.6,
    )
  stab(1)
  wing(s, w, -1)
  nacelle(-1)
  wing(s, w, 1)
  nacelle(1)
  if (hero)
    for (const sg of [-1, 1]) {
      chordLine(s, w, sg, 0.7, 0, 44)
      spanLine(s, w, sg, 30, 0.7, 1)
      dot(s, [-4, sg * 42.6, w.z + w.t + 0.02], 1)
    }
  propLit(
    s,
    [
      [28.9, -YN, 22.5],
      [28.9, YN, 22.5],
    ],
    11,
    hero,
    true,
  )
  for (const sg of [-1, 1])
    cylX(s, 28.9, sg * YN, 22.5, 1.2, 1.6, { body: 'top', face: 'front' }, 10)
}

// ---------------------------------------------------------------- rung 4: narrowbody
const NARROW: Stn[] = [
  [-55, 1.5, 2, 27],
  [-48, 3.5, 4.6, 26],
  [-36, 7, 7.9, 22.8],
  [-24, 8.8, 9.4, 21.4],
  [-10, 9, 9.5, 21],
  [24, 9, 9.5, 21],
  [36, 8.6, 9.2, 21.3],
  [46, 7, 7.6, 21.6],
  [52, 4.5, 5, 21.2],
  [55, 2.4, 2.8, 21],
]
const NARROW_WING: Wing = { root: 0, tip: 46, le: [16, -14], te: [-14, -24], z: 14, t: 1.8 }

function narrowbody(s: Scene, hero: boolean) {
  const st = NARROW,
    w = NARROW_WING
  const rootY = sideY(st, 0, 15) - 0.3
  apron(s, -62, 62, -36, 36, hero)
  shadowEll(s, 0, 0, 52, 30)
  const YE = 22,
    ER = 5.3,
    EZ = 9.2,
    CL = 3.2
  const eRear = leX(w, YE) + 2,
    eFront = eRear + 19
  const engine = (sg: number) => engineBody(s, eRear, eFront - CL, sg * YE, EZ, ER, w.z + w.t, hero)
  const stab = (sg: number) =>
    plate(
      s,
      [
        [-38, sg * 3, 26.6],
        [-50, sg * 20, 26.6],
        [-55, sg * 20, 26.6],
        [-55, sg * 3, 26.6],
      ],
      1.2,
    )
  const mainGear = (sg: number) => {
    const y = sg * 17
    leg(s, [-4, y, 14], [-4, y, 7.2], 2)
    for (const d of [-2.3, 2.3]) wheel(s, -4, y + d, 7.2, 4.2, 2.2, hero)
  }
  const winglet = (sg: number) =>
    vplate(s, sg > 0 ? w.tip - 0.8 : -w.tip - 0.8, 0.8, [
      [-14, 15.8],
      [-19, 29],
      [-24.5, 29],
      [-24, 15.8],
    ])
  mainGear(-1)
  wing(s, w, -1)
  stab(-1)
  engine(-1)
  loft(s, st, hero)
  if (hero) {
    seams(s, st, [-44, -30, -16, 0, 16, 30, 42])
    belt(s, st, 0, -50, 50, 'crease')
    for (let x = -34; x <= 29; x += 3.4) winRect(s, st, x, x + 1.7, 23.4, 25.8)
    for (const x of [-43, 34.5]) door(s, st, x, x + 5, 14, 28)
    for (const x of [-2, 10]) door(s, st, x, x + 2.6, 17, 24)
    for (const x of [46.5, 48.8, 51]) winRect(s, st, x, x + 1.7, 25.2, 27)
  } else winRect(s, st, -34, 30, 23.4, 25.8)
  s.poly(s.circle([55.02, 0, 21], Y, NZ, 0, 0, 2.6, 14), 'side', 'line')
  // nose gear
  leg(s, [40, 0, 12], [40, 0, 6.4], 1.6)
  for (const d of [-2.2, 2.2]) wheel(s, 40, d, 6.2, 3.2, 1.8, hero)
  mainGear(1)
  vplate(s, -0.7, 1.4, [
    [-28, 30],
    [-44, 62],
    [-54, 62],
    [-56, 27],
  ])
  if (hero) {
    s.line(
      [
        [-50.5, 0.75, 28],
        [-51.5, 0.75, 61.6],
      ],
      'crease',
      0.6,
    )
    dot(s, [-47, 0.8, 62.2], 0.9, 'detail')
  }
  stab(1)
  wing(s, w, 1, rootY)
  winglet(-1)
  winglet(1)
  engine(1)
  for (const sg of [-1, 1]) {
    if (hero) {
      chordLine(s, w, sg, 0.72, rootY, w.tip)
      chordLine(s, w, sg, 0.1, rootY, w.tip)
      spanLine(s, w, sg, 20, 0.1, 0.72)
      spanLine(s, w, sg, 34, 0.1, 0.72)
      dot(s, [-23, sg * 45.2, w.z + w.t + 0.02], 0.9)
    }
  }
  s.group('lit', () => {
    for (const sg of [-1, 1]) cowl(s, eFront - CL, eFront, sg * YE, EZ, ER, hero, 9)
  })
}

// ---------------------------------------------------------------- rung 5: widebody
const WIDE: Stn[] = [
  [-82, 2.4, 3, 37],
  [-73, 5.4, 7, 35],
  [-54, 11, 11.5, 31],
  [-35, 13.2, 13, 28],
  [-14, 13.4, 13.2, 27],
  [36, 13.4, 13.2, 27],
  [54, 12.4, 12.4, 27.4],
  [68, 9.8, 10, 28],
  [77, 5.5, 6, 28],
  [82, 3.2, 3.4, 27.8],
]
const WIDE_WING: Wing = { root: 0, tip: 82, le: [24, -42], te: [-26, -54], z: 21, t: 2.6 }

function widebody(s: Scene, hero: boolean, initials: string) {
  const st = WIDE,
    w = WIDE_WING
  const rootY = sideY(st, 0, 22) - 0.3
  apron(s, -92, 92, -60, 60, hero)
  shadowEll(s, 0, 0, 78, 50)
  const YE = 40,
    ER = 10.6,
    EZ = 14.6,
    CL = 5.5
  const eRear = leX(w, YE) + 2,
    eFront = eRear + 38
  const engine = (sg: number) => engineBody(s, eRear, eFront - CL, sg * YE, EZ, ER, w.z + w.t, hero)
  const stab = (sg: number) =>
    plate(
      s,
      [
        [-60, sg * 8, 35],
        [-76, sg * 38, 35],
        [-82, sg * 38, 35],
        [-81.5, sg * 8, 35],
      ],
      1.6,
    )
  const mainGear = (sg: number) => {
    const y = sg * 26
    leg(s, [-1, y, 21], [-1, y, 8], 2.6)
    s.line(
      [
        [-6.5, y, 8],
        [4.5, y, 8],
      ],
      'line',
      2,
    )
    for (const x of [-6.5, 4.5]) for (const d of [-2.8, 2.8]) wheel(s, x, y + d, 8, 5, 2.6, hero)
  }
  mainGear(-1)
  wing(s, w, -1)
  stab(-1)
  engine(-1)
  loft(s, st, hero)
  if (hero) {
    seams(s, st, [-64, -46, -28, -10, 10, 28, 46, 60])
    belt(s, st, 0, -74, 74, 'crease')
    for (let x = -50; x <= 48; x += 3.9) winRect(s, st, x, x + 1.9, 31, 33.6)
    for (const x of [-60, -26, 14, 52]) door(s, st, x, x + 5.8, 17, 36)
    for (const x of [68, 70.4, 72.8]) winRect(s, st, x, x + 1.8, 32.2, 34)
  } else winRect(s, st, -50, 50, 31, 33.6)
  s.poly(s.circle([82.02, 0, 27.8], Y, NZ, 0, 0, 3.2, 14), 'side', 'line')
  leg(s, [66, 0, 19], [66, 0, 8.2], 2.4)
  for (const d of [-2.6, 2.6]) wheel(s, 66, d, 8, 5, 2.4, hero)
  mainGear(1)
  const FIN: Pt[] = [
    [-40, 41],
    [-64, 88],
    [-77, 88],
    [-80, 42],
  ]
  vplate(s, -0.9, 1.8, FIN)
  if (hero) {
    s.line(
      [
        [-72, 0.95, 43],
        [-73, 0.95, 87.6],
      ],
      'crease',
      0.6,
    )
    dot(s, [-70, 1, 88.2], 1.1, 'detail')
  }
  if (initials && hero)
    s.text(initials, [-60, 0.95, 66], [1, 0, 0], [0, 0, -1], {
      size: 13,
      fill: 'ink',
      weight: 800,
      anchor: 'middle',
    })
  stab(1)
  wing(s, w, 1, rootY)
  engine(1)
  for (const sg of [-1, 1]) {
    if (hero) {
      chordLine(s, w, sg, 0.74, rootY, w.tip)
      chordLine(s, w, sg, 0.1, rootY, w.tip)
      spanLine(s, w, sg, 28, 0.1, 0.74)
      spanLine(s, w, sg, 50, 0.1, 0.74)
      spanLine(s, w, sg, 64, 0.1, 0.74)
      dot(s, [-50, sg * 80.4, w.z + w.t + 0.02], 1.1)
      for (const y of [22, 38, 58]) {
        const x = teX(w, y)
        s.rbox(x - 3, sg > 0 ? y - 1 : -y - 1, w.z - 1.2, 3.5, 2, 1.6, 0.8)
      }
    }
  }
  s.group('lit', () => {
    for (const sg of [-1, 1]) cowl(s, eFront - CL, eFront, sg * YE, EZ, ER, hero, 16)
  })
}

export const flights: LadderFigureDef = {
  id: 'flights',
  rungs: 5,
  build(k, { rung, lod, initials }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    if (rung === 1) paper(s, hero)
    else if (rung === 2) cessna(s, hero)
    else if (rung === 3) turboprop(s, hero)
    else if (rung === 4) narrowbody(s, hero)
    else widebody(s, hero, (initials ?? '').trim().toUpperCase())
    return s.done()
  },
}
