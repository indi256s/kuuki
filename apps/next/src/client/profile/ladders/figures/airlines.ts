import { Scene, roundRect, type P3, type Paint } from '../../../overview/iso/scene'
import {
  add,
  beam,
  circleOn,
  disc,
  foil,
  frameAlong,
  lathe,
  mix,
  mul,
  screw,
  spline,
  sub,
  tube,
  unit,
  type Foil,
  type FoilStation,
  type Section,
} from './parts'
import type { LadderFigureDef } from './types'

/**
 * Airlines: the patchwork tail fin. An airliner's tail section stands in the paint hangar on two cradle trestles: the aft fuselage barrel
 * tapering to the APU exhaust, stabiliser stubs, the swept fin with its dorsal fillet, root fairing, rudder, wicks and tip light.
 * Rung 1 paints one livery band across a row of skin panels; rung 2 repaints over it (primer, a new band with the masking tape still on and
 * runs down the tape); rung 3 is a quilt of mismatched panels, the newest one still taped off, with a ladder against the rudder, an open
 * tin, its lid, a roller and a roll of tape left on the floor (nobody in sight).
 * Lit: the newest livery panel(s).
 * Frame: the fuselage axis runs along +x towards the tail (right-down on screen); the viewer sees the +y flank, the top and the tail cone.
 */

const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]
const D2R = Math.PI / 180

// ---------------------------------------------------------------- the aft fuselage

/** Cut end (the splice to the rest of the barrel), start of the taper, the tail cone, barrel radius and height, cone radius. */
const H = { cut: -14, taper: 8, tail: 136, R: 16, aspect: 1.04, Zc: 38, tailR: 3.8, upsweep: 0.86 }

/** A constant barrel, then a cone whose centre rises as it narrows, so the crown runs nearly flat and the belly sweeps up to the APU. */
function sec(x: number): Section {
  const u = Math.min(1, Math.max(0, (x - H.taper) / (H.tail - H.taper)))
  const r = H.R - (H.R - H.tailR) * Math.pow(u, 1.7)
  return { r, rz: r * H.aspect, lift: H.Zc + H.upsweep * (H.R - r) * H.aspect }
}
const geo = (x: number) => {
  const q = sec(x)
  return { r: q.r, rz: q.rz ?? q.r, lift: q.lift ?? 0 }
}
/** Crown height at x, at half-width y. */
const crownZ = (x: number, y = 0) => {
  const { r, rz, lift } = geo(x)
  return lift + rz * Math.sqrt(Math.max(0, 1 - (y / r) ** 2))
}
/** Half-width of the section at x, at height z. */
const skinY = (x: number, z: number) => {
  const { r, rz, lift } = geo(x)
  const q = (z - lift) / rz
  return Math.abs(q) >= 1 ? 0 : r * Math.sqrt(1 - q * q)
}

// ---------------------------------------------------------------- the fin

/** Root leading edge, root chord, height above the crown, LE sweep (deg), tip chord, root and tip thickness. */
const FIN = { le: 44, chord: 62, h: 72, sweep: 40, tip: 26, t: 4.2, tt: 2.2 }
const finRootZ = (x: number) => crownZ(x, FIN.t / 2) - 0.3
const FIN_TOP = crownZ(FIN.le) + FIN.h
const FIN_TIP_LE = FIN.le + Math.tan(FIN.sweep * D2R) * FIN.h

/** Skin panel grid on the fin, in chord fraction f (0 = LE) and span fraction v (0 = root). The rudder hinge is f = 0.7. */
const FC = [0, 0.14, 0.42, 0.7, 1],
  VC = [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1],
  HINGE = 0.7,
  TIPCAP = 0.92
/** A point in the fin's (f, v) plane. */
type Fv = readonly [number, number]
/** Rough world size of one unit of f and v, so patterns drawn in (f, v) keep their proportions. */
const FW = (FIN.chord + FIN.tip) / 2,
  VH = FIN.h

const cross2 = (a: Fv, b: Fv, c: Fv) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

