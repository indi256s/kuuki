import {
  hull,
  roundRect,
  Scene,
  visibleRun,
  type P3,
  type Paint,
  type Pt,
} from '../../../overview/iso/scene'
import { X, shadowRect } from '../../../overview/iso/solids'
import {
  comb,
  cross,
  facing,
  frameAlong,
  lathe,
  spline,
  toneOf,
  tube,
  sub,
  type Body,
} from './parts'
import type { LadderFigureDef } from './types'

// Countries: a passport page and a hinged ink-pad tin on a desk, with a rubber stamp standing on the pad.
// The page fills with impressions rung by rung; at the top rung they overflow onto the inside of the open lid.

type Kind = 'round' | 'oval' | 'notch' | 'tri'
type Mark = { u: number; v: number; kind: Kind; deg: number; size: number }
type At = (u: number, v: number) => P3

/** Passport half: cover board, page block, top (visa) page; x 0..SW, y SY0..SY0 + sd. */
const SW = 92,
  SD = 100,
  SY0 = 40,
  CV = 1,
  PZ = 3.6,
  /** The top page's near-left corner curls up: lift reaches CURL at the corner and fades out CL along the diagonal. */
  CL = 30,
  CURL = 6.5
/** The tin: x PX..PX + PW, y 0..PD, TIN tall; the felt sits FELT_D under the rim. */
const PX = 102,
  PW = 54,
  PD = 44,
  TIN = 7,
  BEAD = 1.2,
  RIM = 2.4,
  FELT_Z = TIN - 1.8
/** The lid: hinged on a barrel behind the tin's back wall, opened past upright. */
const HY = -2,
  HZ = TIN - 0.2,
  OPEN = (108 * Math.PI) / 180,
  V0 = 3,
  LW = PW + 1.2,
  LD = PD + 1,
  LH = 3.4
/** The stamp stands on the pad at (STX, STY). */
const STX = PX + PW - 17,
  STY = PD / 2 + 1,
  BLOCK = 21

/** Impressions per rung, in the order they were stamped: 15 on the page, then 2 on the lid. The thumb page holds 9, so its steps are 1, 3, 5, 7, then all 9 and the lid. */
const COUNTS = [1, 3, 6, 10, 17]
const THUMB_COUNTS = [1, 3, 5, 7, 11]
const THUMB_SCALE = 1.2
const CELLS: [number, number][] = [
  [1, 2],
  [0, 4],
  [2, 2],
  [0, 1],
  [2, 4],
  [1, 0],
  [1, 4],
  [0, 3],
  [2, 1],
  [1, 1],
  [1, 3],
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 3],
]
const KINDS: Kind[] = [
  'round',
  'notch',
  'oval',
  'tri',
  'notch',
  'round',
  'oval',
  'tri',
  'round',
  'notch',
  'oval',
  'round',
  'tri',
  'notch',
  'oval',
]

/** Fixed pseudo-random in [0, 1). */
const hash = (n: number) => ((((n + 1) * 2654435761) >>> 0) % 1000) / 1000

const SHEET_MARKS: Mark[] = CELLS.map(([c, r], i) => ({
  u: 17 + c * 29 + (((i * 13) % 7) - 3) * 1.1,
  v: 12 + r * 19 + (((i * 5) % 5) - 2) * 0.9,
  kind: KINDS[i],
  deg: ((i * 47) % 29) - 14,
  size: (KINDS[i] === 'tri' ? 0.84 : 0.86) + (KINDS[i] === 'tri' ? 0.08 : 0.2) * hash(i * 7 + 3),
}))
/** Lid marks in lid-floor coordinates: u along the hinge, v down from the lid's top edge. */
const LID_MARKS: Mark[] = [
  { u: 24, v: 16, kind: 'notch', deg: 7, size: 0.88 },
  { u: 37, v: 31, kind: 'round', deg: -11, size: 0.95 },
]
/** The 56px slot: nine bigger cells on a shorter page, so each impression stays a readable ring. */
const THUMB_MARKS: Mark[] = CELLS.map(([c, r], i): [number, number, number] => [c, r, i])
  .filter(([, r]) => r < 3)
  .map(([c, r, i]) => ({
    u: 17 + c * 29,
    v: 15 + r * 28,
    kind: KINDS[i],
    deg: ((i * 47) % 29) - 14,
    size: 1,
  }))

