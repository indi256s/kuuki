import { Scene, hull, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import type { LadderFigureDef } from './types'
import {
  ACCENT,
  GREY,
  LIGHT,
  add,
  comb,
  cross,
  disc,
  dot,
  facing,
  frameAlong,
  knurl,
  lathe,
  mul,
  spline,
  sub,
  toneOf,
  tube,
  unit,
  type Ramp,
} from './parts'

// A cork map board on a tabletop easel. The board leans back on the easel's tray, held at the top by a clamp on the mast.
// Mitred wooden frame with a bevel, cork recessed inside it, a printed world map pinned to the cork by two tacks with its bottom corners lifting.
// Rung r has r + 1 map pins in; the newest stands upright with an accent head, the earlier ones lean a little.
// Rung 5: the sixth pin went in so hard it tore the map and split the frame; a chip lies on the table.
//
// Everything on the board is placed in board coordinates (u, v, w): u along the board (world x), v up its face, w out of it toward the viewer.

const LEAN = (9 * Math.PI) / 180,
  SL = Math.sin(LEAN),
  CL = Math.cos(LEAN)
/** The whole stand is turned 22° about z so the board's face looks more at the viewer; (x, y, z) below are in that turned frame. */
const TURN = (22 * Math.PI) / 180
const X: P3 = [Math.cos(TURN), -Math.sin(TURN), 0],
  Y: P3 = [Math.sin(TURN), Math.cos(TURN), 0]
const wp = (x: number, y: number, z: number): P3 => [x * X[0] + y * Y[0], x * X[1] + y * Y[1], z]
const U = X,
  V: P3 = comb([0, 0, 0], [-SL, Y], [CL, [0, 0, 1]]),
  N: P3 = comb([0, 0, 0], [CL, Y], [SL, [0, 0, 1]])

/** Board: outer size, frame bar width, bevel width and drop, frame front, cork face, backing board. */
const W = 144,
  H = 74,
  BAR = 7,
  BV = 2,
  BD = 1.4,
  FT = 6.5,
  CK = 3,
  BK = 1
/** Easel tray: top face height, plank front, lip. */
const TZ = 9,
  TY0 = -1.5,
  TY1 = 11.5,
  LIP = 2
/** Paper map and its printed area. */
const PU0 = 15,
  PU1 = W - 15,
  PV0 = 14,
  PV1 = H - 14,
  P_IN = 2.2,
  MU0 = PU0 + P_IN,
  MU1 = PU1 - P_IN,
  MV0 = PV0 + P_IN,
  MV1 = PV1 - P_IN,
  LAT0 = -58,
  LAT1 = 86,
  PW = CK + 0.12
/** Map coordinates: longitude and latitude to board (u, v). */
const mapU = (lon: number) => MU0 + ((lon + 180) / 360) * (MU1 - MU0)
const mapV = (lat: number) => MV0 + ((lat - LAT0) / (LAT1 - LAT0)) * (MV1 - MV0)

/** The board's back-bottom edge rests on the tray at y = 0. */
const ORIGIN: P3 = wp(0, BK * CL, TZ + BK * SL)
const at = (u: number, v: number, w: number): P3 => comb(ORIGIN, [u, U], [v, V], [w, N])

/** Light falling on the board face: a point `h` off the face throws its shadow by (du, dv)·h. */
const LN = dot(LIGHT, N),
  SHU = -dot(LIGHT, U) / LN,
  SHV = -dot(LIGHT, V) / LN

type Region = { name: string; pin: Pt; tilt: Pt }

/** One pin per continent, in the order they go in; `pin` is (lon, lat), `tilt` leans an older pin in (u, v) per unit of height. */
const REGIONS: readonly Region[] = [
  { name: 'europe', pin: [10, 50], tilt: [-0.24, 0.12] },
  { name: 'north-america', pin: [-100, 45], tilt: [0.26, 0.1] },
  { name: 'asia', pin: [95, 48], tilt: [0.18, -0.2] },
  { name: 'africa', pin: [22, 4], tilt: [-0.16, -0.2] },
  { name: 'south-america', pin: [-60, -12], tilt: [0.22, 0.16] },
  { name: 'oceania', pin: [134, -25], tilt: [0, 0] },
]

/** Simplified coastlines: rings of `lon,lat` pairs. */
const LAND: readonly (readonly Pt[])[] = [
  // North and Central America
  '-166,68 -163,71 -156,71.5 -140,70 -128,70.5 -115,68.5 -100,68 -94,72 -82,70 -80,63 -94,59 -92,57 ' +
    '-82,55 -78,61 -70,60 -64,60 -62,55 -56,52 -60,47 -66,44 -70,42 -74,40 -76,35 -81,31 -80,26 -81,25 ' +
    '-83,29 -89,30 -97,27 -97,22 -94,18 -90,21 -87,21 -88,16 -84,15 -83,10 -79,9 -77,8 -80,7 -83,8 -86,12 ' +
    '-92,14 -97,16 -105,20 -110,24 -113,30 -117,33 -121,35 -124,40 -124,46 -123,49 -130,54 -136,58 ' +
    '-140,60 -148,60 -152,58 -158,56 -162,55 -158,58 -164,60 -165,63',
  // Greenland
  '-73,78 -60,82 -40,83.5 -22,82 -18,77 -22,70 -32,68 -40,65 -43,60 -50,62 -54,67 -56,72 -66,76',
  // Cuba
  '-85,22 -80,23 -74,20 -78,20 -84,21.5',
  // South America
  '-80,9 -76,11 -72,12 -64,10.5 -60,8 -52,5 -50,1 -44,-2 -35,-6 -35,-9 -39,-14 -40,-22 -44,-23 -48,-26 ' +
    '-49,-29 -53,-34 -58,-35 -57,-38 -62,-39 -65,-41 -65,-45 -68,-47 -66,-49 -69,-51 -68,-53 -71,-54 ' +
    '-74,-52 -75,-47 -73,-42 -73,-37 -71,-30 -70,-20 -71,-18 -76,-14 -79,-8 -81,-5 -80,-2 -79,1 -77,4 ' +
    '-77,7',
  // Eurasia
  '-9,37 -9,43 -2,43.5 -1,46 -4,48 -1,49.5 2,51 4,52 8,54 8,57 10,57.5 10,55 13,54 20,54.5 22,57 ' +
    '24,59.5 29,60 22,60.5 21,63 25,65.5 22,66 17,62 19,60 16,56 12,56 10,59 6,58 5,62 12,66 16,69 ' +
    '22,70.5 29,71 33,69 41,67 40,64 44,66 44,68 53,68 60,69 69,73 73,71 80,73 88,75 100,77 106,77 114,74 ' +
    '128,73 140,72 150,71 160,70 170,70 180,69 180,65 178,64 172,62 163,60 160,54 156,51 156,57 162,62 ' +
    '154,59 143,59 137,54 141,52 140,48 135,43 131,43 129,40 129,35 126,35 126,38 125,40 121,40 118,38 ' +
    '122,37 120,33 122,30 120,26 117,23 111,21 108,22 106,19 109,15 109,11 105,9 103,10 101,13 100,8 ' +
    '103,4 104,1 101,3 98,8 98,16 94,17 93,21 89,22 86,20 80,15 80,10 77,8 73,16 72,21 69,23 66,25 58,25 ' +
    '57,26 56,24 59,22.5 55,17 52,16 45,13 43,15 39,21 35,28 34,31 35,33 36,36 30,36.5 27,37 26,40 24,40 ' +
    '23,37 21,38 19,42 13,46 12,44 16,41 18,40 16,38 15,40 12,42 9,44 3,43 3,42 0,40 -1,37 -6,36',
  // Britain, Ireland, Iceland
  '-5.5,50 1.5,51 1.5,53 -0.5,54.5 -2,56 -3,58.6 -5,58.6 -6,56.5 -4.5,55 -3,53.5 -4.5,52 -5,51.5',
  '-10,51.5 -6,52 -6,54 -8,55.2 -10,54',
  '-24,64 -22,66 -15,66.5 -13,65 -18,63.4',
  // Africa and Madagascar
  '-17,21 -16,24 -13,28 -10,30 -9,33 -6,36 0,36 10,37 11,34 10,33 15,32 20,31 25,32 32,31 34,28 38,22 ' +
    '39,17 43,12 51,12 51,10 48,5 44,1 40,-3 40,-10 41,-15 35,-20 35,-24 33,-27 30,-31 27,-34 20,-35 ' +
    '18,-33 18,-30 15,-26 12,-18 12,-13 14,-9 12,-5 9,-1 9,4 6,4.5 2,6 -3,5 -8,4.5 -12,7 -15,11 -17,15',
  '44,-16 50,-15 49.5,-20 47,-25 44,-24 43,-21',
  // Japan, the Philippines and the islands south of Asia
  '130,31 132,34 135,34 140,35 141,38 142,40 141.5,42 145,43.5 142,45.5 140,42 139,38 136,36 132,35.5',
  '120,18 122,18 124,12 126,7 122,7 121,13',
  '95,5.5 98,4 104,-2 106,-6 102,-4 98,0',
  '105,-6 114,-7 115,-8.5 106,-7',
  '109,1.5 111,2 117,7 119,5 118,1 116,-4 110,-3',
  '131,-1 135,-3 141,-2.5 146,-5 150,-10 146,-8.5 143,-9 138,-8 137,-5 132,-4',
  // Australia, Tasmania, New Zealand
  '114,-22 117,-20.5 122,-18 125,-14.5 129,-15 131,-12 136,-12 137,-16 140,-17.5 142,-11 144,-14 ' +
    '146,-19 150,-22.5 153,-26 153,-30 151,-34 150,-37.5 146,-39 140,-38 138,-35 136,-35 135,-34 ' +
    '131,-31.5 124,-33.5 118,-35 115,-34 115,-30 113,-26',
  '145,-41 148,-41 147,-43.5 145.5,-43',
  '173,-35 175,-37 178,-38 176,-41.5 174.5,-41 174,-39',
  '172.5,-41 174,-41.5 172,-44 169,-46.5 166.5,-46 168,-44 171,-42',
].map((ring) =>
  ring.split(' ').map((pair): Pt => {
    const [lon, lat] = pair.split(',').map(Number)
    return [lon, lat]
  }),
)

/** Mulberry32: the speckle's only source of randomness. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Newell normal of a planar loop. */
function normalOf(pts: readonly P3[]): P3 {
  let n: P3 = [0, 0, 0]
  for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]))
  return unit(n)
}

