// A lane airliner, one per ICAO type, from the measured geometry in packages/data/src/aircraft-geometry (SCHEMA.md),
// drawn with the ladder figures' parts (lathe, foil, wheel) so it shares their tones, lines and craft. The fin wears the
// member's livery (the accent ramp, which the lane points at --lane-livery); every other part is the neutral grey.
//
// Frame: metres; local x = −(geometry x), so the nose tip sits at x = 0 and the tail at −length; +y is the near flank;
// z is up from the ground. Estimated here, not in the data: belly height, gear stations, track and wheel sizes,
// bogies on the widebodies, door and window stations, wing and tail thickness.

import type { P3, Paint } from '../../../overview/iso/scene'
import {
  ACCENT,
  add,
  circleOn,
  disc,
  foil,
  frameAlong,
  lathe,
  mul,
  spline,
  tube,
  unit,
  wheel,
  D2R,
  type FoilStation,
  type LatheOpts,
  type Section,
} from '../../../profile/ladders/figures/parts'
import { W, type LaneScene } from './lane-scene'

/** The fields of a SCHEMA.md record the drawing reads. */
export type AircraftGeometry = {
  icao: string
  name: string
  dims: { length: number; span: number; fuselageWidth: number; fuselageHeight: number }
  fuselage: {
    noseLength: number
    tailconeLength: number
    tailUpsweep: number
    cockpitWindowX: number
    decks: number
    end?: number
    mainDeckWindowZ?: number
    upperDeckWindowZ?: number
  }
  wing: {
    position: 'low' | 'high'
    rootLEx: number
    rootChord: number
    kinkY: number | null
    tipChord: number
    sweepLE: number
    dihedral: number
    leBreakY?: number
    sweepLEInboard?: number
  }
  wingtip: {
    type: 'none' | 'fence' | 'sharklet' | 'blended' | 'raked' | 'at-winglet' | 'curved'
    height: number
    below: number
    cant: number
    rootY?: number
    rakeLE?: { x: number; y: number }[]
    rakeTE?: { x: number; y: number }[]
  }
  htail: {
    position: 'fuselage' | 't-tail'
    rootY?: number
    rootLEx: number
    span: number
    rootChord: number
    tipChord: number
    sweepLE: number
    dihedral: number
    zBelowFinTop?: number
    tipLEx?: number
    tipTEx?: number
  }
  vtail: { rootLEx: number; height: number; rootChord: number; tipChord: number; sweepLE: number }
  engines: {
    y: number
    fanX: number
    nacelleDiameter: number
    nacelleLength: number
    dropBelowWing: number
    prop: { diameter: number } | null
    exhaustLength?: number
  }[]
}

const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]
const V = W
const tan = (deg: number) => Math.tan(deg * D2R)

