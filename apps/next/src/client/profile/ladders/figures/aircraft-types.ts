import { Scene, roundRect, type IsoNode, type P3, type Paint } from '../../../overview/iso/scene'
import {
  add,
  beam,
  circleOn,
  disc,
  foil,
  frameAlong,
  knurl,
  lathe,
  mul,
  screw,
  spline,
  tube,
  unit,
  wheel,
  type FoilStation,
  type LatheOpts,
  type Section,
  D2R,
} from './parts'
import type { LadderFigureDef } from './types'

// Aircraft types: the stretch. One narrowbody airframe on a hangar floor, seen exactly side-on along its length (the camera
// sits abeam, so the barrel runs level across the frame, unlike Flights' diagonal), its barrel lengthened by fuselage plugs
// spliced in ahead of the wing. Each plug joint is a butt strap with doubled rivet rows either side; the newest plug is the
// lit part (accent outline, a faint accent wash, its joints and its door outlines) and rests on jig cradles.
// Build frame ("local"): the nose points +x, the near flank faces +y, z is up; W() turns it so +x runs level to the right
// on screen and +y points at the viewer. The thumb squashes local x so a long body still reads at 56px.

const GROUND = 3
/** Camera azimuth off the beam: the barrel runs almost level across the frame (Flights' runs at 30°), and the nose turns just enough towards the viewer to show the intakes. */
const PHI = 32 * D2R
const CP = Math.cos(PHI),
  SP = Math.sin(PHI)
const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]

/** One barrel section between two joints, with the doors on its near flank (local x of each door centre). */
type Barrel = { x0: number; x1: number; doors: readonly number[]; plug?: boolean }

const AFT: Barrel = { x0: 0, x1: 36, doors: [4] }
const run = (from: number, n: number, step: number) =>
  Array.from({ length: n }, (_, i) => from + i * step)
/** Hero barrels per rung: aft barrel with the wing box, the plugs (the last is the newest), forward barrel. The first plug is a short
 * windows-only stretch; the second adds a door pair; the third adds far too many. */
const HERO_LAYOUTS: Barrel[][] = [
  [AFT, { x0: 36, x1: 48, doors: [], plug: true }, { x0: 48, x1: 70, doors: [65] }],
  [
    AFT,
    { x0: 36, x1: 48, doors: [], plug: true },
    { x0: 48, x1: 68, doors: [58], plug: true },
    { x0: 68, x1: 90, doors: [85] },
  ],
  [
    AFT,
    { x0: 36, x1: 48, doors: [], plug: true },
    { x0: 48, x1: 68, doors: [58], plug: true },
    { x0: 68, x1: 224, doors: run(74, 12, 13), plug: true },
    { x0: 224, x1: 246, doors: [241] },
  ],
]
/** Thumb barrels: the same story with fewer, wider doors on a squashed body. */
const THUMB_LAYOUTS: Barrel[][] = [
  [
    { x0: 0, x1: 36, doors: [5] },
    { x0: 36, x1: 50, doors: [], plug: true },
    { x0: 50, x1: 72, doors: [67] },
  ],
  [
    { x0: 0, x1: 36, doors: [5] },
    { x0: 36, x1: 50, doors: [], plug: true },
    { x0: 50, x1: 70, doors: [60], plug: true },
    { x0: 70, x1: 92, doors: [87] },
  ],
  [
    { x0: 0, x1: 36, doors: [5] },
    { x0: 36, x1: 50, doors: [], plug: true },
    { x0: 50, x1: 70, doors: [60], plug: true },
    { x0: 70, x1: 170, doors: run(77, 7, 14), plug: true },
    { x0: 170, x1: 192, doors: [187] },
  ],
]