/**
 * A convex solid from its vertices and faces (index loops): each face that looks at the viewer is filled by its light, its edges in `edge`, then one outline round the whole solid.
 * Faces need no particular winding; normals are turned away from the centroid.
 */
function convex(
  s: Scene,
  verts: readonly P3[],
  faces: readonly (readonly number[])[],
  o: { ramp?: Ramp; edge?: Paint; outline?: Paint; width?: number } = {},
) {
  const c = mul(
    verts.reduce<P3>((p, q) => add(p, q), [0, 0, 0]),
    1 / verts.length,
  )
  for (const f of faces) {
    const pts = f.map((i) => verts[i])
    let n = normalOf(pts)
    const fc = mul(
      pts.reduce<P3>((p, q) => add(p, q), [0, 0, 0]),
      1 / pts.length,
    )
    if (dot(n, sub(fc, c)) < 0) n = mul(n, -1)
    if (facing(n)) s.poly(pts, toneOf(n, o.ramp), o.edge ?? 'crease', undefined, 0.5)
  }
  s.poly2(hull(s.pp(verts)), 'none', o.outline ?? 'line', o.width)
}

/** Faces of an 8-vertex block indexed iu + 2·iv + 4·iw. */
const BLOCK = [
  [0, 2, 6, 4],
  [1, 3, 7, 5],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 1, 3, 2],
  [4, 5, 7, 6],
] as const
const blockVerts = (p: (u: number, v: number, w: number) => P3, u: Pt, v: Pt, w: Pt): P3[] => {
  const out: P3[] = []
  for (let i = 0; i < 8; i++) out.push(p(u[i & 1], v[(i >> 1) & 1], w[(i >> 2) & 1]))
  return out
}
/** A block on the board, in board coordinates. */
const boardBlock = (s: Scene, u: Pt, v: Pt, w: Pt) => convex(s, blockVerts(at, u, v, w), BLOCK)
/** An upright block in the turned frame, and a soft shadow on the table. */
const standBlock = (s: Scene, x: Pt, y: Pt, z: Pt) => convex(s, blockVerts(wp, x, y, z), BLOCK)
const shadowOn = (s: Scene, x0: number, y0: number, x1: number, y1: number) =>
  s.poly([wp(x0, y0, 0), wp(x1, y0, 0), wp(x1, y1, 0), wp(x0, y1, 0)], 'shadow', 'none')