/** Draws the airliner; returns where its tail ends and the ground line's y (under the near main wheels). */
export function airliner(s: LaneScene, g: AircraftGeometry): { tail: number; groundY: number } {
  const Lb = g.fuselage.end ?? g.dims.length
  const R = g.dims.fuselageWidth / 2,
    H = g.dims.fuselageHeight / 2
  const nl = g.fuselage.noseLength,
    tc = g.fuselage.tailconeLength
  const high = g.wing.position === 'high'
  const wide = R > 2.4
  const half = g.dims.span / 2

  // ------------------------------------------------------------ wing planform (geometry x, aft from the nose)
  const wg = g.wing,
    tip = g.wingtip
  const lean =
    tip.type === 'raked' || tip.type === 'none'
      ? 0
      : Math.max(tip.height, tip.type === 'at-winglet' ? tip.below : 0) * Math.sin(tip.cant * D2R)
  const rake = tip.type === 'raked' && tip.rakeLE?.length ? tip.rakeLE : null
  const tipY = rake ? rake[0].y : (tip.rootY ?? half - lean)
  /** The body side the wing root meets (the wing chord plane cuts the barrel below its widest line on a low wing). */
  const y0 = R * (high ? 0.55 : 0.84)
  const leX = (y: number) => {
    const b = wg.leBreakY
    if (b != null && wg.sweepLEInboard != null)
      return y <= b
        ? wg.rootLEx + tan(wg.sweepLEInboard) * (y - y0)
        : wg.rootLEx + tan(wg.sweepLEInboard) * (b - y0) + tan(wg.sweepLE) * (y - b)
    return wg.rootLEx + tan(wg.sweepLE) * (y - y0)
  }
  const rootTE = wg.rootLEx + wg.rootChord
  const tipTE = leX(tipY) + wg.tipChord
  const teX = (y: number) => {
    const k = wg.kinkY
    if (k != null && k > y0 && y <= k) return rootTE
    const from = k != null && k > y0 ? k : y0
    return rootTE + ((tipTE - rootTE) * (y - from)) / (tipY - from)
  }
  const thick = (y: number) => {
    const u = Math.min(1, Math.max(0, (y - y0) / (tipY - y0)))
    return Math.max(0.12, (1 - u) * 0.13 * wg.rootChord + u * 0.1 * wg.tipChord)
  }
  const tanD = Math.tan(wg.dihedral * D2R)

  // ------------------------------------------------------------ heights
  // The wing's chord plane at the root sits a fixed fraction up the barrel; the belly is as high as the larger of a
  // proportional stance and the clearance the lowest nacelle needs.
  const rootUp = high ? 2 * H - 0.02 * H : 0.45 * H
  const nacelleLow = (e: AircraftGeometry['engines'][number]) =>
    rootUp + tanD * (e.y - y0) - thick(e.y) / 2 - e.dropBelowWing - e.nacelleDiameter / 2
  const belly = Math.max(
    0.42 * 2 * H,
    ...g.engines.map((e) => (e.prop ? 0.9 : 0.55) - nacelleLow(e)),
  )
  const zc = belly + H
  const zRoot = belly + rootUp
  const zChord = (y: number) => zRoot + tanD * (Math.abs(y) - y0)

  // ------------------------------------------------------------ fuselage
  const upsweep = g.fuselage.tailUpsweep
  const sec = (xg: number): Section => {
    if (xg < nl) {
      const u = 1 - Math.max(0, xg) / nl
      const f = Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 1 / 2.4)
      return { r: R * f, rz: H * f, lift: zc - 0.3 * H * u * u }
    }
    if (xg > Lb - tc) {
      const u = Math.min(1, (xg - (Lb - tc)) / tc)
      const rz = H * (1 - 0.86 * Math.pow(u, 1.25))
      return { r: R * (1 - 0.86 * Math.pow(u, 1.15)), rz, lift: zc + upsweep * Math.pow(u, 1.6) }
    }
    return { r: R, rz: H, lift: zc }
  }
  const skinY = (xg: number, z: number) => {
    const { r, rz = r, lift = 0 } = sec(xg)
    const t = (z - lift) / rz
    return Math.abs(t) >= 1 ? 0 : r * Math.sqrt(1 - t * t)
  }
  const crownZ = (xg: number) => {
    const { r, rz = r, lift = 0 } = sec(xg)
    return lift + rz
  }
  const latheX = (o: P3, f: (x: number) => Section, x0: number, x1: number, opts: LatheOpts) =>
    lathe(s, frameAlong(W(o), V(X)), f, x0, x1, opts)

  // ------------------------------------------------------------ shadow on the ground
  {
    const sp = (y: number) => (y <= tipY ? y : tipY)
    const near: [number, number][] = [
      [0, 0],
      [-nl * 0.5, R * 0.8],
      [-leX(y0), R],
      [-leX(sp(tipY)), tipY],
      [-teX(tipY), tipY],
      [-teX(y0), R],
      [-(Lb - tc), R],
      [-(Lb - 0.5), 0.4],
    ]
    const h = zRoot
    const dx = 0.15 * h,
      dy = -0.35 * h
    s.poly(
      [
        ...near.map(([x, y]) => W([x + dx, y + dy, 0.02])),
        ...[...near].reverse().map(([x, y]) => W([x + dx, -y + dy, 0.02])),
      ],
      'shadow',
      'none',
    )
  }

  // ------------------------------------------------------------ parts, each for one side
  const wingStation = (y: number): FoilStation => {
    const z = zChord(y)
    return {
      le: W([-leX(Math.abs(y)), y, z]),
      te: W([-teX(Math.abs(y)), y, z]),
      t: thick(Math.abs(y)),
    }
  }
  const rakeStations = (sg: number): FoilStation[] =>
    rake
      ? rake.slice(1).map((p, i) => {
          const te = tip.rakeTE![i + 1] ?? p
          const z = zChord(p.y)
          const t = Math.max(0.08, thick(tipY) * (1 - (i + 1) / rake.length))
          return {
            le: W([-p.x, sg * p.y, z]),
            te: W([-Math.max(te.x, p.x + 0.12), sg * p.y, z]),
            t,
          }
        })
      : []
  const wingPanel = (sg: number) => {
    const ys = [
      high ? 0 : sg > 0 ? y0 : 0,
      ...[wg.leBreakY, wg.kinkY].filter(
        (y): y is number => y != null && y > y0 + 0.3 && y < tipY - 0.3,
      ),
      tipY,
    ].sort((a, b) => a - b)
    const sts = [...ys.map((y) => wingStation(sg * y)), ...rakeStations(sg)]
    const w = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: 3 })
    if (sg < 0) return
    // Flap hinge line and its cut at the aileron, and the front spar.
    const n = sts.length - 1
    const at = (y: number) => {
      // Fractional station index of span y.
      let i = 0
      while (i < ys.length - 2 && y > ys[i + 1]) i++
      return i + (y - ys[i]) / (ys[i + 1] - ys[i])
    }
    const ail = at(y0 + (tipY - y0) * 0.68)
    w.line(0, 0.74, ail, 0.76)
    w.line(ail, 0.76, at(tipY) - 0.05, 0.78)
    w.line(ail, 0.76, ail, 1)
    w.line(0, 0.16, Math.min(n, at(tipY)), 0.16)
  }
  const winglet = (sg: number) => {
    if (tip.type === 'none' || tip.type === 'raked') return
    const zt = zChord(tipY)
    const le = leX(tipY),
      te = teX(tipY)
    const c = te - le
    const cant = tip.cant * D2R
    const blade = (h: number, dir: 1 | -1, chordTip: number) => {
      const out = h * Math.sin(cant)
      const up = dir * h * Math.cos(cant)
      const curved = tip.type === 'curved' || tip.type === 'blended' || tip.type === 'sharklet'
      const sts: FoilStation[] = [
        {
          le: W([-(le + 0.1), sg * tipY, zt]),
          te: W([-(te - 0.05), sg * tipY, zt]),
          t: Math.max(0.1, thick(tipY) * 0.9),
        },
      ]
      if (curved)
        sts.push({
          le: W([-(le + c * 0.45), sg * (tipY + out * 0.25), zt + up * 0.35]),
          te: W([-(te - c * 0.05), sg * (tipY + out * 0.25), zt + up * 0.35]),
          t: 0.12,
        })
      sts.push({
        le: W([-(le + c * 0.9 + h * 0.35), sg * (tipY + out), zt + up]),
        te: W([-(le + c * 0.9 + h * 0.35 + chordTip), sg * (tipY + out), zt + up]),
        t: 0.08,
      })
      foil(s, sts, { up: V([0, sg, 0]), nose: 2 })
    }
    if (tip.height > 0) blade(tip.height, 1, Math.max(0.25, c * 0.3))
    if (tip.below > 0) blade(tip.below, -1, Math.max(0.2, c * 0.35))
  }

  const engine = (e: AircraftGeometry['engines'][number], sg: number) => {
    const y = sg * e.y
    const r = e.nacelleDiameter / 2
    const xf = -e.fanX,
      len = e.nacelleLength
    const zw = zChord(e.y) - thick(e.y) / 2
    const nz = zw - e.dropBelowWing
    if (e.prop) {
      // Turboprop nacelle: a long round body under the high wing, the spinner and four blades in front.
      const body = spline([
        [0, 0.55],
        [0.12, 0.95],
        [0.5, 1],
        [0.8, 0.85],
        [1, 0.25],
      ])
      latheX(
        [xf - len, y, 0],
        (t) => ({
          r: r * body(1 - (t - 0) / len)[0],
          rz: r * 1.35 * body(1 - t / len)[0],
          lift: nz,
        }),
        0,
        len,
        {
          steps: 12,
          ring: 24,
          shade: true,
          caps: false,
        },
      )
      const cone = spline([
        [0, 0.55 * r],
        [0.35, 0.42 * r],
        [0.8, 0],
      ])
      latheX([xf, y, nz], (t) => ({ r: Math.max(0, cone(t)[0]) }), 0, 0.8, {
        steps: 5,
        ring: 16,
        shade: true,
        caps: false,
      })
      const hub = W([xf + 0.15, y, nz])
      const F = frameAlong(hub, V(X))
      const D = e.prop.diameter / 2
      // The blur of the turning disc: a faint ring, then four blades.
      s.poly(circleOn(hub, F.a, D, 40), 'none', 'crease', 0.55, 0.5)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * 2 * Math.PI + 0.5
        const dir = add(mul(F.u, Math.cos(a)), mul(F.v, Math.sin(a)))
        const side = add(mul(F.u, -Math.sin(a)), mul(F.v, Math.cos(a)))
        const p = (rr: number, w: number) => add(add(hub, mul(dir, rr)), mul(side, w))
        s.poly(
          [
            p(0.3, -0.16),
            p(D * 0.6, -0.14),
            p(D, -0.06),
            p(D, 0.06),
            p(D * 0.6, 0.12),
            p(0.3, 0.12),
          ],
          'front',
          'line',
          undefined,
          0.6,
        )
      }
      return
    }
    // Exhaust plug and core cowl, then the fan cowl and its inlet lip.
    const ex = e.exhaustLength ?? len * 0.3
    const xr = xf - len
    const plug = spline([
      [0, 0.42 * r],
      [0.5 * ex, 0.3 * r],
      [ex, 0.04 * r],
    ])
    latheX([xr - ex, y, nz], (t) => ({ r: Math.max(0.02, plug(ex - t)[0]) }), 0, ex, {
      steps: 3,
      ring: 14,
      shade: true,
      caps: false,
    })
    const prof = spline([
      [0, 0.66],
      [0.15, 0.84],
      [0.5, 0.98],
      [0.8, 1],
      [1, 0.94],
    ])
    const nb = latheX([xr, y, nz], (t) => ({ r: r * prof(t / len)[0] }), 0, len, {
      steps: 6,
      ring: 20,
      shade: true,
      caps: false,
    })
    if (sg > 0) {
      nb.seam(len * 0.36)
      nb.seam(len * 0.82, 'crease', 0.5)
    }
    // Intake: the dark fan face just inside the lip and the spinner.
    const ax = unit(V(X))
    const fc = W([xf - 0.12, y, nz])
    s.poly(circleOn(fc, ax, r * 0.84, 20), 'shade', 'crease', undefined, 0.5)
    const cone = spline([
      [0, 0.24 * r],
      [0.2 * r, 0.18 * r],
      [0.42 * r, 0],
    ])
    latheX([xf - 0.12 - 0.42 * r, y, nz], (t) => ({ r: Math.max(0, cone(t)[0]) }), 0, 0.42 * r, {
      steps: 3,
      ring: 12,
      shade: true,
      caps: false,
    })
    // Pylon: from the nacelle's crown up into the wing.
    const le = leX(e.y),
      te = teX(e.y)
    foil(
      s,
      [
        {
          le: W([xf - len * 0.18, y, nz + r * 0.92]),
          te: W([xr + len * 0.1, y, nz + r * 0.86]),
          t: r * 0.32,
        },
        {
          le: W([-(le - 0.5), y, zw + 0.15]),
          te: W([-Math.min(te, le + (te - le) * 0.8), y, zw + 0.15]),
          t: r * 0.26,
        },
      ],
      { up: V(Y), nose: 2 },
    )
  }

  // Landing gear: an oleo leg from the airframe to the axle, the wheels on a cross axle.
  const wheelR = high ? 0.42 : wide ? 0.62 : 0.56
  const wheelW = wheelR * 0.62
  const leg = wheelR * 0.2
  const pair = (xg: number, y: number, top: number, r = wheelR) => {
    const gap = wheelW / 2 + leg * 1.4
    const axle: P3 = [-xg, y, r]
    const wheelAt = (dy: number) => wheel(s, W(add(axle, [0, dy, 0])), V(Y), r, wheelW, false)
    wheelAt(-gap)
    tube(s, W(add(axle, [0, -gap, 0])), W(add(axle, [0, gap, 0])), leg * 0.5)
    tube(s, W(axle), W([-xg, y, top]), leg)
    wheelAt(gap)
  }
  const bogie = (xg: number, y: number, top: number, axles: number) => {
    const pitch = wheelR * 2.3
    const xs = Array.from({ length: axles }, (_, i) => xg + (i - (axles - 1) / 2) * pitch)
    const gap = wheelW / 2 + leg * 1.4
    const ax = (x: number): P3 => [-x, y, wheelR]
    for (const x of xs) wheel(s, W(add(ax(x), [0, -gap, 0])), V(Y), wheelR, wheelW, false)
    for (const x of xs) tube(s, W(add(ax(x), [0, -gap, 0])), W(add(ax(x), [0, gap, 0])), leg * 0.5)
    tube(s, W(add(ax(xs[0]), [0, 0, 0.1])), W(add(ax(xs[xs.length - 1]), [0, 0, 0.1])), leg * 0.7)
    tube(s, W([-xg, y, wheelR + 0.1]), W([-xg, y, top]), leg)
    for (const x of xs) wheel(s, W(add(ax(x), [0, gap, 0])), V(Y), wheelR, wheelW, false)
  }
  const mainX = wg.rootLEx + wg.rootChord * 0.78
  const track = R * (wide ? 0.9 : 0.96)
  const mainGear = (sg: number) => {
    if (high) {
      // Into the nacelle on a high-wing turboprop.
      const e = g.engines[0]
      const zw = zChord(e.y) - thick(e.y) / 2 - e.dropBelowWing - e.nacelleDiameter * 0.5
      pair(e.fanX + e.nacelleLength * 0.42, sg * e.y, zw)
      return
    }
    const top = belly + 0.3 * H
    if (wide) bogie(mainX, sg * track, top, g.engines.length > 1 ? 2 : 2)
    else pair(mainX, sg * track, top)
    // The A380's body gear: three axles behind the wing gear, closer in.
    if (g.engines.length > 1) bogie(mainX + 3.6, sg * R * 0.55, belly + 0.15, 3)
  }

  const ht = g.htail
  const stab = (sg: number) => {
    const t = ht.position === 't-tail'
    const rootY = t ? 0 : (ht.rootY ?? R * 0.8)
    const tipLE = ht.tipLEx ?? ht.rootLEx + tan(ht.sweepLE) * (ht.span / 2 - rootY)
    const tipTE = ht.tipTEx ?? tipLE + ht.tipChord
    const zRootS = t
      ? crownZ(g.vtail.rootLEx) + g.vtail.height - (ht.zBelowFinTop ?? 0.25)
      : (sec(ht.rootLEx + ht.rootChord * 0.4).lift ?? zc)
    const yRoot = t ? 0 : sg > 0 ? Math.max(rootY, skinY(ht.rootLEx, zRootS) * 0.98) : 0
    const zt = zRootS + Math.tan(ht.dihedral * D2R) * (ht.span / 2 - rootY)
    const sts: FoilStation[] = [
      {
        le: W([-ht.rootLEx, sg * yRoot, zRootS]),
        te: W([-(ht.rootLEx + ht.rootChord), sg * yRoot, zRootS]),
        t: ht.rootChord * 0.11,
      },
      {
        le: W([-tipLE, sg * (ht.span / 2), zt]),
        te: W([-tipTE, sg * (ht.span / 2), zt]),
        t: ht.tipChord * 0.1,
      },
    ]
    const f = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: 2 })
    if (sg > 0) f.line(0, 0.7, 1, 0.7)
  }

  // ------------------------------------------------------------ far side, under and behind the barrel
  if (ht.position !== 't-tail') stab(-1)
  for (const e of g.engines) engine(e, -1)
  mainGear(-1)
  if (!high) {
    wingPanel(-1)
    winglet(-1)
  }
  const noseX = nl * 0.86
  pair(noseX, 0, belly + 0.25 * H, wheelR * 0.8)

  // ------------------------------------------------------------ fuselage
  const b = latheX([0, 0, 0], (t) => sec(-t), -Lb, 0, {
    steps: Math.round(Lb / 2),
    ring: 28,
    shade: true,
  })
  const at = (xg: number, deg: number, lift = 0) => b.at(-xg, deg, lift)
  const patch = (
    corners: readonly (readonly [number, number])[],
    fill: Paint,
    stroke: Paint,
    w?: number,
  ) =>
    b.patch(
      corners.map(([xg, d]) => [-xg, d] as const),
      fill,
      stroke,
      w,
    )
  /** The angle round the barrel of a height above the belly on the constant section. */
  const degAt = (zAbove: number) => Math.asin(Math.max(-1, Math.min(1, (zAbove - H) / H))) / D2R
  // Production joints: nose section and tail cone.
  b.seam(-nl, 'crease', 0.5)
  b.seam(-(Lb - tc), 'crease', 0.5)

  // Doors: the forward and aft pair always, more between them on longer barrels.
  const d0 = Math.max(nl * 0.85, g.fuselage.cockpitWindowX + 1.2),
    d1 = Lb - tc + 0.6
  const doorCount = Math.max(2, Math.round((d1 - d0) / (wide ? 13 : 12)) + 1)
  const doors = Array.from({ length: doorCount }, (_, i) => d0 + ((d1 - d0) * i) / (doorCount - 1))
  const doorH = Math.min(1.9, 2 * H * 0.5)
  const sill = H * 0.62
  const decks = g.fuselage.decks
  const deckRows =
    decks > 1
      ? [g.fuselage.mainDeckWindowZ ?? 2 * H * 0.42, g.fuselage.upperDeckWindowZ ?? 2 * H * 0.78]
      : [H + H * 0.2]
  const per = R * D2R
  for (const [row, zw] of deckRows.entries()) {
    const deg = degAt(zw)
    const hh = 0.3 / per
    const pitch = 0.53 * (wide ? 1.05 : 1)
    const from = (row === 0 ? d0 : d0 + 2.2) + 0.8,
      to = Lb - tc - 0.6
    for (let x = from; x < to; x += pitch) {
      if (doors.some((d) => Math.abs(x - d) < 0.8)) continue
      patch(
        [
          [x - 0.14, deg - hh],
          [x + 0.14, deg - hh],
          [x + 0.14, deg + hh],
          [x - 0.14, deg + hh],
        ],
        'crease',
        'none',
      )
    }
  }
  for (const [row, z0] of (decks > 1 ? [sill * 0.7, H * 1.18] : [sill]).entries()) {
    const lo = degAt(z0),
      hi = degAt(Math.min(2 * H * 0.94, z0 + doorH))
    for (const d of row === 0 ? doors : doors.slice(0, 3))
      patch(
        [
          [d - 0.42, lo],
          [d + 0.42, lo],
          [d + 0.42, hi],
          [d - 0.42, hi],
        ],
        'none',
        'crease',
        0.5,
      )
  }
  // Cockpit glazing: the windscreen and the side window behind it.
  const cw = g.fuselage.cockpitWindowX
  patch(
    [
      [cw - 1.25, 26],
      [cw - 0.55, 28],
      [cw - 0.55, 46],
      [cw - 1.1, 44],
    ],
    'glass',
    'line',
    0.6,
  )
  patch(
    [
      [cw - 2.1, 22],
      [cw - 1.4, 25],
      [cw - 1.25, 42],
      [cw - 1.75, 40],
    ],
    'glass',
    'line',
    0.6,
  )
  // Wing-to-body fairing on a low wing: a closed lens over the root.
  if (!high) {
    const lens = (sign: 1 | -1) =>
      Array.from({ length: 11 }, (_, i) => {
        const u = i / 10
        return [
          wg.rootLEx - 1 + (wg.rootChord + 3) * u,
          -40 + sign * 9 * Math.sin(Math.PI * u),
        ] as const
      })
    patch([...lens(1), ...[...lens(-1)].reverse()], 'none', 'crease', 0.5)
  }
  // Beacon on the crown.
  disc(s, W([-(wg.rootLEx + wg.rootChord * 0.4), 0, zc + H + 0.05]), Z, R * 0.08, 0.2, { ring: 12 })

  // ------------------------------------------------------------ tail: the fin in the livery
  const vt = g.vtail
  const finTipLE = vt.rootLEx + tan(vt.sweepLE) * vt.height
  const finTop = crownZ(vt.rootLEx) + vt.height
  const finRoot = (xg: number) => crownZ(Math.min(xg, Lb - 0.3)) - 0.06
  const fin = foil(
    s,
    [
      {
        le: W([-vt.rootLEx, 0, finRoot(vt.rootLEx)]),
        te: W([-(vt.rootLEx + vt.rootChord), 0, finRoot(vt.rootLEx + vt.rootChord)]),
        t: vt.rootChord * 0.1,
      },
      {
        le: W([-finTipLE, 0, finTop]),
        te: W([-(finTipLE + vt.tipChord), 0, finTop]),
        t: vt.tipChord * 0.1,
      },
    ],
    { up: V(Y), nose: 3, ramp: ACCENT },
  )
  fin.line(0, 0.7, 1, 0.68, 'accent-side', 0.6)
  if (ht.position === 't-tail') {
    stab(-1)
    stab(1)
  } else stab(1)

  // ------------------------------------------------------------ near side
  mainGear(1)
  if (high) {
    // The high wing is one piece over the barrel, tip to tip, with the near engine under it.
    wingPanel(-1)
    for (const e of g.engines) engine(e, 1)
    wingPanel(1)
    return { tail: -Lb, groundY: g.engines[0].y }
  }
  for (const e of g.engines) engine(e, 1)
  wingPanel(1)
  winglet(1)
  return { tail: -Lb, groundY: track }
}