/** Sutherland-Hodgman: `subject` cut by a convex counter-clockwise `clip`. */
function clipPoly(subject: readonly Fv[], clip: readonly Fv[]): Fv[] {
  let out: Fv[] = [...subject]
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length]
      const sp = cross2(a, b, p),
        sq = cross2(a, b, q)
      if (sp >= 0) out.push(p)
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq)
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
      }
    }
  }
  return out
}
/** The part of segment a-b inside a convex counter-clockwise polygon, or null. */
function clipSeg(a: Fv, b: Fv, poly: readonly Fv[]): [Fv, Fv] | null {
  let t0 = 0,
    t1 = 1
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i],
      d = poly[(i + 1) % poly.length]
    const n = cross2(c, d, a),
      m = cross2(c, d, b)
    if (n < 0 && m < 0) return null
    if (n < 0) t0 = Math.max(t0, n / (n - m))
    else if (m < 0) t1 = Math.min(t1, n / (n - m))
  }
  if (t0 >= t1) return null
  const l = (t: number): Fv => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  return [l(t0), l(t1)]
}
/** A skin panel: the cell between chord cuts f0..f1 and span cuts v0..v1, counter-clockwise. */
const cell = (f0: number, f1: number, v0: number, v1: number): Fv[] => [
  [f0, v0],
  [f1, v0],
  [f1, v1],
  [f0, v1],
]

// ---------------------------------------------------------------- the stabiliser stubs

/** Root LE and TE, tip LE and TE, how far the stub reaches past the skin, root and tip thickness. */
const STAB = { le: 70, te: 102, tipLe: 75, tipTe: 101, reach: 11, t: 3.2, tt: 2.6 }
const STAB_Z = geo((STAB.le + STAB.te) / 2).lift

// ---------------------------------------------------------------- the ladder (rung 3)

/** The ladder leans on the rudder: its rails at x = LX and LX + LW, feet on the floor at y = LY, tops on the skin at height LZ. */
const LX = 107,
  LW = 10,
  LY = 27,
  LZ = 92