/** A square batten of side `t` from a to b. */
function beam(s: Scene, a: P3, b: P3, t: number) {
  const F = frameAlong(a, sub(b, a))
  const h = t / 2
  const p = (x: number, y: number, z: number) => comb(x ? b : a, [y, F.u], [z, F.v])
  convex(s, blockVerts(p, [0, 1], [-h, h], [-h, h]), BLOCK)
}

/** The frame bars' section, (inward d, out w): back, front, bevel start, bevel foot, back again. */
const PROFILE: readonly Pt[] = [
  [0, 0],
  [0, FT],
  [BAR - BV, FT],
  [BAR, FT - BD],
  [BAR, 0],
]
type Bar = { a: Pt; b: Pt; e: Pt; n: Pt }
const BARS: Record<'bottom' | 'right' | 'top' | 'left', Bar> = {
  bottom: { a: [0, 0], b: [W, 0], e: [1, 0], n: [0, 1] },
  right: { a: [W, 0], b: [W, H], e: [0, 1], n: [-1, 0] },
  top: { a: [W, H], b: [0, H], e: [-1, 0], n: [0, -1] },
  left: { a: [0, H], b: [0, 0], e: [0, -1], n: [1, 0] },
}
/** A point on a bar: `t` along it from its start mitre's outer corner, `d` in from the outer edge, `w` out. */
const barAt = (B: Bar, t: number, d: number, w: number) =>
  at(B.a[0] + B.e[0] * t + B.n[0] * d, B.a[1] + B.e[1] * t + B.n[1] * d, w)