// ---------------------------------------------------------------- plan geometry

/** Subdivides a closed loop so no edge is longer than `step`. */
function densify(loop: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = []
  loop.forEach(([x0, y0], i) => {
    const [x1, y1] = loop[(i + 1) % loop.length]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
  })
  return out
}

/** Keeps the part of a polygon where f(p) ≥ 0, for a linear f (one Sutherland–Hodgman pass). */
function cutBy(poly: readonly Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const a = f(p),
      b = f(q)
    if (a >= 0) out.push(p)
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  })
  return out
}

/** Clips a polygon to a convex one (Sutherland–Hodgman) in screen space. */
function clipTo(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let area = 0
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i],
      q = clip[(i + 1) % clip.length]
    area += p[0] * q[1] - q[0] * p[1]
  }
  const sg = Math.sign(area)
  let out: Pt[] = [...subject]
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length]
    out = cutBy(out, (p) => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])))
  }
  return out
}

/** Unit normals of a closed loop, from each point's neighbours. */
function normalsOf(loop: readonly Pt[]): Pt[] {
  const n = loop.length
  return loop.map((_, i) => {
    const [x0, y0] = loop[(i + n - 1) % n],
      [x1, y1] = loop[(i + 1) % n]
    const l = Math.hypot(x1 - x0, y1 - y0) || 1
    return [(y1 - y0) / l, -(x1 - x0) / l]
  })
}

// ---------------------------------------------------------------- stamp shapes (local units, v grows towards the stamp's foot)

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
const ellipse = (rx: number, ry: number, n: number): Pt[] =>
  arc(0, 0, 1, 0, 2 * Math.PI, n)
    .slice(0, n)
    .map(([a, b]) => [a * rx, b * ry])
/** A rectangle with its four corners bitten out as quarter circles. */
function notched(hw: number, hh: number, nr: number): Pt[] {
  const P = Math.PI
  return [
    ...arc(hw, -hh, nr, P, P / 2, 5),
    ...arc(hw, hh, nr, -P / 2, -P, 5),
    ...arc(-hw, hh, nr, 0, -P / 2, 5),
    ...arc(-hw, -hh, nr, P / 2, 0, 5),
  ]
}
/** An upright triangle (apex at −v) with rounded corners: circumradius `R`, corner radius `rr`. */
function triangle(R: number, rr: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3
    const c: Pt = [(R - 2 * rr) * Math.cos(a), (R - 2 * rr) * Math.sin(a)]
    out.push(...arc(c[0], c[1], rr, a - Math.PI / 3, a + Math.PI / 3, 6))
  }
  return out
}