/** The narrowbody's fixed parts (local units; R is the barrel radius). Wing rows: [y, LE x, TE x, thickness], root first. */
type Spec = {
  q: number
  R: number
  aspect: number
  tail: number
  nose: number
  wing: readonly (readonly [number, number, number, number])[]
  dihedral: number
  eng: { y: number; x: number; len: number; r: number; clear: number }
  stab: { le: number; chord: number; span: number; sweep: number; tip: number; t: number }
  fin: { le: number; chord: number; h: number; sweep: number; tip: number; t: number }
  gear: { x: number; y: number; r: number; w: number; leg: number }
  door: { w: number; d0: number; d1: number }
}
const HERO_SPEC: Spec = {
  q: 1,
  R: 6.6,
  aspect: 1.06,
  tail: -35,
  nose: 18,
  wing: [
    [0, 32, 8, 2.6],
    [17, 24.2, 7.4, 2],
    [50, 4.8, -0.4, 0.8],
  ],
  dihedral: 5,
  eng: { y: 17, x: 37.5, len: 17, r: 4.1, clear: 1.6 },
  stab: { le: -18, chord: 12, span: 19, sweep: 32, tip: 4.4, t: 1.1 },
  fin: { le: -9, chord: 21, h: 24, sweep: 36, tip: 8, t: 1.4 },
  gear: { x: 10, y: 11.5, r: 2.8, w: 1.8, leg: 0.75 },
  door: { w: 2.2, d0: -40, d1: 52 },
}
const THUMB_SPEC: Spec = {
  ...HERO_SPEC,
  q: 0.4,
  wing: [
    [0, 32, 8, 2.6],
    [10, 26, 7.6, 2.2],
    [27, 10, 1, 1],
  ],
  eng: { y: 12.6, x: 36, len: 15, r: 3.4, clear: 1.6 },
  stab: { ...HERO_SPEC.stab, span: 12 },
  gear: { ...HERO_SPEC.gear, y: 9 },
  door: { w: 2.8, d0: -42, d1: 56 },
}

/** Where the top rung's frame cuts the tail off (local x): only a sliver of the fin's leading edge stays in. */
const CROP_X = -16