export const airlines: LadderFigureDef = {
  id: 'airlines',
  rungs: 3,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const dots = (pts: readonly P3[], paint: Paint = 'detail', w = 0.9) =>
      s.segs(
        pts.map((p) => [p, add(p, [0.01, 0.01, 0])]),
        paint,
        w,
      )

    // ---- floor: one soft shadow under the section and its stands, another under the rung-3 clutter
    s.poly(
      roundRect(-12, -20, 76, 40, 12).map(([x, y]): P3 => [x, y, 0]),
      'shadow',
      'none',
    )

    // ---- far stabiliser stub, behind everything
    const stub = (sg: number) => {
      const yl = skinY(STAB.le, STAB_Z) - 0.4,
        yt = skinY(STAB.te, STAB_Z) - 0.4
      const ym = skinY((STAB.le + STAB.te) / 2, STAB_Z) + STAB.reach
      const sts: FoilStation[] = [
        { le: [STAB.le, sg * yl, STAB_Z], te: [STAB.te, sg * yt, STAB_Z], t: STAB.t },
        {
          le: [STAB.tipLe, sg * ym, STAB_Z + 0.6],
          te: [STAB.tipTe, sg * ym, STAB_Z + 0.6],
          t: STAB.tt,
        },
      ]
      const f = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: hero ? 3 : 1 })
      if (!hero || sg < 0) return
      // elevator hinge, and the bolt circle on the cut rib where the outboard stabiliser comes off
      f.line(0, 0.72, 1, 0.72)
      f.line(0, 0.12, 1, 0.12)
      for (const fr of [0.25, 0.45, 0.62]) {
        const p = mix([STAB.tipLe, ym, STAB_Z + 0.6], [STAB.tipTe, ym, STAB_Z + 0.6], fr)
        screw(s, add(p, [0, 0.05, 0]), Y, 0.32, { ring: 0.7 })
      }
    }
    stub(-1)

    // ---- tail stand: a spine on the floor and two cradle trestles; drawn before the fuselage, which settles into them
    if (hero) s.rbox(-6, -3, 0, 62, 6, 2.2, 1, { top: 'top' })
    const trestle = (xs: number) => {
      const x0 = xs - 3,
        x1 = xs + 3
      const g = geo(x1)
      const belly = g.lift - g.rz
      const zb = belly - 5.5
      const W = g.r * 0.9
      // foot beam with levelling pads
      s.rbox(xs - 4.5, -W - 5, 0, 9, 2 * W + 10, 3.2, 1.4, { top: 'top' })
      if (hero) for (const y of [-W - 2.5, W + 2.5]) screw(s, [xs, y, 3.25], Z, 0.45, { ring: 1.2 })
      // two screw-jack posts: a square sleeve and a round screw, with the jack's collar
      for (const y of [-W * 0.55, W * 0.55]) {
        s.box(xs - 2, y - 2, 3.2, 4, 4, zb - 3.2 - 8, { top: 'top' })
        tube(s, [xs, y, zb - 8], [xs, y, zb - 2.6], 1.2, { shade: hero, ring: hero ? 16 : 10 })
        if (hero) disc(s, [xs, y, zb - 6], Z, 2.1, 1.2, { ring: 16, shade: true })
      }
      // cross head the cradle sits on
      s.box(xs - 3.5, -W - 1.5, zb - 2.6, 7, 2 * W + 3, 2.6, { top: 'top' })
      // the cradle: a block across y whose top follows the belly, a rubber pad along it
      const arc = (x: number, a: number, inset = 0): P3 => {
        const q = geo(x)
        return [x, (q.r - inset) * Math.cos(a * D2R), q.lift + (q.rz - inset) * Math.sin(a * D2R)]
      }
      const A0 = -28,
        A1 = -152,
        n = 18
      const angs = Array.from({ length: n + 1 }, (_, i) => A0 + ((A1 - A0) * i) / n)
      const yh = arc(x1, A0)[1]
      const zh = arc(x1, A0)[2]
      // near end (+y), then the +x face
      s.poly(
        [
          [x0, yh, zb],
          [x1, yh, zb],
          [x1, yh, zh],
          [x0, yh, zh],
        ],
        'front',
        'crease',
        undefined,
        0.6,
      )
      s.poly(
        [...angs.map((a) => arc(x1, a)), [x1, arc(x1, A1)[1], zb], [x1, yh, zb]],
        'side',
        'line',
      )
      if (hero) {
        s.line(
          angs.map((a) => arc(x1 + 0.02, a, 1.1)),
          'crease',
          0.6,
        )
        for (const y of [-W * 0.55, W * 0.55])
          screw(s, [x1 + 0.03, y, zb + 1.6], X, 0.4, { ring: 0.9 })
      }
    }
    trestle(-3)
    trestle(52)

    // ---- the fuselage
    const AXIS = frameAlong([0, 0, 0], X)
    const b = lathe(s, AXIS, sec, H.cut, H.tail, {
      steps: hero ? 40 : 12,
      ring: hero ? 40 : 18,
      shade: hero,
    })
    // splice strap at the cut end, where the section came off the rest of the barrel
    b.seam(H.cut + 2.4, 'line', hero ? 0.7 : 0.9)
    if (hero) {
      // frames: ring seams, each with a rivet row beside it
      const seams = [-2, 18, 38, 58, 80, 100, 118]
      const rv: P3[] = []
      for (const x of seams) {
        b.seam(x)
        const lim = b.limbs(x + 1)
        if (lim) for (let a = lim[0] + 10; a <= lim[1] - 10; a += 7) rv.push(b.at(x + 1, a, 0.05))
      }
      // lap joints along the flank and their rivet rows, seam to seam
      for (const deg of [34, -18]) {
        b.along(deg, H.cut + 2.4, 118)
        for (let x = H.cut + 4; x < 116; x += 3.2) rv.push(b.at(x, deg - 3, 0.05))
      }
      dots(rv)
      // aft cabin windows and the aft service door, the APU access doors and the APU intake on the cone
      for (const x of [-9.6, -5.8])
        b.patch(
          [
            [x - 0.9, 15],
            [x + 0.9, 15],
            [x + 0.9, 23],
            [x - 0.9, 23],
          ],
          'glass',
          'crease',
        )
      for (const [lo, hi, d0, d1] of [
        [3, 13, -36, 50],
        [3.8, 12.2, -32, 46],
      ] as const)
        b.patch(
          [
            [lo, d0],
            [hi, d0],
            [hi, d1],
            [lo, d1],
          ],
          'none',
          'crease',
        )
      b.patch(
        [
          [102, -68],
          [124, -68],
          [124, -24],
          [102, -24],
        ],
        'none',
        'crease',
      )
      b.along(-46, 102, 124)
      b.patch(
        [
          [88, -8],
          [96, -8],
          [96, 10],
          [88, 10],
        ],
        'shade',
        'crease',
      )
      const louvres: P3[][] = []
      for (let x = 89.4; x < 95.5; x += 1.4) louvres.push([b.at(x, -6), b.at(x, 8)])
      s.segs(louvres, 'detail', 0.6)
    } else b.seam(H.taper + 12, 'crease', 0.8)

    // APU exhaust: a short nozzle out of the cone, dark inside
    const tl = geo(H.tail).lift
    const noz = spline([
      [0, 3.1],
      [2.6, 2.9],
      [4.2, 2.75],
    ])
    lathe(s, frameAlong([H.tail - 0.4, 0, tl], X), (t) => ({ r: noz(t)[0] }), 0, 4.2, {
      steps: hero ? 3 : 1,
      ring: hero ? 24 : 12,
      shade: hero,
    })
    s.poly(
      circleOn([H.tail + 3.85, 0, tl], X, 2.1, hero ? 20 : 12),
      'shade',
      'crease',
      undefined,
      0.6,
    )
    if (hero) s.poly(circleOn([H.tail + 3.86, 0, tl], X, 1.1, 12), 'none', 'crease', undefined, 0.5)

    // ---- dorsal fillet and root fairing, then the fin over them
    const fz = (x: number) => finRootZ(x)
    const leAt = (z: number) => FIN.le + Math.tan(FIN.sweep * D2R) * (z - fz(FIN.le))
    foil(
      s,
      [
        { le: [12, 0, fz(12) - 0.4], te: [FIN.le + 10, 0, fz(FIN.le + 10) - 0.4], t: 2.8 },
        { le: [30, 0, fz(30) + 4.6], te: [FIN.le + 12, 0, fz(30) + 4.6], t: 3.3 },
        {
          le: [leAt(fz(FIN.le) + 13) + 0.6, 0, fz(FIN.le) + 13],
          te: [FIN.le + 16, 0, fz(FIN.le) + 13],
          t: 3.7,
        },
      ],
      { up: Y, nose: hero ? 3 : 1 },
    )
    foil(
      s,
      [
        {
          le: [FIN.le - 3, 0, fz(FIN.le - 3) - 0.3],
          te: [FIN.le + FIN.chord + 3, 0, fz(FIN.le + FIN.chord + 3) - 0.3],
          t: FIN.t + 2.6,
        },
        {
          le: [leAt(fz(FIN.le) + 3.4) - 0.6, 0, fz(FIN.le) + 3.4],
          te: [FIN.le + FIN.chord + 1.4, 0, fz(FIN.le) + 3.4],
          t: FIN.t + 0.9,
        },
      ],
      { up: Y, nose: hero ? 3 : 1 },
    )
    const fin: Foil = foil(
      s,
      [
        {
          le: [FIN.le, 0, fz(FIN.le)],
          te: [FIN.le + FIN.chord, 0, fz(FIN.le + FIN.chord)],
          t: FIN.t,
        },
        { le: [FIN_TIP_LE, 0, FIN_TOP], te: [FIN_TIP_LE + FIN.tip, 0, FIN_TOP], t: FIN.tt },
      ],
      { up: Y, nose: hero ? 4 : 2 },
    )
    /** A point on the fin's near skin, a hair proud of it. */
    const on = ([f, v]: Fv, lift = 0.06): P3 => add(fin.top(v, f), [0, lift, 0])
    /** A closed region of the fin's skin; edges are subdivided so they follow it. */
    const skin = (
      pts: readonly Fv[],
      fill: Paint,
      stroke: Paint = 'crease',
      w = 0.6,
      opacity?: number,
    ) => {
      const out: P3[] = []
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length]
        for (let j = 0; j < 4; j++)
          out.push(on([p[0] + ((q[0] - p[0]) * j) / 4, p[1] + ((q[1] - p[1]) * j) / 4]))
      })
      s.poly(out, fill, stroke, undefined, w, opacity)
    }
    const skinLine = (pts: readonly Fv[], paint: Paint = 'crease', w = 0.6) =>
      s.line(
        pts.map((p) => on(p, 0.08)),
        paint,
        w,
      )
    /** Parallel lines at `deg` (measured in world-sized units on the fin) across a region, each ending on its edge. */
    const hatch = (region: readonly Fv[], deg: number, gap: number, paint: Paint, w = 0.6) => {
      const a = deg * D2R,
        dx = Math.cos(a) / FW,
        dz = Math.sin(a) / VH
      const L = Math.hypot(dx * FW, dz * VH)
      const nx = -Math.sin(a),
        nz = Math.cos(a)
      const ds = region.map(([f, v]) => f * FW * nx + v * VH * nz)
      const lo = Math.ceil(Math.min(...ds) / gap),
        hi = Math.floor(Math.max(...ds) / gap)
      const segs: P3[][] = []
      for (let i = lo; i <= hi; i++) {
        const c: Fv = [(nx * i * gap) / FW, (nz * i * gap) / VH]
        const seg = clipSeg(
          [c[0] - dx * 300, c[1] - dz * 300],
          [c[0] + dx * 300, c[1] + dz * 300],
          region,
        )
        if (seg && L) segs.push(seg.map((p) => on(p, 0.08)))
      }
      if (segs.length) s.segs(segs, paint, w)
    }
    /** The lit livery: an accent outline over a 30% wash, so a large panel stays quiet. */
    const wash = (pts: readonly Fv[], w = 1.4) => {
      s.glow(3, () => skin(pts, 'none', 'accent', w))
      skin(pts, 'accent', 'none', 0, 0.3)
      skin(pts, 'none', 'accent', w)
    }
    /** Masking tape along a run of the skin: a strip `th` wide (in v), its free end torn. */
    const tape = (f0: number, f1: number, v: number, th: number) => {
      const teeth: Fv[] = []
      for (let i = 0; i <= 4; i++) teeth.push([f1 + (i % 2 ? 0.012 : 0), v + th / 2 - (th * i) / 4])
      skin(
        [[f0, v - th / 2], ...teeth.slice().reverse(), [f0, v + th / 2]],
        hero ? 'top' : 'none',
        'crease',
        0.6,
      )
    }
    /** Vertical masking tape: a strip `tw` wide (in f) from v0 to v1. */
    const tapeV = (f: number, v0: number, v1: number, tw: number) =>
      skin(cell(f - tw / 2, f + tw / 2, v0, v1), hero ? 'top' : 'none', 'crease', 0.6)

    // ---- livery
    if (rung === 1) {
      // One livery: a band over a row of panels, fin to rudder, with a pinstripe on the row above.
      skin(cell(FC[1], 1, 0.565, 0.6), 'ink', 'none')
      s.group('lit', () => {
        wash(cell(FC[1], 1, VC[2], VC[3]))
        if (hero) hatch(cell(FC[1], 1, VC[2], VC[3]), 58, 4.6, 'accent', 0.5)
      })
    } else if (rung === 2) {
      // The first livery, still there: the old band with its pinstripe.
      skin(cell(FC[1], 1, VC[2], VC[3]), 'muted', 'crease', 0.6)
      skin(cell(FC[1], 1, 0.565, 0.6), 'ink', 'none')
      // Primer over one of its panels and one below it, not yet painted.
      for (const c of [cell(FC[1], FC[2], VC[2], VC[3]), cell(FC[2], FC[3], VC[1], VC[2])]) {
        skin(c, 'land', 'crease', 0.6)
        if (hero) hatch(c, 24, 3.4, 'crease', 0.45)
      }
      // The masking tape along the new band's lower edge, still on.
      tape(FC[1] - 0.02, HINGE + 0.01, VC[3], 0.03)
      tapeV(HINGE + 0.012, VC[2] - 0.02, VC[3] + 0.015, 0.022)
      // The new livery: the row above, and the upper rudder; paint ran down over the tape.
      s.group('lit', () => {
        const band: Fv[] = [
          [FC[1], VC[3]],
          [HINGE, VC[3]],
          [HINGE, VC[2]],
          [1, VC[2]],
          [1, VC[4]],
          [FC[1], VC[4]],
        ]
        // the new paint hides what it covers, then takes the accent
        skin(band, 'front', 'none')
        wash(band, 1.6)
        for (const f of hero ? [0.24, 0.33, 0.55, 0.62] : [0.33])
          skin(
            [
              [f - 0.012, VC[3] + 0.004],
              [f + 0.012, VC[3] + 0.004],
              [f + 0.006, VC[3] - 0.05],
              [f, VC[3] - 0.066],
              [f - 0.006, VC[3] - 0.05],
            ],
            'accent',
            'accent',
            0.5,
          )
      })
    } else {
      // The quilt: every panel a different livery.
      type Kind = {
        tint: Paint
        mark?: Paint
        pat?: 'stripes' | 'stripes-up' | 'dots' | 'chevron' | 'cheat'
      }
      const kinds: Kind[] = [
        { tint: 'front', pat: 'stripes' },
        { tint: 'muted' },
        { tint: 'land', pat: 'dots', mark: 'ink' },
        { tint: 'front', pat: 'chevron', mark: 'muted' },
        { tint: 'top' },
        { tint: 'land', pat: 'stripes-up' },
        { tint: 'ink' },
        { tint: 'land', pat: 'chevron', mark: 'ink' },
        { tint: 'muted', pat: 'dots', mark: 'top' },
        { tint: 'top', pat: 'cheat', mark: 'ink' },
      ]
      const NEW = { f: 2, v: 3 } // the newest panel: fixed fin, between the mid and rear spars, the row above the ladder's tops
      let n = 0
      for (let vi = 0; vi + 1 < VC.length - 1; vi++)
        for (let fi = 1; fi + 1 < FC.length; fi++, n++) {
          if (fi === NEW.f && vi === NEW.v) continue
          const c = cell(FC[fi], FC[fi + 1], VC[vi], VC[vi + 1])
          const kind = kinds[(n * 7 + vi * 3) % kinds.length]
          const tint: Paint = hero
            ? kind.tint
            : kind.tint === 'muted' || kind.tint === 'ink'
              ? 'ink'
              : kind.tint === 'land'
                ? 'muted'
                : 'none'
          skin(c, tint, 'crease', 0.6)
          if (!hero && kind.tint !== 'land' && kind.pat !== 'stripes') continue
          const mid: Fv = [(FC[fi] + FC[fi + 1]) / 2, (VC[vi] + VC[vi + 1]) / 2]
          const markPaint = kind.mark ?? 'ink'
          if (kind.pat === 'stripes' || kind.pat === 'stripes-up')
            hatch(
              c,
              kind.pat === 'stripes' ? 52 : -38,
              hero ? 3 : 6,
              hero ? 'crease' : 'ink',
              hero ? 0.55 : 1.2,
            )
          else if (kind.pat === 'chevron' && hero) {
            const w = 8 / FW,
              h = 5 / VH,
              t = 2.6 / VH
            const chev: Fv[] = [
              [mid[0] - w, mid[1] - h / 2],
              [mid[0], mid[1] + h / 2],
              [mid[0] + w, mid[1] - h / 2],
              [mid[0] + w, mid[1] - h / 2 + t],
              [mid[0], mid[1] + h / 2 + t],
              [mid[0] - w, mid[1] - h / 2 + t],
            ]
            const cut = clipPoly(chev, c)
            if (cut.length >= 3) skin(cut, markPaint, 'none')
          } else if (kind.pat === 'dots' && hero) {
            for (let u = -4; u <= 4; u++)
              for (let v = -3; v <= 3; v++) {
                const cx = mid[0] + (u * 4.4 + (Math.abs(v) % 2) * 2.2) / FW,
                  cz = mid[1] + (v * 3.6) / VH
                const dot: Fv[] = Array.from({ length: 8 }, (_, q): Fv => [
                  cx + (1.1 * Math.cos((q * Math.PI) / 4)) / FW,
                  cz + (1.1 * Math.sin((q * Math.PI) / 4)) / VH,
                ])
                if (
                  dot.every(
                    ([f, vv]) =>
                      f > c[0][0] + 0.02 &&
                      f < c[1][0] - 0.02 &&
                      vv > c[0][1] + 0.02 &&
                      vv < c[2][1] - 0.02,
                  )
                )
                  skin(dot, markPaint, 'none')
              }
          } else if (kind.pat === 'cheat' && hero) {
            // a cheatline: two stripes along the chord
            for (const dv of [-2.2, 1.4])
              skin(
                cell(c[0][0], c[1][0], mid[1] + dv / VH, mid[1] + (dv + 1.2) / VH),
                markPaint,
                'none',
              )
          }
        }
      // The rudder tip and the LE strip stay bare metal. Tape still frames the newest panel.
      const N = cell(FC[NEW.f], FC[NEW.f + 1], VC[NEW.v], VC[NEW.v + 1])
      s.group('lit', () => {
        wash(N)
        const mid: Fv = [(N[0][0] + N[1][0]) / 2, (N[0][1] + N[2][1]) / 2]
        for (const dz of hero ? [-2.6, 2.4] : [0]) {
          const w = 9 / FW,
            h = 5 / VH,
            t = 2.4 / VH
          const v0 = mid[1] + dz / VH
          skin(
            clipPoly(
              [
                [mid[0] - w, v0 - h / 2],
                [mid[0], v0 + h / 2],
                [mid[0] + w, v0 - h / 2],
                [mid[0] + w, v0 - h / 2 + t],
                [mid[0], v0 + h / 2 + t],
                [mid[0] - w, v0 - h / 2 + t],
              ],
              N,
            ),
            'accent',
            'none',
          )
        }
      })
      if (hero) {
        tape(N[0][0] - 0.015, N[1][0] + 0.01, N[0][1] - 0.012, 0.024)
        tape(N[0][0] - 0.015, N[1][0] + 0.01, N[2][1] + 0.012, 0.024)
        tapeV(N[1][0] + 0.012, N[0][1] - 0.02, N[2][1] + 0.02, 0.02)
      }
    }

    // ---- fin hardware over the livery
    if (hero) {
      // panel seams: spars and ribs, each edge to edge
      for (const f of [FC[1], FC[2]])
        skinLine([
          [f, 0],
          [f, TIPCAP],
        ])
      for (const v of VC.slice(1, -1))
        skinLine([
          [FC[1], v],
          [1, v],
        ])
      skinLine([
        [0.06, 0],
        [0.06, 1],
      ])
      skinLine([
        [0, TIPCAP],
        [1, TIPCAP],
      ])
      // rivet rows beside the spars
      const rv: P3[] = []
      for (const f of [FC[1] + 0.02, FC[2] + 0.02])
        for (let v = 0.03; v < TIPCAP - 0.02; v += 0.035) rv.push(on([f, v], 0.08))
      dots(rv)
    }
    // rudder: the hinge line and its gap, the split between upper and lower rudder, the hinge fairings
    skinLine(
      [
        [HINGE, 0],
        [HINGE, TIPCAP],
      ],
      'line',
      hero ? 0.8 : 1.1,
    )
    if (hero) {
      skinLine([
        [HINGE + 0.025, 0],
        [HINGE + 0.025, TIPCAP],
      ])
      skinLine([
        [HINGE, 0.5],
        [1, 0.5],
      ])
      for (const v of [0.1, 0.32, 0.6, 0.82])
        skin(cell(HINGE - 0.02, HINGE + 0.045, v - 0.012, v + 0.012), 'top', 'crease', 0.5)
    }
    // fin silhouette over the livery so the edge stays crisp
    s.poly(
      [on([0, 0], 0.1), on([1, 0], 0.1), on([1, 1], 0.1), on([0, 1], 0.1)],
      'none',
      'line',
      undefined,
      hero ? 0.9 : 1.2,
    )
    // anti-collision light on the tip: a base and a glass dome
    const tipC = add(
      mix([FIN_TIP_LE, 0, FIN_TOP], [FIN_TIP_LE + FIN.tip, 0, FIN_TOP], 0.3),
      [0, 0, 0],
    )
    if (hero) disc(s, add(tipC, [0, 0, 0.3]), Z, 2.1, 0.6, { ring: 20, shade: true })
    const dome = spline([
      [0, 1.6],
      [0.8, 1.35],
      [1.6, 0],
    ])
    lathe(
      s,
      frameAlong(add(tipC, [0, 0, hero ? 0.6 : 0]), Z),
      (t) => ({ r: Math.max(0, dome(t)[0]) }),
      0,
      1.6,
      {
        steps: hero ? 4 : 1,
        ring: hero ? 20 : 10,
        shade: hero,
        tint: hero ? 'glass' : undefined,
      },
    )
    // static wicks off the rudder's trailing edge, trailing aft
    if (hero)
      for (const v of [0.6, 0.73, 0.86]) {
        const te = fin.top(v, 1)
        const a: P3 = [te[0] - 0.4, 0, te[2]]
        const tip = add(a, mul(unit([1, 0, 0.18]), 6.5))
        tube(s, a, tip, 0.32, { ring: 8 })
        s.poly(circleOn(tip, X, 0.5, 8), 'line', 'none')
      }

    // ---- near stabiliser stub
    stub(1)

    if (rung === 3) {
      // ---- the clutter, back to front: roller, lid, tin, tape roll, then the ladder
      s.poly(
        roundRect(6, 32, 84, 26, 12).map(([x, y]): P3 => [x, y, 0]),
        'shadow',
        'none',
      )
      // Roller: sleeve on its wire cage, lying on the floor, the handle off to the near side.
      const RX = 12,
        RY = 38,
        rr = 3.4
      const sleeve = lathe(s, frameAlong([RX, RY, rr], X), () => ({ r: rr }), 0, 18, {
        steps: hero ? 4 : 1,
        ring: hero ? 24 : 12,
        shade: hero,
      })
      if (hero) {
        for (const x of [4, 9, 14]) sleeve.seam(x, 'crease', 0.5)
        s.line(
          [
            [RX, RY, rr],
            [RX - 3, RY, rr],
            [RX - 3, RY + 6, 1.4],
          ],
          'line',
          0.9,
        )
        lathe(
          s,
          frameAlong([RX - 3, RY + 6, 1.4], Y),
          (t) => ({ r: 1.2 + 0.25 * Math.sin((t / 9) * Math.PI) }),
          0,
          9,
          {
            steps: 4,
            ring: 14,
            shade: true,
          },
        )
      }
      // Tin lid on the floor, paint ring in it.
      const cx = 54,
        cy = 38,
        tr = 7.6,
        th = 11
      if (hero) {
        disc(s, [cx - 16, cy + 9, 0.6], Z, tr + 0.7, 1.2, { ring: 28, shade: true })
        s.poly(circleOn([cx - 16, cy + 9, 1.22], Z, tr - 1.4, 24), 'none', 'crease', undefined, 0.6)
        s.poly(circleOn([cx + 6, cy + 9, 0.1], Z, 3.6, 16), 'muted', 'crease', undefined, 0.6)
      }
      // Paint tin: lathe body with rolled beads, rim, wet paint, a drip down the near side, the bail up.
      const can = lathe(
        s,
        frameAlong([cx, cy, 0], Z),
        (t) => ({ r: tr + (t > th - 0.8 ? 0.5 : 0) + (Math.abs(t - 0.6) < 0.4 ? 0.3 : 0) }),
        0,
        th,
        { steps: hero ? 10 : 2, ring: hero ? 32 : 16, shade: hero, caps: false },
      )
      if (hero) for (const t of [3.6, 7.4]) can.seam(t, 'crease', 0.5)
      s.poly(
        circleOn([cx, cy, th], Z, tr + 0.5, hero ? 32 : 16),
        'top',
        'line',
        undefined,
        hero ? 0.8 : 1,
      )
      s.poly(
        circleOn([cx, cy, th + 0.02], Z, tr - 0.8, hero ? 28 : 14),
        'ink',
        hero ? 'crease' : 'none',
        undefined,
        0.6,
      )
      if (hero) {
        s.poly(circleOn([cx - 1.5, cy - 1.2, th + 0.04], Z, 2.4, 12), 'muted', 'none')
        const q = Math.SQRT1_2,
          dr = tr + 0.05
        const dp = (u: number, h: number): P3 => [cx + dr * q - u * q, cy + dr * q + u * q, h]
        s.poly(
          [
            [-1.3, th],
            [1.3, th],
            [1, th - 4.4],
            [0.5, th - 6.2],
            [-0.5, th - 6.2],
            [-1, th - 4.4],
          ].map(([u, h]) => dp(u, h)),
          'ink',
          'crease',
          undefined,
          0.6,
        )
        // bail: a wire hinged on two ears, standing up
        const bail: P3[] = []
        for (let i = 0; i <= 16; i++) {
          const a = (Math.PI * i) / 16
          bail.push([
            cx + (tr + 0.6) * Math.cos(a) * q,
            cy - (tr + 0.6) * Math.cos(a) * q,
            th - 2 + 8 * Math.sin(a),
          ])
        }
        s.line(bail, 'line', 0.9)
        for (const sg of [-1, 1])
          screw(s, [cx + sg * (tr + 0.6) * q, cy - sg * (tr + 0.6) * q, th - 2], [sg, -sg, 0], 0.5)
        // a roll of masking tape lying beside the tin
        disc(s, [cx + 18, cy + 8, 1.3], Z, 4.6, 2.6, { ring: 24, shade: true })
        s.poly(circleOn([cx + 18, cy + 8, 2.62], Z, 2.6, 16), 'shade', 'crease', undefined, 0.6)
        s.poly(circleOn([cx + 18, cy + 8, 2.62], Z, 3.6, 20), 'none', 'crease', undefined, 0.4)
      }

      // Ladder: far rail, rungs, near rail; rubber feet on the floor and pads where the tops rest on the rudder.
      const topY = on([0.85, 0.45])[1] + 1.6
      const foot = (x: number): P3 => [x, LY, 0.2]
      const top = (x: number): P3 => [x, topY, LZ]
      const rail = (x: number) =>
        beam(s, foot(x), top(x), 2.8, 1.4, { up: X, width: hero ? 1 : 1.2 })
      rail(LX)
      const nr = hero ? 11 : 5
      for (let i = 1; i <= nr; i++) {
        const t = (i - 0.3) / (nr + 0.4)
        const p = mix(foot(0), top(0), t)
        if (hero) tube(s, [LX + 0.7, p[1], p[2]], [LX + LW - 0.7, p[1], p[2]], 0.7, { ring: 10 })
        else
          s.line(
            [
              [LX, p[1], p[2]],
              [LX + LW, p[1], p[2]],
            ],
            'line',
            1.2,
          )
      }
      rail(LX + LW)
      if (hero)
        for (const x of [LX, LX + LW]) {
          s.rbox(x - 1.6, LY - 2.4, 0, 3.2, 4.4, 1.2, 0.6, { top: 'side' })
          const d = unit(sub(top(0), foot(0)))
          lathe(s, frameAlong(sub(top(x), mul(d, 2.2)), d), () => ({ r: 1.25 }), 0, 2.2, {
            steps: 1,
            ring: 12,
            shade: true,
          })
        }
    }

    return s.done()
  },
}