type Shape = {
  /** Outer and inner rims of the double ring, dense. */
  rims: [Pt[], Pt[]]
  /** Dashes inside: date rows, an arrow, the rim lettering as broken arcs. Hero only. */
  dashes: Pt[][]
}
function shapeOf(kind: Kind): Shape {
  const seg = (u0: number, u1: number, v: number): Pt[] => [
    [u0, v],
    [u1, v],
  ]
  if (kind === 'round') {
    const ring: Pt[][] = []
    for (let i = 0; i < 14; i++) {
      if (i === 3 || i === 10) continue
      const a = (i / 14) * 2 * Math.PI
      ring.push(arc(0, 0, 8.7, a, a + 0.24, 2))
    }
    return {
      rims: [densify(ellipse(10, 10, 40), 1), densify(ellipse(7.4, 7.4, 32), 1)],
      dashes: [
        seg(-4.4, 4.4, -2.6),
        seg(-4.6, -2.2, 0.8),
        seg(-1.2, 1.2, 0.8),
        seg(2.2, 4.6, 0.8),
        seg(-2.4, 2.4, 3.6),
        ...ring,
      ],
    }
  }
  if (kind === 'oval')
    return {
      rims: [densify(ellipse(13, 8.4, 44), 1), densify(ellipse(10.4, 5.9, 36), 1)],
      dashes: [
        seg(-6.6, -1, -1.7),
        seg(0.6, 6.6, -1.7),
        seg(-4.6, 4.6, 1.9),
        seg(10.9, 12.5, 0),
        seg(-12.5, -10.9, 0),
      ],
    }
  if (kind === 'notch')
    return {
      rims: [densify(notched(12.5, 8, 2.8), 1), densify(roundRect(-10, -5.6, 20, 11.2, 0.6), 1)],
      dashes: [
        seg(-7, 5.4, -1.6),
        [
          [3.4, -3.3],
          [5.6, -1.6],
          [3.4, 0.1],
        ],
        seg(-7, -3.6, 2.4),
        seg(-2.6, 0.9, 2.4),
        seg(1.9, 7, 2.4),
      ],
    }
  return {
    rims: [densify(triangle(13, 2.2), 1), densify(triangle(9.2, 1.2), 1)],
    dashes: [
      seg(-4.2, -0.8, 2.2),
      seg(0.8, 4.2, 2.2),
      ellipse(0.9, 0.9, 10)
        .concat([[0.9, 0]])
        .map(([a, b]) => [a, b - 2.4] as Pt),
    ],
  }
}
const SHAPES: Record<Kind, Shape> = {
  round: shapeOf('round'),
  oval: shapeOf('oval'),
  notch: shapeOf('notch'),
  tri: shapeOf('tri'),
}

/**
 * Uneven ink along a closed rim: the rim as a filled band of varying width, cut into pieces, each piece its own opacity, with a skipped piece or two where the rubber missed.
 * `press` gives the ink at a local point (one side of each stamp is pressed harder).
 */
function inkBands(loop: readonly Pt[], w: number, seed: number, press: (p: Pt) => number) {
  const n = loop.length,
    nrm = normalsOf(loop),
    pieces = Math.max(8, Math.round(n / 4)),
    out: { pts: Pt[]; op: number }[] = []
  const width = (i: number) => w * (0.78 + 0.32 * Math.sin(i * 0.41 + seed * 1.7))
  const edge = (i: number, side: number): Pt => {
    const j = i % n,
      h = (width(j) / 2) * side
    return [loop[j][0] + nrm[j][0] * h, loop[j][1] + nrm[j][1] * h]
  }
  for (let p = 0; p < pieces; p++) {
    if (hash(seed * 31 + p * 7) < 0.09) continue
    const i0 = Math.floor((p * n) / pieces),
      i1 = Math.floor(((p + 1) * n) / pieces)
    const idx = Array.from({ length: i1 - i0 + 1 }, (_, k) => i0 + k)
    const mid = loop[Math.floor((i0 + i1) / 2) % n]
    out.push({
      pts: [...idx.map((i) => edge(i, 1)), ...[...idx].reverse().map((i) => edge(i, -1))],
      op: Math.round(press(mid) * (0.82 + 0.18 * hash(seed * 17 + p)) * 100) / 100,
    })
  }
  return out
}

// ---------------------------------------------------------------- figure