export const aircraftTypes: LadderFigureDef = {
  id: 'aircraft-types',
  rungs: 3,
  build(k, { rung, lod }) {
    const hero = lod === 'hero'
    const P = hero ? HERO_SPEC : THUMB_SPEC
    const layout = (hero ? HERO_LAYOUTS : THUMB_LAYOUTS)[rung - 1]
    const q = P.q
    const s = new Scene(k)

    /** Local to world: x runs level to the right on screen (squashed by q), y towards the viewer. */
    const W = ([x, y, z]: P3): P3 => [CP * q * x + SP * y, CP * y - SP * q * x, z]
    /** A local direction in world space (not normalised). */
    const V = W
    const latheX = (o: P3, sec: (x: number) => Section, x0: number, x1: number, opts: LatheOpts) =>
      lathe(s, frameAlong(W(o), V(X)), (t) => sec(t / q), q * x0, q * x1, opts)

    // ---------------------------------------------------------------- fuselage profile
    const R = P.R,
      A = P.aspect
    const tanD = Math.tan(P.dihedral * D2R)
    const row = (y: number) => {
      const w = P.wing
      let i = 0
      while (i < w.length - 2 && y > w[i + 1][0]) i++
      const [y0, l0, t0, h0] = w[i],
        [y1, l1, t1, h1] = w[i + 1]
      const u = (y - y0) / (y1 - y0)
      return { le: l0 + (l1 - l0) * u, te: t0 + (t1 - t0) * u, t: h0 + (h1 - h0) * u }
    }
    // Heights follow from the engine: it hangs `clear` above the floor, the pylon reaches the wing, the wing sits low on the barrel.
    const E = P.eng
    const nacZ = GROUND + E.clear + E.r
    const W0 = nacZ + E.r * 1.42 + row(E.y).t - tanD * E.y
    const Zc = W0 + 0.42 * R * A
    const noseStart = layout[layout.length - 1].x1,
      noseTip = noseStart + P.nose,
      tailTip = P.tail
    const sec = (x: number): Section => {
      let r = R,
        lift = Zc
      if (x > noseStart) {
        const u = Math.min(1, (x - noseStart) / P.nose)
        r = R * Math.sqrt(Math.max(0, 1 - u * u))
        lift = Zc - 0.55 * (R - r) * A
      } else if (x < 0) {
        const u = Math.min(1, x / tailTip)
        r = R - (R - 0.7) * Math.pow(u, 1.7)
        lift = Zc + 0.85 * (R - r) * A
      }
      return { r, rz: r * A, lift }
    }
    const skinY = (x: number, z: number) => {
      const { r, rz = r, lift = 0 } = sec(x)
      const t = (z - lift) / rz
      return Math.abs(t) >= 1 ? 0 : r * Math.sqrt(1 - t * t)
    }
    const crownZ = (x: number, y = 0) => {
      const { r, rz = r, lift = 0 } = sec(x)
      return lift + rz * Math.sqrt(1 - Math.min(1, Math.abs(y) / r) ** 2)
    }
    const bellyZ = (x: number) => {
      const { r, rz = r, lift = 0 } = sec(x)
      return lift - rz
    }
    const zTop = (y: number) => W0 + tanD * Math.abs(y)
    const zBot = (y: number) => zTop(y) - row(Math.abs(y)).t
    const ySkin = skinY(0, W0)
    const span = P.wing[P.wing.length - 1][0]

    const plugs = layout.filter((b) => b.plug)
    const newest = plugs[plugs.length - 1]

    // ---------------------------------------------------------------- floor, shadow, cradles
    /** The hangar floor strip runs under the barrel from FY0 (far) to FY1 (near); the wingtips overhang it. */
    const FY0 = -24,
      FY1 = 30
    if (hero) {
      const x0 = tailTip - 6,
        x1 = noseTip + 10
      beam(
        s,
        W([x0, (FY0 + FY1) / 2, GROUND / 2]),
        W([x1, (FY0 + FY1) / 2, GROUND / 2]),
        FY1 - FY0,
        GROUND,
      )
      // Expansion joints across the floor, edge to edge, and a painted stand line along it.
      const segs: P3[][] = []
      for (let x = Math.ceil(x0 / 40) * 40; x < x1 - 4; x += 40)
        segs.push([W([x, FY0, GROUND]), W([x, FY1, GROUND])])
      const yl = FY1 - 5
      segs.push([W([x0, yl, GROUND]), W([x1, yl, GROUND])])
      s.segs(segs, 'crease', 0.6)
      // Stand line markings: short bars across the stand line at each plug joint, so the floor records where the cuts went.
      s.segs(
        plugs
          .flatMap((p) => [p.x0, p.x1])
          .map((x) => [W([x, yl - 1.6, GROUND]), W([x, yl + 1.6, GROUND])]),
        'crease',
        0.6,
      )
      // The aircraft's shadow: its near-side plan outline mirrored, laid on the floor and slid away from the light.
      const h = Zc - GROUND
      const dx = 0.2 * h,
        dy = -0.45 * h
      const tipRow = row(span),
        st = P.stab
      const near: [number, number][] = [
        [noseTip, 0],
        [noseStart, R],
        [row(ySkin).le, R],
        [tipRow.le, span],
        [tipRow.te, span],
        [row(ySkin).te, R],
        [0, R],
        [st.le, R * 0.6],
        [st.le - Math.tan(st.sweep * D2R) * st.span, st.span],
        [st.le - Math.tan(st.sweep * D2R) * st.span - st.tip, st.span],
        [st.le - st.chord, R * 0.4],
        [tailTip, 0.7],
      ]
      // The floor ends at its edges, so the shadow does too.
      const fl = (y: number) => Math.min(FY1, Math.max(FY0, y))
      s.poly(
        [
          ...near.map(([x, y]) => W([x + dx, fl(y + dy), GROUND + 0.02])),
          ...[...near].reverse().map(([x, y]) => W([x + dx, fl(-y + dy), GROUND + 0.02])),
        ],
        'shadow',
        'none',
      )
      // Jig cradles under the newest plug: a foot on the floor, a screw-jack post with its collar, and a saddle block
      // whose near edge meets the belly (the rest of its top is inside the barrel's shadow, hidden by the fuselage).
      const n = Math.max(1, Math.round((newest.x1 - newest.x0) / 40))
      const yN = 0.5 * R
      const zContact = Zc - R * A * Math.sqrt(1 - 0.25)
      const sb = bellyZ(newest.x0 + 1) - 2.2
      for (let i = 0; i < n; i++) {
        const xc = newest.x0 + ((newest.x1 - newest.x0) * (i + 0.5)) / n
        beam(s, W([xc, -6, GROUND]), W([xc, 6, GROUND]), 4, 1.4, { up: Z })
        for (const yb of [-4.6, 4.6])
          screw(s, W([xc + 1.1, yb, GROUND + 1.42]), Z, 0.2, { ring: 0.45 })
        tube(s, W([xc, 0, GROUND + 1.4]), W([xc, 0, sb - 1.2]), 0.75, { shade: true })
        const col = lathe(
          s,
          frameAlong(W([xc, 0, 0]), Z),
          () => ({ r: 1.35 }),
          sb - 3.4,
          sb - 1.2,
          {
            steps: 1,
            ring: 24,
            shade: true,
          },
        )
        col.seam(sb - 2.3, 'crease', 0.4)
        knurl(col, sb - 3.4, sb - 1.2, 28, 'crease', 0.4)
        beam(
          s,
          W([xc, -yN, (sb + zContact) / 2]),
          W([xc, yN, (sb + zContact) / 2]),
          3.2,
          zContact - sb,
          {
            up: Z,
          },
        )
        // Rubber pad along the saddle's near top edge.
        s.line(
          [W([xc - 1.6, yN, zContact - 0.5]), W([xc + 1.6, yN, zContact - 0.5])],
          'crease',
          0.6,
        )
      }
    }

    // ---------------------------------------------------------------- parts, each for one side
    const wingSt = (y: number): FoilStation => {
      const r = row(Math.abs(y))
      const z = zTop(y) - r.t / 2
      return { le: W([r.le, y, z]), te: W([r.te, y, z]), t: r.t }
    }
    const wingPanel = (sg: number) => {
      const ys = [sg > 0 ? ySkin : -ySkin * 0.6, ...P.wing.slice(1).map(([y]) => y)]
      const sts = ys.map((y) => wingSt(sg * Math.abs(y)))
      const w = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: hero ? 4 : 2 })
      if (!hero) return
      const n = sts.length - 1
      const i = (t: number) => (sg > 0 ? t : n - t)
      // Flap and aileron hinge lines, their cuts to the trailing edge, a spoiler panel and the front spar line.
      w.line(i(0), 0.76, i(n * 0.62), 0.76)
      w.line(i(n * 0.64), 0.78, i(n * 0.94), 0.78)
      for (const t of [0.3, 0.62, 0.64, 0.94])
        w.line(i(n * t), t === 0.62 || t === 0.3 ? 0.76 : 0.78, i(n * t), 1)
      w.line(i(0.15), 0.6, i(n * 0.5), 0.6)
      w.line(i(0.15), 0.6, i(0.15), 0.76)
      w.line(i(n * 0.5), 0.6, i(n * 0.5), 0.76)
      w.line(i(0), 0.14, i(n), 0.14)
      screw(s, add(w.top(i(n * 0.97), 0.45), [0, 0, 0.05]), Z, 0.32)
    }
    const winglet = (sg: number) => {
      const t = row(span),
        zt = zTop(span)
      foil(
        s,
        [
          {
            le: W([t.le - 0.3, sg * span, zt - 0.3]),
            te: W([t.te + 0.2, sg * span, zt - 0.3]),
            t: 0.7,
          },
          {
            le: W([t.le - 3.4, sg * (span + 0.8), zt + 3]),
            te: W([t.te - 0.6, sg * (span + 0.8), zt + 3]),
            t: 0.6,
          },
          {
            le: W([t.le - 7, sg * (span + 1.4), zt + 8.6]),
            te: W([t.le - 9.6, sg * (span + 1.4), zt + 8.6]),
            t: 0.4,
          },
        ],
        { up: V(Y), nose: 2 },
      )
    }
    /** Flap-track fairings: pods under the trailing edge, poking out behind it. */
    const fairings = (sg: number) => {
      if (!hero) return
      for (const f of [0.28, 0.5, 0.72]) {
        const y = sg * (ySkin + (span - ySkin) * f * 0.85)
        const r = row(Math.abs(y))
        const L = (r.le - r.te) * 0.62
        const prof = spline([
          [0, 0.2],
          [L * 0.25, 0.75],
          [L * 0.7, 0.7],
          [L, 0.15],
        ])
        latheX(
          [r.te - L * 0.4, y, 0],
          (t) => {
            const a = Math.max(0.05, prof(t)[0])
            return { r: a * 0.7, rz: a * 1.2, lift: zBot(y) - a * 0.4 }
          },
          0,
          L,
          { steps: 6, ring: 16, shade: true },
        )
      }
    }
    const engine = (sg: number) => {
      const y = sg * E.y,
        xr = E.x - E.len,
        r = E.r
      // Exhaust plug and core cowl, then the fan cowl with its seams and the inlet lip.
      const plug = spline([
        [0, 0.5 * r],
        [0.4 * r, 0.42 * r],
        [1.1 * r, 0.06 * r],
      ])
      latheX(
        [xr - 0.25 * E.len - 1.1 * r, y, nacZ],
        (t) => ({ r: plug(1.1 * r - t)[0] }),
        0,
        1.1 * r,
        {
          steps: hero ? 6 : 2,
          ring: hero ? 20 : 12,
          shade: hero,
          caps: false,
        },
      )
      latheX(
        [xr - 0.25 * E.len, y, nacZ],
        (t) => ({ r: r * (0.5 + 0.14 * (t / (0.25 * E.len))) }),
        0,
        0.25 * E.len + 1,
        { steps: hero ? 4 : 1, ring: hero ? 24 : 14, shade: hero, caps: false },
      )
      const prof = spline([
        [0, 0.74],
        [0.12, 0.86],
        [0.45, 0.99],
        [0.75, 1],
        [1, 0.96],
      ])
      const lip = 0.32 * r
      const nb = latheX(
        [xr, y, 0],
        (t) => {
          const u = t / E.len
          const lipR =
            t > E.len - lip ? 0.012 * Math.sqrt(Math.max(0, 1 - ((t - E.len + lip) / lip) ** 2)) : 0
          return { r: r * (prof(u)[0] + lipR), lift: nacZ }
        },
        0,
        E.len,
        { steps: hero ? 14 : 5, ring: hero ? 32 : 16, shade: hero, caps: false },
      )
      if (hero) {
        nb.seam(q * E.len * 0.42)
        nb.seam(q * E.len * 0.8)
        nb.seam(q * (E.len - lip), 'crease', 0.5)
        nb.along(-30, q * E.len * 0.42, q * E.len * 0.8)
        // Fan-cowl latches along the lower cowl, between its seams.
        for (const f of [0.52, 0.62, 0.72]) {
          const p = nb.at(q * E.len * f, -30, 0.02)
          screw(s, p, nb.normal(q * E.len * f, -30), 0.18)
        }
      }
      // Intake: the fan face just inside the lip, its blades and the spinner (the nose turns a little towards the viewer).
      const ax = unit(V(X))
      const fc = W([E.x - 0.15, y, nacZ])
      s.poly(circleOn(fc, ax, r * 0.84, hero ? 32 : 16), 'shade', 'crease', undefined, 0.6)
      if (hero) {
        const F = frameAlong(fc, ax)
        const segs: P3[][] = []
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * 2 * Math.PI
          const p = (rr: number, da: number) =>
            add(fc, add(mul(F.u, rr * Math.cos(a + da)), mul(F.v, rr * Math.sin(a + da))))
          segs.push([p(0.3 * r, 0), p(0.8 * r, 0.3)])
        }
        s.segs(segs, 'detail', 0.5)
        const cone = spline([
          [0, 0.24 * r],
          [0.2 * r, 0.19 * r],
          [0.4 * r, 0],
        ])
        latheX(
          [E.x - 0.15 - 0.4 * r, y, nacZ],
          (t) => ({ r: Math.max(0, cone(t)[0]) }),
          0,
          0.4 * r,
          {
            steps: 6,
            ring: 20,
            shade: true,
            caps: false,
          },
        )
      }
      // Pylon: from the nacelle's crown up into the wing, its leading edge slanting back to the wing's.
      const rw = row(E.y)
      foil(
        s,
        [
          {
            le: W([E.x - E.len * 0.28, y, nacZ + r * 0.96]),
            te: W([xr + E.len * 0.04, y, nacZ + r * 0.9]),
            t: r * 0.28,
          },
          {
            le: W([rw.le + 1, y, zBot(E.y) + 0.8]),
            te: W([rw.te + r * 0.7, y, zBot(E.y) + 0.8]),
            t: r * 0.24,
          },
        ],
        { up: V(Y), nose: hero ? 2 : 1 },
      )
    }
    /** A gear leg: oleo from the airframe, piston to the axle, twin wheels on a cross axle, torque link. */
    const gearLeg = (top: P3, axle: P3, o: { r: number; w: number; leg: number }) => {
      const { r, w, leg } = o
      const gap = w / 2 + leg * 1.6
      const wheelAt = (dy: number) => wheel(s, W(add(axle, [0, dy, 0])), V(Y), r, w, hero)
      wheelAt(-gap)
      tube(s, W(add(axle, [0, -gap, 0])), W(add(axle, [0, gap, 0])), leg * 0.55, { shade: hero })
      const mid: P3 = [
        axle[0] + 0.45 * (top[0] - axle[0]),
        axle[1],
        axle[2] + 0.45 * (top[2] - axle[2]),
      ]
      tube(s, W(mid), W(top), leg, { shade: hero })
      tube(s, W(axle), W(mid), leg * 0.62, { shade: hero })
      if (hero) {
        const a = add(mid, [leg * 1.3, 0, -leg * 0.4]),
          b = add(axle, [leg * 1.3, 0, leg * 1.8])
        s.line(
          [W(add(mid, [leg * 0.6, 0, 0])), W(a), W(b), W(add(axle, [leg * 0.5, 0, leg * 1.2]))],
          'line',
          0.9,
        )
        screw(s, W(a), V(Y), 0.22)
      }
      wheelAt(gap)
    }
    const G = P.gear
    const mainGear = (sg: number) => {
      const y = sg * G.y
      gearLeg([G.x, y, zBot(G.y) + 0.4], [G.x, y, GROUND + G.r], { r: G.r, w: G.w, leg: G.leg })
    }
    const st = P.stab
    const stab = (sg: number) => {
      const z = sec(st.le - st.chord * 0.5).lift ?? Zc
      const yl = sg > 0 ? skinY(st.le, z) : 0,
        yt = sg > 0 ? skinY(st.le - st.chord, z) : 0
      const tl = st.le - Math.tan(st.sweep * D2R) * st.span
      const sts: FoilStation[] = [
        { le: W([st.le, sg * yl, z]), te: W([st.le - st.chord, sg * yt, z]), t: st.t },
        {
          le: W([tl, sg * st.span, z + st.span * 0.06]),
          te: W([tl - st.tip, sg * st.span, z + st.span * 0.06]),
          t: st.t * 0.45,
        },
      ]
      const f = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: hero ? 3 : 1 })
      if (hero) f.line(0, 0.7, 1, 0.7)
    }

    // ---------------------------------------------------------------- far side, under the barrel
    stab(-1)
    engine(-1)
    fairings(-1)
    mainGear(-1)
    wingPanel(-1)
    if (hero) winglet(-1)
    const noseGearX = noseStart + 3
    gearLeg([noseGearX, 0, bellyZ(noseGearX) + 0.6], [noseGearX + 0.6, 0, GROUND + G.r * 0.8], {
      r: G.r * 0.8,
      w: G.w * 0.85,
      leg: G.leg * 0.8,
    })

    // ---------------------------------------------------------------- fuselage
    const L = noseTip - tailTip
    const b = latheX([0, 0, 0], sec, tailTip, noseTip, {
      steps: Math.round(L / (hero ? 2.4 : 5)),
      ring: hero ? 40 : 18,
      shade: hero,
    })
    /** Body helpers in local x. */
    const at = (x: number, deg: number, lift = 0) => b.at(q * x, deg, lift)
    const patch = (
      corners: readonly (readonly [number, number])[],
      fill: Paint,
      stroke: Paint,
      w?: number,
    ) =>
      b.patch(
        corners.map(([x, d]) => [q * x, d] as const),
        fill,
        stroke,
        w,
      )
    /** A rounded rectangle on the near flank: x0..x1 along the barrel, d0..d1 degrees round it, corner radius rr (local x units). */
    const panel = (
      x0: number,
      x1: number,
      d0: number,
      d1: number,
      rr: number,
      fill: Paint,
      stroke: Paint,
      w?: number,
    ) => {
      const per = R * D2R
      patch(
        roundRect(x0, d0 * per, x1 - x0, (d1 - d0) * per, rr, 3).map(
          ([x, h]) => [x, h / per] as const,
        ),
        fill,
        stroke,
        w,
      )
    }
    const lim = b.limbs(q * (AFT.x1 / 2))!
    const [LO, HI] = lim

    /** A ring of rivet dots at x across the visible flank, fading out towards the limbs. */
    const rivets = (x: number, paint: Paint) => {
      const step = 1.15 / R / D2R
      for (let a = LO + step / 2; a < HI; a += step) {
        const f = Math.min(1, (a - LO) / 26, (HI - a) / 26)
        if (f < 0.3) continue
        s.poly(circleOn(at(x, a, 0.01), b.normal(q * x, a), 0.16 * f, 6), paint, 'none')
      }
    }
    /** A plug joint: the skin butt line, the strap's two edges and two rivet rows either side of the butt. */
    const splice = (x: number, line: Paint, crease: Paint, lit = false) => {
      b.seam(q * x, line, lit ? 1.2 : 0.8)
      if (!hero) return
      b.seam(q * (x - 1.6), crease, 0.5)
      b.seam(q * (x + 1.6), crease, 0.5)
      for (const d of [-1.1, -0.6, 0.6, 1.1])
        rivets(x + d, lit ? 'accent' : crease === 'crease' ? 'crease' : line)
    }
    const D = P.door
    const door = (xc: number, stroke: Paint, w: number) => {
      const hw = D.w / 2 / q
      panel(xc - hw, xc + hw, D.d0, D.d1, 0.55 / q, 'none', stroke, w)
    }
    const doorDetail = (xc: number) => {
      // The door's own window, its handle recess and the hinge side's two hinge marks.
      panel(xc - 0.55, xc + 0.55, 15, 29, 0.4, 'glass', 'crease', 0.5)
      panel(xc - 0.5, xc + 0.5, -6, -1, 0.2, 'side', 'crease', 0.4)
      for (const d of [-26, 38]) screw(s, at(xc - 0.85, d, 0.01), b.normal(q * xc, d), 0.14)
    }
    const doors = layout.flatMap((sec) => sec.doors)

    // Production joints (tail cone, nose section) are plain seams; plug joints are splices.
    const plugJoints = [...new Set(plugs.flatMap((p) => [p.x0, p.x1]))].filter(
      (x) => x !== newest.x0 && x !== newest.x1,
    )
    b.seam(0, 'crease', 0.6)
    b.seam(q * noseStart, 'crease', 0.6)
    if (hero) {
      // Frame lines on the tail cone and the nose, and the forward barrel's own production joint.
      for (const x of [-10, -22]) b.seam(q * x, 'crease', 0.5)
      b.seam(q * (noseStart + P.nose * 0.3), 'crease', 0.5)
      // Lap joint along the barrel above the window belt, clear of the door tops.
      b.along(58, 0, q * noseStart, 'crease', 0.5)
    }
    for (const x of plugJoints) splice(x, 'line', 'crease')

    if (hero) {
      // Cabin windows, evenly pitched in each barrel, clear of doors and joints.
      const per = R * D2R
      for (const bar of layout) {
        const a = bar.x0 + 2.4,
          z = bar.x1 - 2.4
        const n = Math.floor((z - a) / 2.6) + 1
        const off = (z - a - (n - 1) * 2.6) / 2
        for (let i = 0; i < n; i++) {
          const x = a + off + i * 2.6
          if (doors.some((d) => Math.abs(x - d) < 2.6)) continue
          if (bar === layout[0] && x > 17.6 && x < 22.4) continue
          panel(x - 0.65, x + 0.65, 20 - 0.9 / per, 20 + 0.9 / per, 0.45, 'glass', 'crease', 0.6)
        }
      }
      // Overwing exit hatch, forward cargo door and its hinge line.
      panel(18.6, 21.4, 2, 36, 0.4, 'none', 'crease', 0.6)
      panel(20 - 0.6, 20 + 0.6, 20 - 0.9 / per, 20 + 0.9 / per, 0.45, 'glass', 'crease', 0.6)
      const fwd = layout[layout.length - 1]
      panel(fwd.x0 + 3.5, fwd.x0 + 9.5, -50, -22, 0.5, 'none', 'crease', 0.6)
      b.along(-22, q * (fwd.x0 + 4.2), q * (fwd.x0 + 8.8), 'crease', 0.4)
      // Wing-to-body fairing: a closed lens on the lower flank over the wing root.
      const lens = (sign: 1 | -1) =>
        Array.from({ length: 11 }, (_, i) => {
          const u = i / 10
          return [AFT.x1 - 34 * u - 1, -38 + sign * 10 * Math.sin(Math.PI * u)] as const
        })
      patch([...lens(1), ...lens(-1).reverse()], 'none', 'crease', 0.5)
      // Anti-collision beacon on the crown, a blade antenna ahead of it, and the static-port plate under the cockpit.
      disc(s, W([12, 0, crownZ(12) + 0.2]), Z, R * 0.09, 0.5, { shade: true })
      foil(
        s,
        [
          {
            le: W([R * 3.2, 0, crownZ(R * 3.2) - 0.1]),
            te: W([R * 2.6, 0, crownZ(R * 2.6) - 0.1]),
            t: 0.4,
          },
          {
            le: W([R * 2.75, 0, crownZ(R * 2.75) + R * 0.22]),
            te: W([R * 2.55, 0, crownZ(R * 2.55) + R * 0.22]),
            t: 0.3,
          },
        ],
        { up: V(Y), nose: 1 },
      )
      panel(noseStart + 2.2, noseStart + 3.6, -14, -2, 0.3, 'none', 'crease', 0.4)
      for (const d of [-11, -5])
        screw(s, at(noseStart + 2.9, d, 0.01), b.normal(q * (noseStart + 2.9), d), 0.16)
    } else {
      // Thumb: the window belt as one line per barrel, broken at the doors.
      for (const bar of layout) {
        const cuts = [
          bar.x0 + 2,
          ...bar.doors.flatMap((d) => [d - D.w / 2 / q - 1.5, d + D.w / 2 / q + 1.5]),
          bar.x1 - 2,
        ]
        for (let i = 0; i + 1 < cuts.length; i += 2)
          if (cuts[i + 1] - cuts[i] > 2) b.along(20, q * cuts[i], q * cuts[i + 1], 'crease', 0.8)
      }
    }
    // Doors outside the newest plug.
    for (const bar of layout)
      if (bar !== newest)
        for (const d of bar.doors) {
          door(d, 'line', hero ? 0.7 : 1)
          if (hero) doorDetail(d)
        }
    if (hero) for (const d of newest.doors) doorDetail(d)

    // Cockpit glazing: windscreen and side panes, with the eyebrow frame between them.
    const nl = P.nose
    patch(
      [
        [noseStart + nl * 0.36, 34],
        [noseStart + nl * 0.56, 40],
        [noseStart + nl * 0.56, 72],
        [noseStart + nl * 0.36, 76],
      ],
      'glass',
      'line',
      hero ? 0.8 : 1,
    )
    patch(
      [
        [noseStart + nl * 0.12, 30],
        [noseStart + nl * 0.33, 32],
        [noseStart + nl * 0.33, 74],
        [noseStart + nl * 0.12, 70],
      ],
      'glass',
      'crease',
    )
    if (hero) {
      // Radome joint and the pitot probe below the side pane.
      b.seam(q * (noseStart + nl * 0.8), 'crease', 0.5)
      const pp = at(noseStart + nl * 0.24, 8)
      tube(s, pp, add(pp, V([1.6, 0.6, -0.1])), 0.13)
    }

    // ---------------------------------------------------------------- the newest plug, lit
    s.group('lit', () => {
      const x0 = newest.x0,
        x1 = newest.x1
      const lineAlong = (deg: number) =>
        Array.from({ length: 25 }, (_, i) => at(x0 + ((x1 - x0) * i) / 24, deg))
      // A faint wash over the plug's visible skin (never a slab), then its outline: both joints and the silhouette between them.
      s.poly(
        [...lineAlong(LO + 0.5), ...lineAlong(HI - 0.5).reverse()],
        'accent',
        'none',
        undefined,
        undefined,
        hero ? 0.16 : 0.22,
      )
      if (hero)
        s.glow(2, () => {
          b.seam(q * x0, 'accent', 1.4)
          b.seam(q * x1, 'accent', 1.4)
        })
      splice(x0, 'accent', 'accent', true)
      splice(x1, 'accent', 'accent', true)
      b.along(LO + 0.3, q * x0, q * x1, 'accent', hero ? 1.1 : 1.4)
      b.along(HI - 0.3, q * x0, q * x1, 'accent', hero ? 1.1 : 1.4)
      for (const d of newest.doors) door(d, 'accent', hero ? 1 : 1.3)
    })

    // ---------------------------------------------------------------- tail, near side
    const F = P.fin
    const finRoot = (x: number) => crownZ(x, F.t / 2) - 0.1
    const tipLE = F.le - Math.tan(F.sweep * D2R) * F.h
    const finTop = crownZ(F.le) + F.h
    const fin = foil(
      s,
      [
        {
          le: W([F.le, 0, finRoot(F.le)]),
          te: W([F.le - F.chord, 0, finRoot(F.le - F.chord)]),
          t: F.t,
        },
        { le: W([tipLE, 0, finTop]), te: W([tipLE - F.tip, 0, finTop]), t: F.t * 0.5 },
      ],
      { up: V(Y), nose: hero ? 3 : 1 },
    )
    if (hero) {
      // Rudder hinge line and its tab, and the dorsal fillet's joint.
      fin.line(0, 0.7, 1, 0.68)
      fin.line(0.12, 0.7, 0.12, 1)
      fin.line(0.55, 0.7, 0.55, 1)
    }
    stab(1)
    if (hero)
      disc(s, W([tailTip - 0.4, 0, sec(tailTip).lift ?? Zc]), V(X), 0.55, 1, {
        shade: true,
        ring: 16,
      })
    mainGear(1)
    engine(1)
    fairings(1)
    wingPanel(1)
    if (hero) winglet(1)

    const data = s.done()
    if (rung < 3) return data
    // Top rung: the frame cuts the tail off, so only the fin's leading edge peeks in. The figure's box starts at the cut,
    // and the drawing is clipped to it.
    const cut = s.project(W([CROP_X, 0, 0]))[0]
    const [vx, vy, vw, vh] = data.viewBox.split(' ').map(Number)
    if (cut <= vx) return data
    const width = Math.ceil(vx + vw - cut)
    const clip = [
      [cut, vy - 20],
      [vx + vw + 20, vy - 20],
      [vx + vw + 20, vy + vh + 20],
      [cut, vy + vh + 20],
    ]
      .map(([a, c]) => `${Math.round(a * 10) / 10},${Math.round(c * 10) / 10}`)
      .join(' ')
    const framed: IsoNode = { kind: 'group', part: 'frame', clip, children: data.nodes }
    return {
      ...data,
      width,
      viewBox: `${Math.round(cut * 10) / 10} ${vy} ${width} ${vh}`,
      shadowBounds: data.shadowBounds && {
        ...data.shadowBounds,
        x: Math.max(data.shadowBounds.x, Math.round(cut * 10) / 10),
        width: Math.ceil(
          data.shadowBounds.x + data.shadowBounds.width - Math.max(data.shadowBounds.x, cut),
        ),
      },
      nodes: [framed],
    }
  },
}