const barLen = (B: Bar) => Math.abs(B.b[0] - B.a[0]) + Math.abs(B.b[1] - B.a[1])

export const continents: LadderFigureDef = {
  id: 'continents',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const pinCount = rung + 1
    const cracked = rung === 5

    /** Mitred bar: the profile swept from mitre to mitre. */
    const bar = (B: Bar) => {
      const L = barLen(B)
      const verts = [
        ...PROFILE.map(([d, w]) => barAt(B, d, d, w)),
        ...PROFILE.map(([d, w]) => barAt(B, L - d, d, w)),
      ]
      const m = PROFILE.length
      const faces = [
        ...PROFILE.map((_, j) => [j, (j + 1) % m, m + ((j + 1) % m), m + j]),
        PROFILE.map((_, j) => j),
        PROFILE.map((_, j) => m + j),
      ]
      convex(s, verts, faces, { outline: 'crease' })
      if (!hero) return
      // Grain along the flat face, from mitre seam to mitre seam.
      s.segs(
        [1.5, 3.4].map((d) => [barAt(B, d, d, FT), barAt(B, L - d, d, FT)]),
        'detail',
        0.45,
      )
    }

    // ------------------------------------------------------------ easel base: shadow, feet, legs, tray

    const legs: [P3, P3][] = [
      [
        [24, 2, TZ - 2],
        [18, 12, 0.8],
      ],
      [
        [W - 24, 2, TZ - 2],
        [W - 18, 12, 0.8],
      ],
    ]
    if (hero) {
      shadowOn(s, -8, TY0 - 4, W + 8, TY1 + 3)
      for (const [, f] of legs) shadowOn(s, f[0] - 5, f[1] - 5, f[0] + 5, f[1] + 5)
      // Felt pads under the feet.
      for (const [, f] of legs)
        standBlock(s, [f[0] - 2.4, f[0] + 2.4], [f[1] - 2.4, f[1] + 2.4], [0, 0.8])
      // Stretcher between the legs, its ends inside them.
      const fr = 0.55
      const mid = legs.map(([a, b]) => add(a, mul(sub(b, a), fr)))
      beam(s, wp(...mid[0]), wp(...mid[1]), 2.2)
    }
    for (const [a, b] of legs) beam(s, wp(...a), wp(...b), 3.2)
    standBlock(s, [-4, W + 4], [TY0, TY1], [TZ - 2, TZ])

    // ------------------------------------------------------------ the board, then the clamp and the mast's top

    // Backing board, a little inside the frame's outer edge.
    boardBlock(s, [0.6, W - 0.6], [0.6, H - 0.6], [-BK, 0])

    if (hero) {
      bar(BARS.bottom)
      bar(BARS.left)
    } else boardBlock(s, [0, W], [0, H], [0, FT])

    // Cork.
    const corkUV: Pt[] = [
      [BAR, BAR],
      [W - BAR, BAR],
      [W - BAR, H - BAR],
      [BAR, H - BAR],
    ]
    s.poly(
      corkUV.map(([u, v]) => at(u, v, hero ? CK : FT)),
      'side',
      'crease',
      undefined,
      0.5,
    )

    /** Paper lift near the two free bottom corners. */
    const lift = (u: number, v: number) => {
      const d = Math.min(Math.hypot(u - PU0, v - PV0), Math.hypot(u - PU1, v - PV0))
      const f = Math.max(0, 1 - d / 13)
      return 2.2 * f * f
    }
    const paperAt = (u: number, v: number, dw = 0): P3 =>
      at(u, v, (hero ? PW : FT) + lift(u, v) + dw)
    /** The paper outline, sampled finely so the lifted corners curve. */
    const paperRing: Pt[] = []
    {
      const corners: Pt[] = [
        [PU0, PV0],
        [PU1, PV0],
        [PU1, PV1],
        [PU0, PV1],
      ]
      corners.forEach((p, i) => {
        const q = corners[(i + 1) % 4]
        const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2))
        for (let j = 0; j < n; j++)
          paperRing.push([p[0] + ((q[0] - p[0]) * j) / n, p[1] + ((q[1] - p[1]) * j) / n])
      })
    }
    /** A straight run across the paper, sampled so it follows the lift. */
    const run = (a: Pt, b: Pt, dw = 0.02) => {
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3))
      return Array.from({ length: n + 1 }, (_, i) =>
        paperAt(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, dw),
      )
    }

    if (hero) {
      // Real cork: a fine speckle that thins out toward the frame, with a few old pin holes, only where the map leaves it bare.
      const rnd = seeded(2024)
      const flecks: P3[][] = [],
        dots: P3[][] = []
      const x0 = BAR + 0.6,
        x1 = W - BAR - 0.6,
        z0 = BAR + 0.6,
        z1 = H - BAR - 0.6
      for (let i = 0; i < 1900; i++) {
        const u = x0 + rnd() * (x1 - x0),
          v = z0 + rnd() * (z1 - z0)
        const edge = Math.min(u - x0, x1 - u, v - z0, z1 - v)
        const keep = rnd() < 0.15 + smooth(0, 4.5, edge) * 0.7
        const a = rnd() * Math.PI,
          ln = 0.4 + rnd() * 1,
          big = rnd() < 0.3
        if (!keep || (u > PU0 - 0.6 && u < PU1 + 0.6 && v > PV0 - 0.6 && v < PV1 + 0.6)) continue
        if (big) dots.push([at(u, v, CK + 0.02), at(u + 0.2, v + 0.1, CK + 0.02)])
        else
          flecks.push([
            at(u, v, CK + 0.02),
            at(u + Math.cos(a) * ln, v + Math.sin(a) * ln, CK + 0.02),
          ])
      }
      s.segs(flecks, 'detail', 0.6)
      s.segs(dots, 'crease', 0.9)
      const holes: Pt[] = [
        [11, 22],
        [10.5, 51],
        [36, 10.5],
        [W - 11, 30],
        [W - 10.5, 61],
        [90, H - 10.5],
      ]
      for (const [u, v] of holes)
        s.poly(s.circle(at(u, v, CK + 0.03), U, V, 0, 0, 0.35, 8), 'shade', 'none')
      // The top bar's shadow on the cork.
      s.poly(
        [
          at(BAR, H - BAR, CK + 0.02),
          at(W - BAR, H - BAR, CK + 0.02),
          at(W - BAR, H - BAR - 2.6, CK + 0.02),
          at(BAR + 1.5, H - BAR - 2.6, CK + 0.02),
        ],
        'shadow',
        'none',
      )
      // Shadows under the lifted corners.
      for (const cu of [PU0, PU1]) {
        const pts = paperRing.filter(([u, v]) => lift(u, v) > 0.05 && Math.abs(u - cu) < 14)
        const shad = pts.map(([u, v]) => {
          const h = lift(u, v)
          return at(u + SHU * h, v + SHV * h, CK + 0.02)
        })
        s.poly2(
          hull(s.pp([...shad, ...pts.map(([u, v]) => at(u, v, CK + 0.02))])),
          'shadow',
          'none',
        )
      }
    }

    // The map.
    s.poly(
      paperRing.map(([u, v]) => paperAt(u, v)),
      'top',
      'line',
      undefined,
      hero ? 0.6 : 1,
    )
    if (hero) {
      // Border: a ruled band of alternating degree cells between two lines, then the graticule and the land.
      const B0 = 1,
        B1 = P_IN
      const band: P3[][] = []
      const lonStep = (MU1 - MU0) / 24,
        latStep = (MV1 - MV0) / 9.6
      for (let i = 0; i < 24; i += 2)
        for (const [va, vb] of [
          [PV0 + B0, PV0 + B1],
          [PV1 - B1, PV1 - B0],
        ]) {
          const ua = MU0 + i * lonStep,
            ub = ua + lonStep
          band.push([
            paperAt(ua, va, 0.02),
            paperAt(ub, va, 0.02),
            paperAt(ub, vb, 0.02),
            paperAt(ua, vb, 0.02),
          ])
        }
      for (let i = 0; i * latStep < MV1 - MV0 - 0.01; i += 2)
        for (const [ua, ub] of [
          [PU0 + B0, PU0 + B1],
          [PU1 - B1, PU1 - B0],
        ]) {
          const va = MV0 + i * latStep,
            vb = Math.min(MV1, va + latStep)
          band.push([
            paperAt(ua, va, 0.02),
            paperAt(ub, va, 0.02),
            paperAt(ub, vb, 0.02),
            paperAt(ua, vb, 0.02),
          ])
        }
      for (const q of band) s.poly(q, 'detail', 'none')
      for (const ins of [B0, B1]) {
        const r: Pt[] = [
          [PU0 + ins, PV0 + ins],
          [PU1 - ins, PV0 + ins],
          [PU1 - ins, PV1 - ins],
          [PU0 + ins, PV1 - ins],
        ]
        s.line(
          [...r, r[0]].flatMap((p, i, all) =>
            i ? run(all[i - 1], p).slice(1) : [paperAt(p[0], p[1], 0.02)],
          ),
          'crease',
          0.4,
        )
      }
      const grat: P3[][] = []
      for (let lon = -150; lon <= 150; lon += 30) grat.push(run([mapU(lon), MV0], [mapU(lon), MV1]))
      for (const lat of [-30, 30, 60]) grat.push(run([MU0, mapV(lat)], [MU1, mapV(lat)]))
      s.segs(grat, 'detail', 0.45)
      s.line(run([MU0, mapV(0)], [MU1, mapV(0)]), 'crease', 0.4)
      for (const ring of LAND)
        s.poly(
          ring.map(([lon, lat]) => paperAt(mapU(lon), mapV(lat), 0.04)),
          'land',
          'crease',
          undefined,
          0.5,
        )
    }

    // Front frame bars, over the cork's edges.
    if (hero) {
      bar(BARS.right)
      bar(BARS.top)
    }
    // The frame's outline: the board's outer corners, backing included.
    s.poly2(hull(s.pp(blockVerts(at, [0, W], [0, H], [-BK, FT]))), 'none', 'line')

    // Top clamp: a block sliding on the mast, hooked over the top bar, with a thumb screw.
    const MU = W / 2
    boardBlock(s, [MU - 5, MU + 5], [H, H + 3], [-BK - 3.4, FT])
    boardBlock(s, [MU - 2.5, MU + 2.5], [H + 3, H + (hero ? 9 : 8)], [-BK - 3, -BK])
    if (hero) {
      // Chamfered mast top.
      const cap = [
        at(MU - 2.5, H + 9, -BK - 3),
        at(MU + 2.5, H + 9, -BK - 3),
        at(MU - 2.5, H + 9, -BK),
        at(MU + 2.5, H + 9, -BK),
        at(MU - 1.6, H + 10.2, -BK - 2.1),
        at(MU + 1.6, H + 10.2, -BK - 2.1),
        at(MU - 1.6, H + 10.2, -BK - 0.9),
        at(MU + 1.6, H + 10.2, -BK - 0.9),
      ]
      convex(s, cap, [
        [0, 1, 5, 4],
        [2, 3, 7, 6],
        [0, 2, 6, 4],
        [1, 3, 7, 5],
        [4, 5, 7, 6],
        [0, 1, 3, 2],
      ])
      // Thumb screw on the clamp's top, in front of the mast.
      const sc = at(MU, H + 3, 2.4)
      const F = frameAlong(sc, V)
      disc(s, add(sc, mul(V, 0.25)), V, 1.2, 0.5, { ring: 20, width: 0.7 })
      const kp = spline([
        [0.5, 0.6],
        [1, 0.6],
        [1.2, 1.6],
        [2.6, 1.6],
        [2.9, 1.2],
      ])
      const knob = lathe(s, F, (t) => ({ r: kp(t)[0] }), 0.5, 2.9, {
        steps: 8,
        ring: 28,
        shade: true,
        width: 0.8,
      })
      knurl(knob, 1.3, 2.5, 22, 'crease', 0.4)
      knob.seam(1.3)
      knob.seam(2.5)
    }
    // Lip over the top bar's front, with two screws.
    boardBlock(s, [MU - 5, MU + 5], [H - 3.6, H + 3], [FT, FT + 1.2])
    if (hero)
      for (const du of [-3, 3]) {
        const c = at(MU + du, H - 1.6, FT + 1.21)
        s.poly(s.circle(c, U, V, 0, 0, 0.75, 12), 'none', 'crease', undefined, 0.5)
        s.poly(s.circle(c, U, V, 0, 0, 0.42, 8), 'line', 'none')
      }

    // ------------------------------------------------------------ rung 5: the split

    const lastPin = REGIONS[pinCount - 1].pin
    const cu = mapU(lastPin[0])
    if (cracked) {
      const B = BARS.bottom
      // The crack's centre wanders as it runs from the cork, up the inner wall, over the bevel and down the front; it opens toward the outer edge.
      const path: [number, number, number, number][] = hero
        ? [
            // [d, w, jitter, gap]
            [BAR, CK, 0, 0],
            [BAR, FT - BD, 0.5, 0.5],
            [BAR - BV, FT, -0.4, 0.9],
            [3.8, FT, 0.8, 1.4],
            [2.4, FT, -0.3, 1.9],
            [1.1, FT, 0.7, 2.3],
            [0, FT, 0.1, 2.7],
          ]
        : [
            [BAR + 3, FT, 0, 1],
            [BAR, FT, -2, 2],
            [3.5, FT, 2, 3],
            [0, FT, -1, 4],
          ]
      const left = path.map(([d, w, j, g]) => barAt(B, cu + j - g / 2, d, w))
      const right = path.map(([d, w, j, g]) => barAt(B, cu + j + g / 2, d, w))
      s.poly([...left, ...right.reverse()], 'line', 'line', undefined, hero ? 0.6 : 1.2)
      // Thumb: one bold jagged line from the pin to the split.
      if (!hero)
        s.line(
          [
            [cu, mapV(lastPin[1])],
            [cu - 2.5, PV0 + 4],
            [cu + 2.5, PV0 - 1],
            [cu, BAR + 3],
          ].map(([u, v]) => at(u, v, FT)),
          'line',
          1.5,
        )
      if (hero) {
        // The chip came off the front edge beside the split: bare wood shows.
        s.poly(
          [
            barAt(B, cu + 1.45, 0, FT),
            barAt(B, cu + 7.5, 0, FT),
            barAt(B, cu + 5.2, 1.7, FT),
            barAt(B, cu + 2.6, 2.4, FT),
            barAt(B, cu + 1.9, 1.1, FT),
          ],
          'side',
          'line',
          undefined,
          0.6,
        )
        // The split runs on across the cork and tears the map up to the pin.
        const tear: Pt[] = [
          [cu, BAR],
          [cu + 0.5, BAR + 2.4],
          [cu - 0.3, BAR + 4.6],
          [cu + 0.4, PV0],
        ]
        s.line(
          tear.map(([u, v]) => at(u, v, CK + 0.03)),
          'line',
          0.6,
        )
        const pv = mapV(lastPin[1])
        const rip: Pt[] = [
          [cu + 0.4, PV0],
          [cu - 0.4, PV0 + 3],
          [cu + 0.5, PV0 + 6],
          [cu - 0.3, PV0 + 9],
          [cu + 0.2, pv - 1.6],
        ]
        s.line(
          rip.map(([u, v]) => paperAt(u, v, 0.05)),
          'line',
          0.6,
        )
      }
    }
    // The chip on the table in front of the tray, and a splinter beside it.
    const chips = () => {
      if (!cracked) return
      if (!hero) return standBlock(s, [cu + 2, cu + 9], [TY1 + 3, TY1 + 7], [0, 1.6])
      for (const [cx, cy, sz] of [
        [cu - 1, TY1 + 4.5, 1],
        [cu + 7, TY1 + 3, 0.55],
      ] as const)
        convex(
          s,
          [
            wp(cx, cy, 0),
            wp(cx + 6.4 * sz, cy + 0.9 * sz, 0),
            wp(cx + 2.2 * sz, cy + 3.8 * sz, 0),
            wp(cx + 0.9 * sz, cy + 0.8 * sz, 1.6 * sz),
            wp(cx + 5 * sz, cy + 1.2 * sz, 1.3 * sz),
            wp(cx + 2.3 * sz, cy + 2.6 * sz, 1.8 * sz),
          ],
          [
            [0, 1, 2],
            [3, 4, 5],
            [0, 1, 4, 3],
            [1, 2, 5, 4],
            [2, 0, 3, 5],
          ],
          { width: 0.8 },
        )
    }

    // The tray's lip, in front of the board's foot, with screws over the legs.
    standBlock(s, [-4, W + 4], [TY1 - LIP, TY1], [TZ, TZ + 2.6])
    if (hero)
      for (const [a] of legs) {
        const c = wp(a[0], TY1 + 0.01, TZ + 1.3)
        s.poly(s.circle(c, X, [0, 0, 1], 0, 0, 0.42, 8), 'line', 'none')
      }
    chips()

    // ------------------------------------------------------------ pins

    type Pin = {
      u: number
      v: number
      tilt: Pt
      axis: P3
      newest: boolean
      tack: boolean
      depth: number
    }
    const pins: Pin[] = []
    for (let i = 0; i < pinCount; i++) {
      const r = REGIONS[i],
        newest = i === pinCount - 1
      const u = mapU(r.pin[0]),
        v = mapV(r.pin[1])
      const [tu, tv] = newest ? [0, 0] : r.tilt
      const axis = unit(comb(N, [tu, U], [tv, V]))
      pins.push({
        u,
        v,
        tilt: [tu, tv],
        axis,
        newest,
        tack: false,
        depth: dot(paperAt(u, v), [1, 1, 1]),
      })
    }
    if (hero)
      for (const u of [PU0 + 3.4, PU1 - 3.4]) {
        const v = PV1 - 3.4
        pins.push({
          u,
          v,
          tilt: [0, 0],
          axis: N,
          newest: false,
          tack: true,
          depth: dot(paperAt(u, v), [1, 1, 1]),
        })
      }
    pins.sort((a, b) => a.depth - b.depth)

    /** Map pin, along its axis from the paper: needle, ferrule collar, neck, dome head. Pushed home, the needle is all in. */
    const NEEDLE = 1.5,
      HEAD = 3.6
    const pinLen = (p: Pin) => (cracked && p.newest ? 0 : NEEDLE)

    if (hero) {
      // Shadows first, all on the paper.
      for (const p of pins) {
        const h = p.tack ? 0.7 : pinLen(p) + 0.5 + 0.9 + 1.5,
          r = p.tack ? 1.7 : HEAD * 0.9
        const hu = p.u + dot(p.axis, U) * h,
          hv = p.v + dot(p.axis, V) * h
        const tip = s.circle(paperAt(p.u, p.v, 0.03), U, V, 0, 0, 0.4, 8)
        const blob = s.circle(paperAt(hu + SHU * h, hv + SHV * h, 0.03), U, V, 0, 0, r, 16)
        s.poly2(hull(s.pp([...tip, ...blob])), 'shadow', 'none')
      }
      for (const p of pins) {
        const b = paperAt(p.u, p.v)
        if (p.tack) {
          // Drawing-pin: a flat brass head with a small boss.
          disc(s, add(b, mul(N, 0.3)), N, 1.7, 0.4, { ring: 24, width: 0.7 })
          disc(s, add(b, mul(N, 0.75)), N, 0.6, 0.5, { ring: 16, width: 0.6 })
          continue
        }
        const draw = () => {
          const nl = pinLen(p)
          if (cracked && p.newest) {
            // Pressed so hard the paper dished round it.
            for (const r of [1.6, 2.4])
              s.poly(
                s.circle(paperAt(p.u, p.v, 0.04), U, V, 0, 0, r, 20),
                'none',
                'crease',
                undefined,
                0.45,
              )
          }
          if (nl > 0) tube(s, b, add(b, mul(p.axis, nl)), 0.28, { width: 0.6 })
          const c0 = add(b, mul(p.axis, nl))
          disc(s, add(c0, mul(p.axis, 0.25)), p.axis, 0.95, 0.5, { ring: 20, width: 0.7 })
          const F = frameAlong(add(c0, mul(p.axis, 0.5)), p.axis)
          const ramp = p.newest ? ACCENT : GREY,
            crease: Paint = p.newest ? 'accent-side' : 'crease'
          const neck = spline([
            [0, 0.5],
            [0.5, 0.56],
            [0.9, 1.05],
          ])
          lathe(s, F, (t) => ({ r: neck(t)[0] }), 0, 0.9, {
            steps: 4,
            ring: 24,
            shade: true,
            ramp,
            crease,
            width: 0.7,
          })
          const H0 = 0.9,
            HL = 3
          const head = (t: number) => {
            const x = (t - H0) / HL
            return { r: HEAD * Math.sqrt(Math.max(0, 1 - x * x)) * (0.92 + 0.08 * (1 - x)) }
          }
          if (p.newest) {
            const ring: P3[] = []
            for (let i = 0; i <= 6; i++)
              for (let j = 0; j < 12; j++) {
                const t = H0 + (HL * i) / 6,
                  a = (j / 12) * 2 * Math.PI
                ring.push(
                  comb(
                    F.o,
                    [t, F.a],
                    [head(t).r * Math.cos(a), F.u],
                    [head(t).r * Math.sin(a), F.v],
                  ),
                )
              }
            const outline = hull(s.pp(ring))
            s.glow(1.6, () => s.poly2(outline, 'accent', 'none'))
          }
          // The dome stops short of the pole in a small flat crown (a zero section has no normal to shade).
          const body = lathe(s, F, head, H0, H0 + HL * 0.92, {
            steps: 12,
            ring: 32,
            shade: true,
            ramp,
            crease: 'none',
            width: 0.8,
          })
          // A moulding line round the dome's rim.
          body.seam(H0 + 0.35, crease, 0.45)
        }
        if (p.newest) s.group('lit', draw)
        else draw()
      }
    } else {
      // Thumb: needle and a bold head, so each pin counts; the newest stands taller and wider.
      for (const p of pins) {
        const rad = p.newest ? 9.5 : 6.5,
          len = cracked && p.newest ? 5 : p.newest ? 11 : 8,
          hh = p.newest ? 4 : 3
        const b = paperAt(p.u, p.v)
        const ax = unit(comb(N, [p.tilt[0], U], [p.tilt[1], V]))
        const back = add(b, mul(ax, len - hh)),
          face = add(b, mul(ax, len))
        const draw = () => {
          s.line([b, back], 'line', 1.5)
          const r0 = s.circle(back, U, V, 0, 0, rad, 16),
            r1 = s.circle(face, U, V, 0, 0, rad, 16)
          const outline = hull([...s.pp(r0), ...s.pp(r1)])
          if (p.newest) {
            s.poly2(outline, 'accent-side', 'accent')
            s.poly(r1, 'accent', 'accent')
          } else {
            s.poly2(outline, 'line', 'line')
            s.poly(r1, 'line', 'line')
          }
        }
        if (p.newest) s.group('lit', draw)
        else draw()
      }
    }

    return s.done()
  },
}