export const countries: LadderFigureDef = {
  id: 'countries',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const sheetMarks = hero ? SHEET_MARKS : THUMB_MARKS,
      marks = [...sheetMarks, ...LID_MARKS],
      sd = hero ? SD : 86,
      sc = hero ? 1 : THUMB_SCALE
    const count = rung === 5 ? marks.length : (hero ? COUNTS : THUMB_COUNTS)[rung - 1],
      fresh = count - 1
    const n = hero ? 32 : 16
    const Y1 = SY0 + sd

    /** A plane frame: O + u·U + v·V + w·N, with N = U × V. */
    type Plane = { o: P3; U: P3; V: P3; N: P3 }
    const on =
      (F: Plane) =>
      ([u, v]: Pt, w = 0): P3 =>
        comb(F.o, [u, F.U], [v, F.V], [w, F.N])
    const dot3 = (x: number, y: number, z: number, r: number, paint: Paint = 'line') =>
      s.poly(s.circle([x, y, z], X, [0, 1, 0], 0, 0, r, 8), paint, 'none')

    /** A slab of a convex plan (counter-clockwise in U, V) on a plane, from w0 to w1: walls toned by the light, the cap at w1, one silhouette. */
    const slab = (
      F: Plane,
      plan: readonly Pt[],
      w0: number,
      w1: number,
      cap: Paint | null = null,
    ) => {
      const at = on(F),
        lo = plan.map((p) => at(p, w0)),
        hi = plan.map((p) => at(p, w1)),
        lo2 = s.pp(lo),
        hi2 = s.pp(hi),
        m = plan.length,
        nuv = cross(F.U, F.V)
      const outline = hull([...lo2, ...hi2])
      s.poly2(outline, 'side', 'none')
      const tone = plan.map((_, i) => {
        const out = cross(sub(hi[(i + 1) % m], hi[i]), nuv)
        return facing(out) ? toneOf(out) : null
      })
      for (let i = 0; i < m; i++) {
        if (!tone[i] || tone[(i + m - 1) % m] === tone[i]) continue
        const run = [i]
        while (run.length < m && tone[(run[run.length - 1] + 1) % m] === tone[i])
          run.push((run[run.length - 1] + 1) % m)
        const ids = [...run, (run[run.length - 1] + 1) % m]
        s.poly2(
          [...ids.map((j) => hi2[j]), ...[...ids].reverse().map((j) => lo2[j])],
          tone[i]!,
          'none',
        )
      }
      const up = w1 > w0 ? F.N : (F.N.map((c) => -c) as unknown as P3)
      if (facing(up)) s.poly2(hi2, cap ?? toneOf(up), 'crease', hero ? 0.6 : undefined)
      s.poly2(outline, 'none', 'line')
    }
    /** A recess in a plane's surface at w = wTop down to wFloor: far inner walls toned by the light, the floor it shows, the opening's edge. Returns the opening. */
    const well = (F: Plane, plan: readonly Pt[], wTop: number, wFloor: number, floor: Paint) => {
      const at = on(F),
        top = plan.map((p) => at(p, wTop)),
        open = s.pp(top),
        low = s.pp(plan.map((p) => at(p, wFloor))),
        m = plan.length,
        nuv = cross(F.U, F.V)
      s.poly2(open, 'side', 'none')
      const tone = plan.map((_, i) => {
        const inward = cross(nuv, sub(top[(i + 1) % m], top[i]))
        return facing(inward) ? toneOf(inward) : null
      })
      for (let i = 0; i < m; i++) {
        if (!tone[i] || tone[(i + m - 1) % m] === tone[i]) continue
        const run = [i]
        while (run.length < m && tone[(run[run.length - 1] + 1) % m] === tone[i])
          run.push((run[run.length - 1] + 1) % m)
        const ids = [...run, (run[run.length - 1] + 1) % m]
        const strip = clipTo(
          [...ids.map((j) => open[j]), ...[...ids].reverse().map((j) => low[j])],
          open,
        )
        if (strip.length > 2) s.poly2(strip, tone[i]!, 'none')
      }
      const fl = clipTo(low, open)
      if (fl.length > 2) s.poly2(fl, floor, hero ? 'crease' : 'none', 0.5)
      s.poly2(open, 'none', 'crease', 0.8)
      return top
    }

    // ---- impressions -------------------------------------------------------------------------

    /** One impression on the plane `at`: a double ring of uneven ink and the dashes inside. The freshest is accent. */
    const print = (at: At, m: Mark, i: number, isFresh: boolean) => {
      const a = (m.deg * Math.PI) / 180,
        c = Math.cos(a),
        sn = Math.sin(a),
        z = m.size * sc
      const loc = ([u, v]: Pt): P3 => at(m.u + (u * c - v * sn) * z, m.v + (u * sn + v * c) * z)
      const shape = SHAPES[m.kind]
      if (!hero) {
        const rim = shape.rims[0].filter((_, j) => j % 3 === 0)
        s.poly(rim.map(loc), 'none', isFresh ? 'accent' : 'crease', undefined, isFresh ? 2.6 : 1.8)
        return
      }
      // The side pressed hardest, and how much the rest fades.
      const pa = hash(i * 13 + 5) * 2 * Math.PI,
        pd: Pt = [Math.cos(pa), Math.sin(pa)],
        floorInk = isFresh ? 0.72 : 0.3
      const press = ([u, v]: Pt) =>
        floorInk +
        (1 - floorInk) * Math.min(1, Math.max(0, 0.55 + (0.5 * (u * pd[0] + v * pd[1])) / 10))
      const fill: Paint = isFresh ? 'accent' : 'line'
      const bands = [
        ...inkBands(shape.rims[0], 1.25, i * 2 + 1, press),
        ...inkBands(shape.rims[1], 0.6, i * 2 + 2, press),
      ]
      const drawBands = () => {
        for (const b of bands) s.poly(b.pts.map(loc), fill, 'none', undefined, undefined, b.op)
      }
      if (isFresh) s.glow(2.5, drawBands)
      drawBands()
      s.segs(
        shape.dashes.map((d) => d.map(loc)),
        isFresh ? 'accent' : 'crease',
        isFresh ? 1 : 0.7,
      )
    }
    /** Draws marks from `from` to `to` (exclusive) on one surface; the freshest, if among them, sits in the lit group. */
    const stamp = (at: At, from: number, to: number) => {
      for (let i = from; i < Math.min(to, count); i++) {
        if (i === fresh) s.group('lit', () => print(at, marks[i], i, true))
        else print(at, marks[i], i, false)
      }
    }

    // ---- cast shadows ------------------------------------------------------------------------
    shadowRect(s, -1.4, SY0 - 1.4, SW + 2.8, sd + 2.8, 3)
    shadowRect(s, PX - 0.5, -0.5, PW + 1, PD + 1, 3)
    shadowRect(s, PX + 2, -15, PW - 4, 12, 2)

    // ---- the passport page --------------------------------------------------------------------
    // Cover board, the page block with its page edges, then the top page with its corner curling up.
    s.rbox(-1.4, SY0 - 1.4, 0, SW + 2.8, sd + 2.8, CV, 5.4, {
      top: 'side',
      wall: 'side',
      side: 'side',
    })
    s.rbox(0, SY0, CV, SW, sd, PZ - CV, 4, { top: 'top', wall: 'top', side: 'front' })
    if (hero)
      for (const z of [1.7, 2.3, 2.9])
        s.line(
          visibleRun(roundRect(0, SY0, SW, sd, 4)).map(([a, b]): P3 => [a, b, z]),
          'detail',
          0.4,
        )

    /** How far into the curl a plan point is: 0 outside, 1 at the corner. */
    const curlT = (x: number, y: number) => Math.max(0, 1 - (x + (Y1 - y)) / CL)
    const lift = (x: number, y: number) => CURL * curlT(x, y) ** 2
    const sheetAt: At = (u, v) => [u, SY0 + v, PZ + lift(u, SY0 + v)]
    const onPage = (p: Pt): P3 => sheetAt(p[0], p[1] - SY0)
    const pagePlan = densify(roundRect(0, SY0, SW, sd, 4), hero ? 2 : 4)
    // The lower page shows under the curl, shaded where the top page lifts off it.
    s.poly(
      cutBy(pagePlan, ([x, y]) => curlT(x, y) - 0.12).map(([x, y]): P3 => [x, y, PZ]),
      'shadow',
      'none',
    )
    s.poly(pagePlan.map(onPage), 'top', 'line', undefined, hero ? 1 : 1.2)
    if (hero)
      for (let L = 0.1; L < 0.95; L += 0.1) {
        const region = cutBy(pagePlan, ([x, y]) => curlT(x, y) - L)
        if (region.length > 2)
          s.poly(densify(region, 2).map(onPage), 'front', 'none', undefined, undefined, 0.2)
      }

    // Security print: a ruled border, a braided guilloche band inside it, a rosette under the stamps, the perforated number, the gutter stitching.
    const border = (inset: number, r: number) =>
      densify(roundRect(inset, SY0 + inset, SW - 2 * inset, sd - 2 * inset, r), 1.5)
    s.poly(border(3.2, 2.4).map(onPage), 'none', 'detail', undefined, hero ? 0.6 : 0.9)
    if (hero) {
      s.poly(border(7, 1.6).map(onPage), 'none', 'detail', undefined, 0.5)
      const path = densify(roundRect(5.1, SY0 + 5.1, SW - 10.2, sd - 10.2, 2), 0.8),
        nrm = normalsOf(path)
      const lens = path.map((p, i) =>
        Math.hypot(path[(i + 1) % path.length][0] - p[0], path[(i + 1) % path.length][1] - p[1]),
      )
      const perim = lens.reduce((a, b) => a + b, 0),
        waves = Math.round(perim / 6.5)
      for (const phase of [0, Math.PI]) {
        let arcLen = 0
        const pts = path.map((p, i): P3 => {
          const off = 1.15 * Math.sin((2 * Math.PI * waves * arcLen) / perim + phase)
          arcLen += lens[i]
          return onPage([p[0] + nrm[i][0] * off, p[1] + nrm[i][1] * off])
        })
        s.line([...pts, pts[0]], 'detail', 0.45)
      }
      for (let x = 34; x <= 60; x += 2.4) {
        const [px, py, pz] = sheetAt(x, 1.6)
        dot3(px, py, pz, 0.32)
      }
      const stitches: P3[][] = []
      for (let y = 6; y + 2 <= sd - 6; y += 4) stitches.push([sheetAt(1.6, y), sheetAt(1.6, y + 2)])
      s.segs(stitches, 'crease', 0.7)
    }
    stamp(sheetAt, 0, Math.min(fresh, sheetMarks.length))
    if (fresh < sheetMarks.length) stamp(sheetAt, fresh, fresh + 1)

    // ---- the lid, open past upright on its hinge ---------------------------------------------
    const d: P3 = [0, Math.cos(OPEN), Math.sin(OPEN)],
      nIn: P3 = [0, Math.sin(OPEN), -Math.cos(OPEN)]
    // w grows out of the lid's inside, towards the viewer.
    const IN: Plane = { o: [PX - 0.6, HY, HZ], U: X, V: d, N: nIn }
    // Hinge leaf on the lid's back, showing between the barrel and the lid.
    slab(IN, roundRect(8, -0.4, LW - 16, V0 + 2.4, 0.6), -0.9, -0.6)
    if (hero)
      for (const u of [12, LW - 12]) {
        const p = on(IN)([u, 1.8], -0.6)
        s.poly(s.circle(p, X, d, 0, 0, 0.42, 8), 'line', 'none')
      }
    // The barrel: three knuckles on a pin.
    const barrel: Body = tube(s, [PX + 5, HY, HZ], [PX + PW - 5, HY, HZ], 2, {
      steps: 1,
      ring: hero ? 20 : 12,
      shade: hero,
    })
    if (hero) {
      const L = PW - 10
      barrel.seam(L / 3)
      barrel.seam((2 * L) / 3)
      const [ex, ey, ez] = [PX + PW - 5, HY, HZ]
      s.poly(s.circle([ex, ey, ez], [0, 1, 0], [0, 0, 1], 0, 0, 0.5, 8), 'line', 'none')
    }
    // The lid itself: a shallow inverted tray, its rolled rim and the inside panel.
    const lidPlan = roundRect(0, V0, LW, LD, 5)
    slab(IN, lidPlan, -0.6, LH, 'top')
    const lidOpen = well(
      IN,
      roundRect(RIM, V0 + RIM, LW - 2 * RIM, LD - 2 * RIM, 3.4),
      LH,
      0,
      toneOf(nIn),
    )
    if (hero) {
      s.poly(
        roundRect(1.1, V0 + 1.1, LW - 2.2, LD - 2.2, 4.2).map((p) => on(IN)(p, LH)),
        'none',
        'crease',
        undefined,
        0.5,
      )
      s.poly(
        roundRect(7, V0 + 7, LW - 14, LD - 14, 2.4).map((p) => on(IN)(p, 0)),
        'none',
        'crease',
        undefined,
        0.5,
      )
    }
    // Impressions that missed the page: lid-floor coordinates, v measured down from the lid's top edge.
    const lidAt: At = (u, v) => on(IN)([u, V0 + LD - v], 0)
    s.group('lid-ink', () => stamp(lidAt, sheetMarks.length, fresh + 1), { clip: lidOpen })

    // ---- the tin: foot, pressed body, rolled bead, the felt pad sunk inside -----------------------
    s.rbox(PX + 1, 1, 0, PW - 2, PD - 2, 0.8, 4, { top: 'side', wall: 'side', side: 'side' })
    s.rbox(PX, 0, 0.8, PW, PD, TIN - BEAD - 0.8, 4.5, { top: 'front' })
    if (hero) {
      s.line(
        visibleRun(roundRect(PX, 0, PW, PD, 4.5)).map(([a, b]): P3 => [a, b, 2.6]),
        'crease',
        0.6,
      )
      // Pressed panels on the two walls that face the viewer.
      s.poly(
        [
          [PX + 9, PD, 3.4],
          [PX + PW - 9, PD, 3.4],
          [PX + PW - 9, PD, TIN - BEAD - 1],
          [PX + 9, PD, TIN - BEAD - 1],
        ],
        'none',
        'crease',
        undefined,
        0.5,
      )
      s.poly(
        [
          [PX + PW, 8, 3.4],
          [PX + PW, PD - 8, 3.4],
          [PX + PW, PD - 8, TIN - BEAD - 1],
          [PX + PW, 8, TIN - BEAD - 1],
        ],
        'none',
        'crease',
        undefined,
        0.5,
      )
    }
    s.rbox(PX - 0.5, -0.5, TIN - BEAD, PW + 1, PD + 1, BEAD, 5, { top: 'top' })
    const BASE: Plane = { o: [0, 0, 0], U: X, V: [0, 1, 0], N: [0, 0, 1] }
    if (hero)
      s.poly(
        roundRect(PX + 1, 0.5, PW - 2, PD - 1, 4.4).map(([a, b]): P3 => [a, b, TIN]),
        'none',
        'crease',
        undefined,
        0.5,
      )
    const padPlan = roundRect(PX + RIM, RIM, PW - 2 * RIM, PD - 2 * RIM, 3.4)
    const padOpen = well(BASE, padPlan, TIN, FELT_Z, 'side')
    if (hero) {
      // The felt: a stitched edge, the inked middle, the ghost of an earlier press.
      s.line(
        [
          ...densify(
            roundRect(PX + RIM + 1.4, RIM + 1.4, PW - 2 * RIM - 2.8, PD - 2 * RIM - 2.8, 2.4),
            2,
          ),
        ]
          .concat([[PX + RIM + 1.4 + 2.4, RIM + 1.4]])
          .map(([a, b]): P3 => [a, b, FELT_Z]),
        'detail',
        0.6,
        '1.2 1.4',
      )
      s.poly(
        roundRect(PX + 7, 6, PW - 14, PD - 12, 4).map(([a, b]): P3 => [a, b, FELT_Z]),
        'shade',
        'none',
        undefined,
        undefined,
        0.7,
      )
      s.poly(
        roundRect(PX + 9, PD / 2 - 9, 18, 18, 2).map(([a, b]): P3 => [a, b, FELT_Z]),
        'none',
        'detail',
        undefined,
        0.6,
      )
    }

    // ---- the rubber stamp, standing on the pad ----------------------------------------------------
    s.group(
      'in-well',
      () => {
        const x0 = STX - BLOCK / 2,
          y0 = STY - BLOCK / 2
        s.poly(
          roundRect(x0 + 1.5, y0 + 1.5, BLOCK, BLOCK, 2.5).map(([a, b]): P3 => [a, b, FELT_Z]),
          'shade',
          'none',
          undefined,
          undefined,
          0.8,
        )
        // Rubber die, foam cushion, the wooden mount with a routed top edge.
        s.rbox(x0 + 1.2, y0 + 1.2, FELT_Z, BLOCK - 2.4, BLOCK - 2.4, 1.2, 1.6, {
          top: 'side',
          wall: 'side',
          side: 'side',
        })
        s.rbox(x0 + 0.8, y0 + 0.8, FELT_Z + 1.2, BLOCK - 1.6, BLOCK - 1.6, 0.8, 2, {
          top: 'front',
          wall: 'front',
          side: 'side',
        })
        const zb = FELT_Z + 2,
          zt = zb + 4.2
        s.rbox(x0, y0, zb, BLOCK, BLOCK, 4.2, 2.6, { top: 'front' })
        s.rbox(x0 + 0.9, y0 + 0.9, zt, BLOCK - 1.8, BLOCK - 1.8, 0.7, 1.8, {
          top: 'top',
          wall: 'top',
          side: 'front',
        })
        const zl = zt + 0.7
        if (hero) {
          // The index label: a paper slip printed with the stamp's own design.
          s.poly(
            roundRect(x0 + 3, y0 + 3, BLOCK - 6, BLOCK - 6, 0.8).map(([a, b]): P3 => [a, b, zl]),
            'top',
            'crease',
            undefined,
            0.5,
          )
          for (const r of [5.2, 3.8])
            s.poly(
              s.circle([STX, STY, zl], X, [0, 1, 0], 0, 0, r, 24),
              'none',
              'detail',
              undefined,
              0.6,
            )
          for (const [dx, dy] of [
            [-7.6, -7.6],
            [7.6, -7.6],
            [-7.6, 7.6],
            [7.6, 7.6],
          ])
            dot3(STX + dx, STY + dy, zl, 0.45)
        }
        // Ferrule: a flanged brass sleeve on the mount, holding the turned handle.
        const Z: P3 = [0, 0, 1]
        lathe(s, frameAlong([STX, STY, zl], Z), () => ({ r: 5 }), 0, 0.8, {
          steps: 1,
          ring: n,
          shade: hero,
        })
        const sleeve = lathe(s, frameAlong([STX, STY, zl + 0.8], Z), () => ({ r: 4.2 }), 0, 2.8, {
          steps: 1,
          ring: n,
          shade: hero,
        })
        if (hero) {
          sleeve.seam(0.9)
          sleeve.seam(2.0)
        }
        const prof = spline([
          [0, 3.3],
          [1, 3.1],
          [2.2, 4],
          [3.4, 3.1],
          [7, 2.6],
          [10, 3.2],
          [13, 5.6],
          [15.2, 6.6],
          [16.8, 6.6],
          [18.2, 5.6],
          [19, 3.6],
          [19.4, 0],
        ])
        const handle = lathe(
          s,
          frameAlong([STX, STY, zl + 3.6], Z),
          (t) => ({ r: prof(t)[0] }),
          0,
          19.4,
          {
            steps: hero ? 30 : 8,
            ring: n,
            shade: hero,
          },
        )
        if (hero) {
          handle.seam(1)
          handle.seam(3.4)
        }
      },
      { clip: [...padOpen, ...padOpen.map(([a, b, c]): P3 => [a, b, c + 400])] },
    )
    return s.done()
  },
}
