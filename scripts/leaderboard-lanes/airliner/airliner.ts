// A lane airliner built like a precise 1:N model: one per ICAO type from the measured geometry in
// packages/data/src/aircraft-geometry (SCHEMA.md), drawn with the pinned anatomy kit's camera, light and tone bands.
//
// Frame: metres; x points to the nose (the nose tip at x = 0, the tail at −length), +y is the near flank (toward the
// viewer; with the nose to the right that is the starboard side), z is up from the ground. "xg" is the records' station,
// aft from the nose (x = −xg).
//
// Estimated in the drawing, not in the data: belly height, nose shape between the measured stations, airfoil thickness,
// wheel track and tyre sizes (published values, rounded, by family), gear stations, door, exit, cargo-door and window
// stations, the inlet internals, flap-track fairing stations and the antenna positions.
import type { MultiPolygon } from 'polygon-clipping'
import {
  add,
  curveOn,
  dot,
  drawSurface,
  mul,
  normalAt,
  sub,
  unit,
  unionAll,
  type Camera,
  type Pt,
  type Surface,
  type V3,
} from './surface'

/** The fields of a SCHEMA.md record the drawing reads. */
export type AircraftGeometry = {
  icao: string
  name: string
  family: string
  dims: {
    length: number
    span: number
    height: number
    fuselageWidth: number
    fuselageHeight: number
  }
  fuselage: {
    noseLength: number
    tailconeLength: number
    tailUpsweep: number
    cockpitWindowX: number
    decks: number
    end?: number
    mainDeckWindowZ?: number
    upperDeckWindowZ?: number
    noseExponent?: number
    tailEnd?: 'cone' | 'blade'
    cockpit?: { aftX: number; foreX: number; lowDeg: number; highDeg: number }
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
  vtail: {
    rootLEx: number
    height: number
    rootChord: number
    tipChord: number
    sweepLE: number
    dorsalFin?: boolean
    dorsalLength?: number
    dorsalHeight?: number
  }
  engines: {
    y: number
    fanX: number
    nacelleDiameter: number
    nacelleLength: number
    dropBelowWing: number
    section?: 'round' | 'flat-bottom'
    prop: { diameter: number } | null
    exhaustLength?: number
  }[]
}

/** What a part is made of: each has its own tone ramp in the lane CSS. */
export type Mat = 'body' | 'livery' | 'rubber' | 'metal' | 'void' | 'glass'
/** Line inks: the silhouette, seams on a surface, and the faintest panel lines. */
export type Ink = 'line' | 'seam' | 'faint'
export type Rings = Pt[][]
export type Lines = { runs: Pt[][]; ink: Ink; width: number }
export type Item =
  | {
      kind: 'solid'
      mat: Mat
      tones: Rings[]
      fill: Rings
      outline: Rings
      inner: Lines[]
      edge?: number
    }
  | { kind: 'fill'; rings: Rings; mat: Mat | 'shadow'; edge?: Ink; width?: number }
  | { kind: 'lines'; lines: Lines }

const D2R = Math.PI / 180
const tan = (deg: number) => Math.tan(deg * D2R)
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}
const ringsOf = (m: MultiPolygon): Rings =>
  m.flatMap((poly) => poly.map((ring) => ring.slice(0, -1) as Pt[]))

/** NACA four-digit half-thickness (closed trailing edge) at chord fraction c, for thickness ratio t. */
const naca = (c: number, t: number) =>
  5 *
  t *
  (0.2969 * Math.sqrt(Math.max(0, c)) -
    0.126 * c -
    0.3516 * c * c +
    0.2843 * c * c * c -
    0.1036 * c * c * c * c)

/** Linear interpolation over a sorted polyline [[at, value]]. */
function piecewise(points: [number, number][]) {
  return (at: number) => {
    if (at <= points[0][0]) return points[0][1]
    for (let i = 0; i < points.length - 1; i++) {
      const [a0, v0] = points[i],
        [a1, v1] = points[i + 1]
      if (at <= a1) return v0 + ((v1 - v0) * (at - a0)) / (a1 - a0 || 1)
    }
    return points[points.length - 1][1]
  }
}

/** Grid stations over [0, 1] with exact rows at `at` and about `n` rows in all, denser near the ends when `ends`. */
function stations(n: number, at: number[] = [], ends = 0): number[] {
  const base = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return ends ? t - (ends * Math.sin(2 * Math.PI * t)) / (2 * Math.PI) : t
  })
  return [
    ...new Set(
      [...base, ...at.filter((t) => t > 0 && t < 1)].map((t) => Math.round(t * 1e6) / 1e6),
    ),
  ].sort((a, b) => a - b)
}

/** Cosine-spaced chord stations for v around an airfoil: TE (v = 0) over the upper skin to the LE, back under to the TE. */
const chordOf = (v: number) => ({ c: (1 + Math.cos(2 * Math.PI * v)) / 2, upper: v <= 0.5 })
/** The v of a chord fraction on the upper skin. */
const vChord = (c: number) => Math.acos(2 * c - 1) / (2 * Math.PI)

// ---------------------------------------------------------------------------------------------------- the model

export type Built = {
  items: Item[]
  groundY: number
  tail: number
  nose: number
  /** The upper anti-collision beacon: on the crown over the wing box, or on top of a T-tail. */
  beacon: V3
}

export function airliner(g: AircraftGeometry, cam: Camera, kit: { G: any; P: any }): Built {
  const { G, P } = kit
  const items: Item[] = []
  const Lb = g.fuselage.end ?? g.dims.length
  const R = g.dims.fuselageWidth / 2,
    H = g.dims.fuselageHeight / 2
  const nl = g.fuselage.noseLength,
    tc = g.fuselage.tailconeLength
  const high = g.wing.position === 'high'
  const prop = g.engines.some((e) => e.prop)
  const wide = R > 2.4
  const half = g.dims.span / 2
  const fam = g.family

  // ------------------------------------------------------------ wing planform (stations xg, aft from the nose)
  const wg = g.wing,
    tip = g.wingtip
  const rake = tip.type === 'raked' && tip.rakeLE?.length ? tip.rakeLE : null
  const lean =
    tip.type === 'raked' || tip.type === 'none'
      ? 0
      : Math.max(tip.height, tip.type === 'at-winglet' ? tip.below : 0) * Math.tan(tip.cant * D2R)
  /** Where the straight wing ends (a device or the raked tip continues from here). */
  const tipY = rake ? rake[0].y : (tip.rootY ?? half - lean)
  // The root: low wings meet the barrel below its widest line, the high wing sits on the crown.
  const rootZ = high ? 0.97 : -0.55 // chord plane at the root, in half-heights from the barrel centre
  const y0 = high ? 0 : R * Math.sqrt(1 - rootZ * rootZ)
  const leX = (y: number) => {
    const b = wg.leBreakY
    if (b != null && wg.sweepLEInboard != null)
      return y <= b
        ? wg.rootLEx + tan(wg.sweepLEInboard) * (y - y0)
        : wg.rootLEx + tan(wg.sweepLEInboard) * (b - y0) + tan(wg.sweepLE) * (y - b)
    return wg.rootLEx + tan(wg.sweepLE) * (y - y0)
  }
  const rootTE = wg.rootLEx + wg.rootChord
  const kink = wg.kinkY != null && wg.kinkY > y0 ? wg.kinkY : null
  const tipTE0 = rake ? tip.rakeTE![0].x : leX(tipY) + wg.tipChord
  const teStraight = (y: number) => {
    if (kink != null && y <= kink) return rootTE
    const from = kink ?? y0
    const yEnd = rake ? tip.rakeTE![0].y : tipY
    return rootTE + ((tipTE0 - rootTE) * (y - from)) / (yEnd - from)
  }
  // Raked tips continue along their measured vertices to the true tip at half span.
  const leAt = rake
    ? (y: number) =>
        y <= rake[0].y ? leX(y) : piecewise(rake.map((p) => [p.y, p.x] as [number, number]))(y)
    : leX
  const teAt = rake
    ? (y: number) =>
        y <= tip.rakeTE![0].y
          ? teStraight(y)
          : piecewise(tip.rakeTE!.map((p) => [p.y, p.x] as [number, number]))(y)
    : teStraight
  const wingEnd = rake ? half : tipY
  /** Thickness ratio: a supercritical root about 14%, thinning to 10% at the tip (turboprop 16 to 12%). */
  const tau = (y: number) => {
    const u = clamp((y - y0) / (wingEnd - y0))
    return prop ? 0.16 - 0.04 * u : 0.145 - 0.045 * u
  }
  const tanD = tan(wg.dihedral)

  // ------------------------------------------------------------ fuselage sections
  const upsweep = g.fuselage.tailUpsweep
  const blade = g.fuselage.tailEnd === 'blade'
  const pw = g.fuselage.noseExponent ?? 2.2
  // Stance: the belly is high enough for a proportional gear and for the lowest nacelle to clear the ground.
  const wheelD = prop ? 0.78 : fam === 'A380' ? 1.42 : wide ? 1.3 : R < 1.75 ? 1.0 : 1.15
  const rootUpOf = (belly: number) => belly + H + rootZ * H
  const chordAt = (y: number) => teAt(y) - leAt(y)
  const lowerAt = (y: number, belly: number) =>
    rootUpOf(belly) + tanD * (y - y0) - (high ? 0.5 : 0.42) * tau(y) * chordAt(y)
  const nacelleBottom = (e: AircraftGeometry['engines'][number], belly: number) =>
    lowerAt(e.y, belly) -
    e.dropBelowWing -
    (e.nacelleDiameter / 2) * (e.section === 'flat-bottom' ? 0.82 : 1)
  const clearance = prop ? 0.95 : 0.5
  const belly = Math.max(
    high ? 1.0 : wheelD * 1.2,
    ...g.engines.map((e) => clearance - nacelleBottom(e, 0)),
  )
  const zc = belly + H

  type Sec = { top: number; bottom: number; w: number }
  const zTip = zc - 0.24 * H
  const sec = (xg: number): Sec => {
    if (xg < nl) {
      const u = 1 - clamp(xg / nl)
      const f = (p: number) => Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p)
      return {
        top: zTip + (zc + H - zTip) * f(prop ? 2.0 : 2.05),
        bottom: zTip - (zTip - (zc - H)) * f(prop ? 1.9 : 1.75),
        w: R * f(pw),
      }
    }
    if (xg > Lb - tc) {
      const u = clamp((xg - (Lb - tc)) / tc)
      const zEnd = zc + upsweep
      const hEnd = (blade ? 0.2 : 0.11) * H,
        wEnd = (blade ? 0.05 : 0.11) * R
      const top = zc + H - (zc + H - (zEnd + hEnd)) * Math.pow(u, 2.3)
      const bottom = zc - H + (zEnd - hEnd - (zc - H)) * Math.pow(u, 1.32)
      const wf = blade
        ? Math.pow(u, 1.0) * (0.55 + 0.45 * smooth((u - 0.45) / 0.55))
        : Math.pow(u, 1.18)
      return { top, bottom, w: R - (R - wEnd) * clamp(wf) }
    }
    return { top: zc + H, bottom: zc - H, w: R }
  }
  // The belly fairing: a shallow keel under the wing box, fullest at the bottom, gone by 40° up either side.
  const fairing0 = wg.rootLEx - 0.12 * wg.rootChord,
    fairing1 = rootTE + 0.35 * wg.rootChord
  const fairingAt = (xg: number) =>
    high
      ? 0
      : 0.075 *
        smooth((xg - fairing0) / (0.25 * wg.rootChord)) *
        smooth((fairing1 - xg) / (0.4 * wg.rootChord))
  const bodyAt = (xg: number, th: number): V3 => {
    const s = sec(xg)
    const m = (s.top + s.bottom) / 2,
      h = (s.top - s.bottom) / 2
    const c = Math.cos(th)
    const keel = c < -0.76 ? fairingAt(xg) * Math.pow((-c - 0.76) / 0.24, 1.6) : 0
    return [-xg, s.w * Math.sin(th) * (1 + keel * 0.6), m + h * c * (1 + keel)]
  }
  const body: Surface = {
    at: (u, v) => bodyAt(u * Lb, v * 2 * Math.PI),
    u: stations(150, [nl / Lb, (Lb - tc) / Lb], 0.35),
    v: 112,
    closed: true,
    flip: true,
  }
  /** The skin's half-width at height z, and the crown's height at y (for parts that stand on it). */
  const skinY = (xg: number, z: number) => {
    const s = sec(xg)
    const m = (s.top + s.bottom) / 2,
      h = (s.top - s.bottom) / 2
    const t = (z - m) / h
    return Math.abs(t) >= 1 ? 0 : s.w * Math.sqrt(1 - t * t)
  }
  const crownZ = (xg: number, y: number) => {
    const s = sec(xg)
    const m = (s.top + s.bottom) / 2,
      h = (s.top - s.bottom) / 2
    const t = y / s.w
    return Math.abs(t) >= 1 ? m : m + h * Math.sqrt(1 - t * t)
  }

  // ------------------------------------------------------------ helpers
  const solid = (
    s: Surface,
    mat: Mat,
    inner: Lines[] = [],
    edge?: number,
  ): Extract<Item, { kind: 'solid' }> => {
    const d = drawSurface(s, cam)
    return {
      kind: 'solid',
      mat,
      tones: d.tones.map(() => []).map((_, i) => ringsOfPath(d.tones[i])),
      fill: ringsOf(d.shape),
      outline: ringsOf(d.shape),
      inner,
      edge,
    }
  }
  const kitSolid = (paths: any, mat: Mat, inner: Lines[] = [], edge?: number): Item => ({
    kind: 'solid',
    mat,
    tones: [...paths.shades, paths.top].map((d: string) => ringsOfPath(d ?? '')),
    fill: ringsOfPath(paths.fill),
    outline: ringsOfPath(paths.outline, false),
    inner: paths.crease
      ? [{ runs: ringsOfPath(paths.crease, false), ink: 'faint', width: 0.2 }, ...inner]
      : inner,
    edge,
  })
  /** Orients a surface so its normal at (u, v) points along `out`. */
  /**
   * Turns a closed tube's normals outward (inward for an intake's inner wall). On every tube here the point at v = 0.25
   * lies across the section from the one at v = 0.75, so outward at the first is away from the second, on either side.
   */
  const oriented = (s: Surface, u: number, inward = false): Surface => {
    const n = normalAt({ ...s, flip: false }, u, 0.25)
    const across = sub(s.at(u, 0.25), s.at(u, 0.75))
    return { ...s, flip: dot(n, across) < 0 !== inward }
  }
  const seam = (s: Surface, uv: [number, number][], ink: Ink = 'seam', width = 0.22): Lines => ({
    runs: curveOn(s, cam, uv, { spacing: 0.004 }),
    ink,
    width,
  })
  const curveUV = (n: number, f: (t: number) => [number, number]) =>
    Array.from({ length: n + 1 }, (_, i) => f(i / n))
  /**
   * A surface in two paints: `base` all over, the livery over u in [from, to] with a seam where the paint ends on the
   * surface and `seams` (at u) across it; the outline goes on again last, as the paint covers its inner half.
   */
  const twoTone = (
    s: Surface,
    base: Mat,
    from: number,
    to: number,
    seams: [number, Ink][] = [],
  ): Item[] => {
    const under = solid(s, base)
    const paint: Surface = { ...s, at: (a, v) => s.at(from + a * (to - from), v), u: stations(40) }
    const ends = [from, to].filter((m) => m > 0 && m < 1).map((m): [number, Ink] => [m, 'seam'])
    const across = ([m, ink]: [number, Ink]) =>
      seam(
        paint,
        curveUV(64, (t) => [(m - from) / (to - from), t]),
        ink,
      )
    return [
      under,
      solid(paint, 'livery', [...ends, ...seams].map(across), 0),
      {
        kind: 'lines',
        lines: { runs: under.outline.map((r) => [...r, r[0]]), ink: 'line', width: 0.75 },
      },
    ]
  }
  /** A closed patch on a surface in (u, v): its visible outline as rings, if it faces the viewer by `least`. */
  const patch = (s: Surface, uv: [number, number][], least = 0.08): Rings => {
    const [cu, cv] = uv.reduce((a, b) => [a[0] + b[0] / uv.length, a[1] + b[1] / uv.length], [0, 0])
    if (dot(normalAt(s, cu, cv), cam.V) < least) return []
    const pts: Pt[] = []
    for (let i = 0; i < uv.length; i++) {
      const [u0, v0] = uv[i],
        [u1, v1] = uv[(i + 1) % uv.length]
      for (let k = 0; k < 6; k++)
        pts.push(
          cam.project(s.at(u0 + ((u1 - u0) * k) / 6, (((v0 + ((v1 - v0) * k) / 6) % 1) + 1) % 1)),
        )
    }
    return [pts]
  }
  /** A rounded rectangle in (u, v) around a centre, as a loop of (u, v) points. */
  const roundedUV = (
    cu: number,
    cv: number,
    hu: number,
    hv: number,
    r = 0.35,
    n = 4,
  ): [number, number][] => {
    const out: [number, number][] = []
    const ru = hu * r,
      rv = hv * r
    const corners: [number, number, number][] = [
      [cu + hu - ru, cv + hv - rv, 0],
      [cu - hu + ru, cv + hv - rv, 90],
      [cu - hu + ru, cv - hv + rv, 180],
      [cu + hu - ru, cv - hv + rv, 270],
    ]
    for (const [x, y, a0] of corners)
      for (let i = 0; i <= n; i++) {
        const a = (a0 + (90 * i) / n) * D2R
        out.push([x + ru * Math.cos(a), y + rv * Math.sin(a)])
      }
    return out
  }

  // ------------------------------------------------------------ foils: wings, tails, pylons, winglets
  type Foil = {
    /** Station point (y, z) of the chord plane's leading edge reference, along the span (t over [0, 1]). */
    path: (t: number) => [number, number]
    le: (t: number) => number
    te: (t: number) => number
    tau: (t: number) => number
    /** Thickness direction in the y–z plane (unit), the foil's "up". */
    up: (t: number) => [number, number]
    /** Root conformance: lifts each root point onto a host surface (returns the corrected (y, z)). */
    root?: (xg: number, y: number, z: number) => [number, number]
    rows: number
    at?: number[]
    camber?: number
  }
  const foilAt =
    (f: Foil) =>
    (t: number, v: number): V3 => {
      const { c, upper } = chordOf(v)
      const [py, pz] = f.path(t)
      const le = f.le(t),
        te = f.te(t)
      const chord = te - le
      const tk = naca(c, f.tau(t)) * chord
      const camber = (f.camber ?? 0) * chord * 4 * c * (1 - c)
      const [uy, uz] = f.up(t)
      const off = (upper ? tk : -tk) + camber
      let y = py + uy * off,
        z = pz + uz * off
      const xg = le + c * chord
      if (f.root) {
        const [ry, rz] = f.root(xg, y, z)
        const k = Math.pow(1 - clamp(t / 0.25), 3)
        y += (ry - y) * k
        z += (rz - z) * k
      }
      return [-xg, y, z]
    }
  const foil = (f: Foil): Surface =>
    oriented({ at: foilAt(f), u: stations(f.rows, f.at ?? []), v: 72, closed: true }, 0.5)

  // The main wing, one side (sg = +1 near, −1 far).
  const wingZ = (y: number) => rootUpOf(belly) + tanD * (y - y0)
  const wingFoil = (sg: number): Foil => {
    const yA = high ? 0 : y0
    const yAt = (t: number) => yA + t * (wingEnd - yA)
    const norm = Math.hypot(1, tanD)
    return {
      path: (t) => [sg * yAt(t), wingZ(Math.max(yAt(t), y0))],
      le: (t) => leAt(Math.max(yAt(t), y0)),
      te: (t) => {
        const y = yAt(t)
        // Raked and pointed tips: keep a sliver of chord so the tip closes as an edge, not a point.
        return Math.max(teAt(Math.max(y, y0)), leAt(Math.max(y, y0)) + 0.06)
      },
      tau: (t) => tau(yAt(t)),
      up: () => [(-sg * tanD) / norm, 1 / norm],
      root: high
        ? undefined
        : (xg, _y, z) => {
            const ys = skinY(xg, z)
            return [sg * Math.max(ys, 0.01), z]
          },
      rows: 46,
      at: [kink, wg.leBreakY, rake ? rake[0].y : null, ...(tip.rakeLE ?? []).map((p) => p.y)]
        .filter((y): y is number => y != null)
        .map((y) => (y - yA) / (wingEnd - yA)),
      camber: 0.018,
    }
  }

  /**
   * A wingtip device rising (or dropping) from the wing end: a cubic from the end chord, leaving it level, to the blade
   * tip `h` above (below) it and `reach` outboard, arriving at `cant` from vertical. The upper blade's reach takes it
   * to half span (SCHEMA.md: from `rootY`, else the lean `height·tan(cant)`); `blend` is the share of the reach run
   * level before it turns (0: a fence, straight up).
   */
  const tipDevice = (
    sg: number,
    h: number,
    dir: 1 | -1,
    chordTipFrac: number,
    blend: number,
  ): Surface => {
    const yT = wingEnd,
      zT = wingZ(yT)
    const le0 = leAt(yT),
      c0 = Math.max(0.3, chordAt(yT))
    const cant = tip.cant * D2R
    const reach = dir > 0 ? half - yT : h * Math.tan(cant)
    const P1: [number, number] = blend > 0 ? [blend * reach, 0] : [0, h / 3]
    const P2: [number, number] = [reach - 0.35 * h * Math.tan(cant), (blend > 0 ? 0.65 : 2 / 3) * h]
    const P3: [number, number] = [reach, h]
    const pathAt = (t: number): [number, number, number, number] => {
      // Returns y, z and the unit tangent (ty, tz) along the device, from the wing end.
      const m = 1 - t
      const y = 3 * m * m * t * P1[0] + 3 * m * t * t * P2[0] + t * t * t * P3[0]
      const z = 3 * m * m * t * P1[1] + 3 * m * t * t * P2[1] + t * t * t * P3[1]
      const dy = 3 * m * m * P1[0] + 6 * m * t * (P2[0] - P1[0]) + 3 * t * t * (P3[0] - P2[0])
      const dz = 3 * m * m * P1[1] + 6 * m * t * (P2[1] - P1[1]) + 3 * t * t * (P3[1] - P2[1])
      const l = Math.hypot(dy, dz) || 1
      return [yT + y, zT + dir * z, dy / l, (dir * dz) / l]
    }
    const sweepBack = (t: number) => c0 * (0.15 + 0.62 * t) + h * 0.32 * t
    const le = (t: number) => le0 + sweepBack(t) * smooth(t * 1.6)
    const f: Foil = {
      path: (t) => {
        const [y, z] = pathAt(t)
        return [sg * y, z]
      },
      le,
      // The chord shrinks to chordTipFrac at the blade tip.
      te: (t) => le(t) + c0 * (1 - (1 - chordTipFrac) * smooth(t * 1.15)),
      tau: (t) => 0.1 - 0.02 * t,
      up: (t) => {
        const [, , ty, tz] = pathAt(t)
        // Thickness lies across the blade: the tangent turned a quarter, toward the inboard/top side.
        return [-sg * tz * dir, ty * dir]
      },
      rows: 18,
    }
    return oriented({ at: foilAt(f), u: stations(18), v: 48, closed: true }, 0.6)
  }

  // Stabiliser, one side.
  const ht = g.htail
  const tTail = ht.position === 't-tail'
  const vt = g.vtail
  const finRoot = (xg: number) => crownZ(xg, 0)
  const finTopZ = finRoot(vt.rootLEx) + vt.height
  const stabFoil = (sg: number): Foil => {
    const rootY = tTail ? 0 : (ht.rootY ?? R * 0.8)
    const tipLE = ht.tipLEx ?? ht.rootLEx + tan(ht.sweepLE) * (ht.span / 2 - rootY)
    const tipTE = ht.tipTEx ?? tipLE + ht.tipChord
    const zRootS = tTail
      ? finTopZ - (ht.zBelowFinTop ?? 0.25)
      : sec(ht.rootLEx + ht.rootChord * 0.4).top * 0.15 +
        0.85 * ((sec(ht.rootLEx).top + sec(ht.rootLEx).bottom) / 2)
    const tD = tan(ht.dihedral)
    // Inboard of the measured root the leading edge and chord extend along the same lines to the body.
    const lerpX = (a: number, b: number) => (y: number) =>
      a + ((b - a) * (y - rootY)) / (ht.span / 2 - rootY)
    const le = lerpX(ht.rootLEx, tipLE),
      te = lerpX(ht.rootLEx + ht.rootChord, Math.min(tipTE, g.dims.length - 0.01))
    const yIn = tTail ? 0 : Math.min(rootY, skinY(ht.rootLEx + ht.rootChord * 0.5, zRootS) * 0.9)
    const yAt2 = (t: number) => yIn + t * (ht.span / 2 - yIn)
    const norm = Math.hypot(1, tD)
    return {
      path: (t) => [sg * yAt2(t), zRootS + tD * (yAt2(t) - rootY)],
      le: (t) => le(yAt2(t)),
      te: (t) => te(yAt2(t)),
      tau: () => 0.1,
      up: () => [(-sg * tD) / norm, 1 / norm],
      root: tTail
        ? undefined
        : (xg, _y, z) => [sg * Math.max(skinY(Math.min(xg, Lb - 0.05), z), 0.01), z],
      rows: 22,
    }
  }

  // The fin: its root stands on the crown, the dorsal fillet (where measured) runs forward along it.
  const finFoil = (): Foil => {
    const zR = finRoot(vt.rootLEx)
    const dl = vt.dorsalFin && vt.dorsalLength && vt.dorsalHeight ? vt.dorsalLength : 0
    const dh = dl ? vt.dorsalHeight! : 0
    const top = tTail ? finTopZ - (ht.zBelowFinTop ?? 0.25) + 0.12 : finTopZ
    const zAt = (t: number) => zR - 0.3 + t * (top - zR + 0.3)
    const hOf = (t: number) => zAt(t) - zR
    const fillet = (t: number) => {
      if (!dl) return 0
      const h = hOf(t)
      if (h >= dh) return 0
      const k = 1 - Math.max(0, h) / dh
      return dl * k * k
    }
    return {
      path: (t) => [0, zAt(t)],
      le: (t) => vt.rootLEx + tan(vt.sweepLE) * Math.max(0, hOf(t)) - fillet(t),
      te: (t) => {
        const u = clamp(hOf(t) / vt.height)
        const root = vt.rootLEx + vt.rootChord
        const tipLE = vt.rootLEx + tan(vt.sweepLE) * vt.height
        return Math.min(root + (tipLE + vt.tipChord - root) * u, g.dims.length - 0.01)
      },
      tau: (t) => 0.115 - 0.025 * clamp(hOf(t) / vt.height),
      up: () => [1, 0],
      root: (xg, y, z) => [y, Math.min(z, crownZ(Math.min(xg, Lb - 0.05), y))],
      rows: 30,
      at: dh ? [(dh + 0.3) / (top - zR + 0.3)] : [],
    }
  }

  // ------------------------------------------------------------ engines
  type Engine = AircraftGeometry['engines'][number]
  const engineAxis = (e: Engine, sg: number) => {
    const zce = lowerAt(e.y, belly) - e.dropBelowWing
    return { y: sg * e.y, z: zce, x: -e.fanX }
  }
  /** A body of revolution about the engine axis, (s aft from the intake plane, r) along a meridian m over [0, 1]. */
  const revolve = (
    ax: { x: number; y: number; z: number },
    meridian: (m: number) => [number, number],
    rows: number,
    flat = 1,
  ): Surface => ({
    at: (m, v) => {
      const [s, r] = meridian(m)
      const th = v * 2 * Math.PI
      const c = Math.cos(th)
      const rz = c < 0 ? r * flat : r
      return [ax.x - s, ax.y + r * Math.sin(th), ax.z + rz * c]
    },
    u: stations(rows),
    v: 64,
    closed: true,
  })

  const engine = (e: Engine, sg: number) => {
    const ax = engineAxis(e, sg)
    const r = e.nacelleDiameter / 2
    const L = e.nacelleLength
    const flat = e.section === 'flat-bottom' ? 0.82 : 1
    const out: Item[] = []
    const pylonItems: Item[] = []
    if (e.prop) {
      // Turboprop: a long round nacelle under the high wing, the spinner and the blades in front.
      const nac = revolve(
        ax,
        (m) => {
          const s = -0.1 + m * (L + 0.1)
          const u = m
          const shape =
            u < 0.12
              ? 0.62 + 0.38 * Math.sqrt(u / 0.12)
              : u > 0.7
                ? 1 - 0.55 * smooth((u - 0.7) / 0.3)
                : 1
          return [s, r * shape * (u < 0.02 ? Math.sqrt(u / 0.02) : 1)]
        },
        40,
      )
      const n2: Surface = {
        ...nac,
        at: (m, v) => {
          const p = nac.at(m, v)
          // A deeper nacelle under the wing (it carries the gear bay): stretch the lower half.
          const dz = p[2] - ax.z
          return [p[0], p[1], dz < 0 ? ax.z + dz * 1.35 : p[2]]
        },
      }
      // The livery on the engine cowling ahead of the wing; the nacelle aft of it stays bare.
      const cowlEnd = clamp((leAt(e.y) - e.fanX + 0.1) / (L + 0.1), 0.25, 0.6)
      out.push(...twoTone(oriented(n2, 0.5), 'body', 0, cowlEnd))
      return { out, pylonItems, front: propItems(e, ax) }
    }
    // Exhaust: the core cowl and plug behind the fan cowl, drawn first (they sit behind it from this side).
    const ex = e.exhaustLength ?? L * 0.32
    const core = revolve(
      ax,
      (m) => {
        const s = L - 0.3 + m * (ex * 0.6 + 0.3)
        return [s, r * (0.66 - 0.24 * smooth(m))]
      },
      10,
    )
    const plug = revolve(
      ax,
      (m) => {
        const s = L + ex * 0.55 + m * ex * 0.45
        return [s, r * 0.33 * Math.pow(Math.max(0, 1 - m), 0.8) + 0.001]
      },
      10,
    )
    out.push(solid(oriented(plug, 0.3), 'metal'))
    out.push(solid(oriented(core, 0.5), 'metal'))
    // Intake: the dark fan face, the spinner, the inner wall; the lip and outer cowl go over them.
    const fanS = 0.42 * r
    const fanF = G.frameAlong([ax.x - fanS, ax.y, ax.z], [-1, 0, 0])
    const disc = G.disc(-0.01, 0.01, r * 0.86, fanF, P)
    out.push({ kind: 'fill', rings: ringsOfPath(disc.fill), mat: 'void' })
    const spinner = G.solidOf(
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8
        return [-0.32 * r * (1 - t), 0.26 * r * Math.sqrt(t), 1]
      }),
      fanF,
      P,
    )
    out.push(kitSolid(spinner, 'metal', [], 0.18))
    const inner = revolve(ax, (m) => [fanS * (1 - m) + 0.1 * r * m, r * (0.85 - 0.01 * m)], 8)
    out.push(solid(oriented(inner, 0.5, true), 'void', [], 0))
    // Lip and cowl: one meridian from the lip's inner edge, round the elliptical lip, over the cowl to the fan nozzle.
    const hl = 0.9 * r,
      lipT = 0.06 * r,
      lipA = 0.1 * r
    const lipEnd = 0.2
    const cowl = revolve(
      ax,
      (m) => {
        if (m < lipEnd) {
          const a = -Math.PI / 2 + (m / lipEnd) * Math.PI
          return [lipA * (1 - Math.cos(a)), hl + lipT * Math.sin(a)]
        }
        const u = (m - lipEnd) / (1 - lipEnd)
        const s = lipA + u * (L - lipA)
        const r0 = hl + lipT
        const swell = Math.sin(Math.min(1, u / 0.32) * (Math.PI / 2))
        const aft = smooth((u - 0.52) / 0.48)
        return [s, (r0 + (r - r0) * swell) * (1 - 0.15 * aft)]
      },
      40,
      flat,
    )
    // The cowl in livery behind a bare metal lip ring.
    const ring = lipEnd + ((1 - lipEnd) * 0.16 * r) / (L - lipA)
    const cowlSeams: [number, Ink][] =
      sg > 0
        ? [
            [lipEnd + (1 - lipEnd) * 0.42, 'seam'],
            [lipEnd + (1 - lipEnd) * 0.8, 'faint'],
          ]
        : []
    out.push(...twoTone(oriented(cowl, 0.5), 'metal', ring, 1, cowlSeams))
    // Pylon: from the cowl crown up into the wing's lower skin, its fairing running past the nozzle.
    const zw = lowerAt(e.y, belly) + 0.05
    const pyl: Foil = {
      path: (t) => [sg * e.y, ax.z + r * 0.7 + t * (zw - ax.z - r * 0.7)],
      le: (t) => e.fanX + L * (0.28 - 0.1 * t),
      te: (t) => e.fanX + L + ex * (0.75 - 0.35 * t),
      tau: () => 0.12,
      up: () => [1, 0],
      rows: 8,
    }
    pylonItems.push(solid(foil(pyl), 'body'))
    return { out, pylonItems, front: [] as Item[] }
  }
  const propItems = (e: Engine, ax: { x: number; y: number; z: number }): Item[] => {
    const r = e.nacelleDiameter / 2
    const F = G.frameAlong([ax.x + 0.1, ax.y, ax.z], [1, 0, 0])
    const spinner = G.solidOf(
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8
        return [0.75 * t, 0.62 * r * Math.sqrt(1 - t * t * 0.98), 1]
      }),
      F,
      P,
    )
    const D = e.prop!.diameter / 2
    // The turning disc: a faint ring; four blades frozen in it.
    const ring: Pt[] = Array.from({ length: 72 }, (_, i) => {
      const a = (i / 72) * 2 * Math.PI
      return cam.project(G.pointOf(F, 0.25, D, a))
    })
    const blades: Item[] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 2 * Math.PI + 0.5
      const dir = G.radialOf(F, a) as V3
      const side = G.tangentOf(F, a) as V3
      const at = (rr: number, w: number, s = 0.25): V3 =>
        add(add(G.pointOf(F, s, 0, 0), mul(dir, rr)), mul(side, w))
      blades.push({
        kind: 'fill',
        rings: [
          [
            at(0.3, -0.13),
            at(D * 0.55, -0.15),
            at(D * 0.97, -0.07),
            at(D, 0),
            at(D * 0.97, 0.06),
            at(D * 0.55, 0.1),
            at(0.3, 0.1),
          ].map(cam.project),
        ],
        mat: 'metal',
        edge: 'line',
        width: 0.35,
      })
    }
    return [
      { kind: 'lines', lines: { runs: [ring.concat([ring[0]])], ink: 'faint', width: 0.3 } },
      ...blades,
      kitSolid(spinner, 'metal'),
    ]
  }

  // ------------------------------------------------------------ landing gear
  const tracks: Record<string, number> = {
    A320: 7.59,
    '737': 5.72,
    A330: 10.68,
    A350: 10.6,
    A380: 12.46,
    '767': 9.3,
    '787': 9.8,
    '777': 10.97,
    E170: 4.71,
    E195: 5.94,
    SU95: 6.4,
    'Dash 8': 7.87,
  }
  const trackHalf = (tracks[g.icao] ?? tracks[fam] ?? Math.max(2.4 * R, 0.2 * g.dims.span)) / 2
  const tyreW = wheelD * 0.36
  const wheel = (c: V3, d: number, mat: Mat = 'rubber'): Item[] => {
    const r = d / 2,
      w = tyreW * (d / wheelD)
    const F = G.frameAlong(c, [0, 1, 0])
    const tyre = G.solidOf(
      [
        [-w / 2, r * 0.55],
        [-w / 2, r * 0.78, 1],
        [-w * 0.42, r * 0.93, 1],
        [-w * 0.25, r, 1],
        [w * 0.25, r, 1],
        [w * 0.42, r * 0.93, 1],
        [w / 2, r * 0.78, 1],
        [w / 2, r * 0.55],
      ],
      F,
      P,
      { smooth: false, steps: 20 },
    )
    const hub = G.disc(w / 2 - 0.01, w / 2 + 0.02, r * 0.55, F, P, { steps: 16 })
    return [
      kitSolid(tyre, mat),
      kitSolid(hub, 'metal', [
        {
          runs: ringsOfPath(G.circleOf(F, w / 2 + 0.02, r * 0.28, P), true),
          ink: 'seam',
          width: 0.18,
        },
      ]),
    ]
  }
  const strut = (a: V3, b: V3, rr: number, mat: Mat = 'metal'): Item => {
    const axis = sub(b, a)
    const L = Math.hypot(axis[0], axis[1], axis[2])
    const F = G.frameAlong(a, unit(axis))
    return kitSolid(G.disc(0, L, rr, F, P), mat)
  }
  const gearLeg = (
    xg: number,
    y: number,
    top: number,
    axles: number,
    d = wheelD,
    pairGap?: number,
  ): Item[] => {
    const out: Item[] = []
    const r = d / 2
    const gap = pairGap ?? (tyreW * (d / wheelD)) / 2 + 0.12
    const pitch = d * 1.12
    const xs = Array.from({ length: axles }, (_, i) => -xg + (i - (axles - 1) / 2) * pitch)
    const axleZ = r
    // Far wheels of each axle, then the axles and the bogie beam and leg, then the near wheels.
    for (const x of xs) out.push(...wheel([x, y - gap, axleZ], d))
    for (const x of xs) out.push(strut([x, y - gap, axleZ], [x, y + gap, axleZ], 0.06))
    if (axles > 1)
      out.push(
        strut([xs[0] - 0.15, y, axleZ + 0.12], [xs[xs.length - 1] + 0.15, y, axleZ + 0.12], 0.11),
      )
    out.push(strut([-xg, y, axleZ + (axles > 1 ? 0.12 : 0)], [-xg, y, top], 0.13 * (d / 1.15)))
    out.push(
      strut(
        [-xg, y, top - 0.15 - (top - axleZ) * 0.45],
        [-xg + 0.02, y, top - 0.1],
        0.17 * (d / 1.15),
      ),
    )
    for (const x of xs) out.push(...wheel([x, y + gap, axleZ], d))
    return out
  }
  const mainXg = wg.rootLEx + wg.rootChord * 0.72
  const noseXg = Math.min(nl * 0.86, g.fuselage.cockpitWindowX + 1.6)
  const mainAxles = fam === '777' || g.icao === 'A35K' ? 3 : wide ? 2 : 1
  const mainGear = (sg: number): Item[] => {
    if (prop) return []
    const y = sg * trackHalf
    const top = Math.min(wingZ(trackHalf) - 0.3, zc - 0.2)
    const out = gearLeg(mainXg, y, top, mainAxles)
    return out
  }
  const bodyGear = (sg: number): Item[] =>
    fam === 'A380' ? gearLeg(mainXg + 3.2, sg * 2.0, zc - H * 0.8, 3) : []
  const noseGear = (): Item[] => gearLeg(noseXg, 0, zc - H * 0.7, 1, wheelD * 0.68)
  const propGear = (e: Engine, sg: number): Item[] => {
    const ax = engineAxis(e, sg)
    return gearLeg(e.fanX + e.nacelleLength * 0.45, sg * e.y, ax.z - 0.2, 1, wheelD)
  }

  // ------------------------------------------------------------ the ground shadow
  {
    const plan: Pt[][] = []
    const flat = (pts: [number, number][]) => pts.map(([xg, y]) => cam.project([-xg, y, 0.01]))
    const fus: [number, number][] = []
    for (let i = 0; i <= 40; i++) {
      const xg = (i / 40) * Lb
      fus.push([xg, sec(xg).w])
    }
    for (let i = 40; i >= 0; i--) {
      const xg = (i / 40) * Lb
      fus.push([xg, -sec(xg).w])
    }
    plan.push(flat(fus))
    for (const sg of [1, -1]) {
      plan.push(
        flat([
          [leAt(y0), sg * y0],
          [leAt(wingEnd), sg * wingEnd],
          [teAt(wingEnd), sg * wingEnd],
          [teAt(y0), sg * y0],
        ]),
      )
      if (!tTail) {
        const tipLE = ht.tipLEx ?? ht.rootLEx
        const tipTE = ht.tipTEx ?? tipLE + ht.tipChord
        plan.push(
          flat([
            [ht.rootLEx, sg * 0.5],
            [tipLE, (sg * ht.span) / 2],
            [tipTE, (sg * ht.span) / 2],
            [ht.rootLEx + ht.rootChord, sg * 0.5],
          ]),
        )
      }
    }
    const u = unionAll(
      plan.map((p) => [
        [...p.map((q) => [q[0], q[1]] as [number, number]), [p[0][0], p[0][1]] as [number, number]],
      ]),
    )
    items.push({ kind: 'fill', rings: ringsOf(u), mat: 'shadow' })
  }

  // ------------------------------------------------------------ flap-track fairings and antennas
  // Canoe fairings under the trailing edge, standing out behind it: three a side on the jets (estimated stations).
  const fairingsOf = (sg: number): Item[] => {
    if (high) return []
    const out: Item[] = []
    for (const k of [0.2, 0.42, 0.64]) {
      const y = y0 + k * (tipY - y0)
      const le = leAt(y),
        c = chordAt(y)
      const zl = wingZ(y) - 0.3 * tau(y) * c
      const rf = Math.max(0.12, 0.05 * c)
      const x0 = le + 0.5 * c,
        x1 = teAt(y) + 0.22 * c
      const ax = { x: -x0, y: sg * y, z: zl }
      const s = revolve(
        ax,
        (m) => [
          m * (x1 - x0),
          rf *
            Math.pow(Math.sin(Math.PI * Math.min(m * 1.25, 1) * 0.5), 0.5) *
            (1 - smooth((m - 0.55) / 0.45) * 0.97),
        ],
        14,
      )
      out.push(solid(oriented(s, 0.4), 'body', [], 0.35))
    }
    return out
  }
  /** A blade antenna standing on the crown at station xg. */
  const antenna = (xg: number, h: number, c: number, mat: Mat = 'metal'): Item => {
    const f: Foil = {
      path: (t) => [0, crownZ(xg, 0) - 0.06 + t * (h + 0.06)],
      le: (t) => xg + t * c * 0.55,
      te: (t) => xg + c - t * c * 0.15,
      tau: () => 0.16,
      up: () => [1, 0],
      root: (x, y, z) => [y, Math.min(z, crownZ(x, y))],
      rows: 6,
    }
    return solid(foil(f), mat, [], 0.3)
  }

  // ------------------------------------------------------------ assembly, far to near
  const engines = g.engines
  const farEngines = [...engines].sort((a, b) => b.y - a.y) // outboard (farthest) first
  const nearEngines = [...engines].sort((a, b) => a.y - b.y)

  // A stabiliser half with its elevator hinge line.
  const stab = (sg: number) => {
    const s = foil(stabFoil(sg))
    return solid(s, 'body', [
      seam(
        s,
        curveUV(30, (t) => [t, vChord(0.7)]),
        'seam',
        0.2,
      ),
    ])
  }
  const stabNear = !tTail ? stab(1) : null
  if (!tTail) items.push(stab(-1))

  const wingNear = wingFoil(1)
  const wingNearS = foil(wingNear)
  const wingFarS = foil(wingFoil(-1))

  // Upper-skin seams on either wing: the slat line along the leading edge, the flap and aileron hinge line, spoilers.
  const wingSeams = (wl: Surface): Lines[] => {
    const span = (y: number) => (y - y0) / (wingEnd - y0)
    const ail = span(y0 + (tipY - y0) * 0.7)
    const end = Math.min(span(tipY), 1)
    // Each line runs out to the root, the tip or the aileron's end ticks, and the ticks run back to the trailing edge.
    const out: Lines[] = [
      seam(
        wl,
        curveUV(60, (t) => [t * end, vChord(0.12)]),
        'faint',
      ),
      seam(
        wl,
        curveUV(40, (t) => [t * ail, vChord(0.74)]),
      ),
      seam(
        wl,
        curveUV(20, (t) => [ail + t * (end - 0.03 - ail), vChord(0.76)]),
      ),
      seam(
        wl,
        curveUV(6, (t) => [ail, vChord(0.74 + 0.26 * t)]),
      ),
      seam(
        wl,
        curveUV(6, (t) => [end - 0.03, vChord(0.76 + 0.24 * t)]),
      ),
    ]
    for (const t of [0.18, 0.3, 0.42, 0.54])
      out.push(
        seam(
          wl,
          curveUV(8, (k) => [t, vChord(0.6 + 0.14 * k)]),
          'faint',
          0.18,
        ),
      )
    return out
  }

  const devices = (sg: number): Surface[] => {
    switch (tip.type) {
      case 'sharklet':
        return [tipDevice(sg, tip.height, 1, 0.28, 0.5)]
      case 'blended':
        return [tipDevice(sg, tip.height, 1, 0.32, 0.4)]
      case 'curved':
        return [tipDevice(sg, tip.height, 1, 0.2, 0.6)]
      case 'at-winglet':
        return [tipDevice(sg, tip.height, 1, 0.3, 0.35), tipDevice(sg, tip.below, -1, 0.35, 0.3)]
      case 'fence':
        return [
          tipDevice(sg, tip.height, 1, 0.35, 0),
          ...(tip.below ? [tipDevice(sg, tip.below, -1, 0.35, 0)] : []),
        ]
      default:
        return []
    }
  }

  // Far side.
  if (high) {
    for (const e of farEngines) {
      const { out, front } = engine(e, -1)
      items.push(...propGear(e, -1), ...out, ...front)
    }
  } else {
    for (const e of farEngines) {
      const { out, pylonItems } = engine(e, -1)
      items.push(...out, ...pylonItems)
    }
    items.push(...fairingsOf(-1))
    items.push(solid(wingFarS, 'body', wingSeams(wingFarS)))
    for (const d of devices(-1)) items.push(solid(d, 'livery'))
    items.push(...mainGear(-1))
  }
  items.push(...bodyGear(-1))
  items.push(...noseGear())

  // Fuselage and its skin.
  const skin: Lines[] = []
  const uOf = (xg: number) => xg / Lb
  const vOf = (deg: number) => deg / 360 // 0 at the crown, 90° the near flank
  const ck = g.fuselage.cockpit
  const ckAft = ck?.aftX ?? g.fuselage.cockpitWindowX
  const ckFore = ck?.foreX ?? ckAft - 1.2
  // Radome joint (just ahead of the windscreen) and the production joints of the barrel and tail cone.
  skin.push(
    seam(
      body,
      curveUV(90, (t) => [uOf(Math.min(nl * 0.38, ckFore - 0.35)), t]),
    ),
  )
  skin.push(
    seam(
      body,
      curveUV(90, (t) => [uOf(Lb - tc + 0.4), t]),
      'faint',
    ),
  )
  skin.push(
    seam(
      body,
      curveUV(90, (t) => [uOf(Lb - tc * 0.32), t]),
      'faint',
    ),
  )
  // The belly fairing's edge.
  if (!high)
    skin.push(
      seam(
        body,
        curveUV(60, (t) => {
          const xg = fairing0 + (fairing1 - fairing0) * t
          // Its ends turn down under the belly, so the line meets the silhouette instead of stopping on the skin.
          const lift = Math.sin(t * Math.PI)
          return [uOf(xg), vOf(180 - 51 * Math.sqrt(lift))]
        }),
        'faint',
      ),
    )
  const fills: Item[] = []
  const glass = (rings: Rings, framed = false) => {
    if (rings.length)
      fills.push({
        kind: 'fill',
        rings,
        mat: 'glass',
        ...(framed ? { edge: 'line' as const, width: 0.16 } : {}),
      })
  }
  /** Angle on the section (degrees from the crown) of a height above the fuselage bottom at a station. */
  const thetaAt = (xg: number, zAbove: number) => {
    const s = sec(xg)
    const h = (s.top - s.bottom) / 2,
      m = (s.top + s.bottom) / 2
    const z = s.bottom + zAbove
    return Math.acos(clamp((z - m) / h, -1, 1)) / D2R
  }
  // Cockpit glazing on the near side: the record's edge angles fix the sill and head heights at the aft edge, and the
  // panes keep those heights forward, so the windscreen climbs over the narrowing nose to the centre post by itself.
  {
    const aft = ckAft,
      fore = ckFore
    const s = sec(aft)
    const h = (s.top - s.bottom) / 2
    const sill = h + h * Math.sin((ck?.lowDeg ?? 28) * D2R),
      head = h + h * Math.sin((ck?.highDeg ?? 50) * D2R)
    const span = aft - fore
    const post = 0.06
    const cut1 = fore + 0.46 * span,
      cut2 = fore + 0.76 * span
    const lo = (x: number) => thetaAt(x, sill + 0.08 * (1 - (x - fore) / span))
    const hi = (x: number) => Math.max(thetaAt(x, head), 3)
    const pane = (corners: [number, number][]) =>
      glass(
        patch(
          body,
          corners.map(([x, th]) => [uOf(x), vOf(th)]),
          0.0,
        ),
        true,
      )
    // Windscreen: the front edge leans back from the sill corner over the nose to the centre post.
    const ws = (sg: number) =>
      pane([
        [fore + 0.1 * span, sg * lo(fore + 0.1 * span)],
        [cut1 - post, sg * lo(cut1 - post)],
        [cut1 - post, sg * hi(cut1 - post)],
        [fore + 0.2 * span, sg * hi(fore + 0.2 * span)],
        [fore + 0.02 * span, sg * Math.max(hi(fore), 3)],
      ])
    ws(-1)
    ws(1)
    // Two side windows, the sliding one first; the last one's aft edge sweeps up.
    pane([
      [cut1 + post, lo(cut1 + post)],
      [cut2 - post, lo(cut2 - post)],
      [cut2 - post, hi(cut2 - post)],
      [cut1 + post, hi(cut1 + post)],
    ])
    pane([
      [cut2 + post, lo(cut2 + post)],
      [aft, lo(aft) - 2],
      [aft - 0.12 * span, hi(aft)],
      [cut2 + post, hi(cut2 + post)],
    ])
  }
  // Doors (starboard: R1 forward, the last R door aft), overwing exits, cargo doors, then the window row.
  const doorH = Math.min(1.85, H * 0.9)
  const doorW = wide ? 1.07 : 0.81
  const windowZ = (deck: 'main' | 'upper') => {
    if (deck === 'upper' && g.fuselage.upperDeckWindowZ) return g.fuselage.upperDeckWindowZ
    if (g.fuselage.mainDeckWindowZ) return g.fuselage.mainDeckWindowZ
    return H * (prop ? 1.12 : 1.18)
  }
  const outlineUV = (xg: number, zMid: number, w: number, h: number) => {
    const t0 = thetaAt(xg, zMid + h / 2),
      t1 = thetaAt(xg, zMid - h / 2)
    return roundedUV(uOf(xg), vOf((t0 + t1) / 2), w / 2 / Lb, (t1 - t0) / 2 / 360, 0.3, 3)
  }
  const doorAt = (xg: number, w = doorW, h = doorH, zMid = windowZ('main') - 0.15) => {
    const loop = outlineUV(xg, zMid, w, h)
    const rings = patch(body, loop, 0.05)
    if (rings.length) skin.push({ runs: rings.map((r) => [...r, r[0]]), ink: 'seam', width: 0.26 })
  }
  const lastDoor = Lb - tc + (wide ? 1.2 : 0.95)
  const firstDoor = Math.max(g.fuselage.cockpitWindowX + 1.3, nl * 0.95)
  doorAt(firstDoor)
  doorAt(lastDoor)
  const wingMid = wg.rootLEx + wg.rootChord * 0.35
  const exits: number[] = []
  if (!prop) {
    if (wide) {
      doorAt(wg.rootLEx - 1.5)
      doorAt(rootTE + 1.2)
      if (Lb > 60) doorAt((firstDoor + wg.rootLEx - 1.5) / 2)
    } else if (Lb > 42) {
      doorAt(wg.rootLEx - 2.4)
      doorAt(rootTE + 2.0)
    } else {
      exits.push(wingMid - 0.5, wingMid + 0.5)
      for (const x of Lb < 35 ? [wingMid] : exits) doorAt(x, 0.51, 0.96, windowZ('main') - 0.05)
    }
  }
  // Cargo doors on the lower lobe, ahead of and behind the wing.
  if (!prop) {
    const cw = wide ? 2.7 : 1.82,
      ch = wide ? 1.7 : 1.24
    for (const x of [Math.max(firstDoor + 2.2, wg.rootLEx - 3.4), rootTE + (wide ? 4.5 : 2.2)]) {
      const loop = outlineUV(x, H * 0.55, cw, ch)
      const rings = patch(body, loop, 0.04)
      if (rings.length)
        skin.push({ runs: rings.map((r) => [...r, r[0]]), ink: 'faint', width: 0.22 })
    }
  }
  // Windows: one row (two on the A380), skipping doors and exits, at a ~0.53 m pitch.
  const decks: ('main' | 'upper')[] = g.fuselage.decks > 1 ? ['main', 'upper'] : ['main']
  const pitch = wide ? 0.53 : 0.533
  for (const deck of decks) {
    const z = windowZ(deck)
    const from = firstDoor + doorW / 2 + 0.55,
      to = lastDoor - doorW / 2 - 0.45
    for (let x = from; x <= to; x += pitch) {
      if (exits.some((e) => Math.abs(x - e) < 0.5) && !(Lb < 35)) continue
      if (wide && [wg.rootLEx - 1.5, rootTE + 1.2].some((d) => Math.abs(x - d) < 0.8)) continue
      if (!wide && Lb > 42 && [wg.rootLEx - 2.4, rootTE + 2.0].some((d) => Math.abs(x - d) < 0.75))
        continue
      if (Lb < 35 && Math.abs(x - wingMid) < 0.45) continue
      if (sec(x).w < R * 0.985) continue
      glass(patch(body, outlineUV(x, z, 0.24, 0.34), 0.1))
    }
  }
  // Antennas on the crown and the red beacon: small blades and a dot.
  const fusItem = solid(body, 'body', skin)
  items.push(fusItem, ...fills)
  // VHF blades on the crown, ahead of the wing and over the aft cabin.
  items.push(
    antenna(Math.max(firstDoor + 2.5, Lb * 0.24), prop ? 0.3 : 0.42, 0.55),
    antenna(Lb * 0.58, prop ? 0.3 : 0.4, 0.55),
  )
  // Fin in livery.
  const finS = foil(finFoil())
  const finInner: Lines[] = [
    seam(
      finS,
      curveUV(40, (t) => [t, vChord(0.7)]),
    ),
  ]
  if (tTail) items.push(stab(-1))
  items.push(solid(finS, 'livery', finInner))
  if (tTail) items.push(stab(1))

  // Near side.
  items.push(...bodyGear(1))
  if (high) {
    for (const e of nearEngines) {
      const { out } = engine(e, 1)
      items.push(...propGear(e, 1), ...out)
    }
    // The high wing spans both sides in one piece, on the crown.
    const both: Foil = {
      ...wingFoil(1),
      path: (t) => {
        const y = -wingEnd + 2 * wingEnd * t
        return [y, wingZ(Math.abs(y))]
      },
      le: (t) => leAt(Math.max(Math.abs(-wingEnd + 2 * wingEnd * t), 0)),
      te: (t) => teAt(Math.max(Math.abs(-wingEnd + 2 * wingEnd * t), 0)),
      tau: (t) => tau(Math.abs(-wingEnd + 2 * wingEnd * t)),
      up: () => [0, 1],
      root: undefined,
      rows: 60,
    }
    const wS = foil(both)
    items.push(
      // The flap and aileron hinge line, tip to tip across the crown.
      solid(wS, 'body', [
        seam(
          wS,
          curveUV(120, (t) => [t, vChord(0.74)]),
        ),
      ]),
    )
    for (const e of nearEngines) items.push(...engine(e, 1).front)
  } else {
    items.push(...mainGear(1))
    for (const e of nearEngines) {
      const { out, pylonItems } = engine(e, 1)
      items.push(...out, ...pylonItems)
    }
    items.push(...fairingsOf(1))
    items.push(solid(wingNearS, 'body', wingSeams(wingNearS)))
    for (const d of devices(1)) items.push(solid(d, 'livery'))
    if (stabNear) items.push(stabNear)
  }
  const groundY = prop ? engines[0].y : trackHalf + (tyreW / 2 + 0.12)
  const beaconX = tTail
    ? vt.rootLEx + tan(vt.sweepLE) * vt.height + 0.3 * vt.tipChord
    : wg.rootLEx + 0.35 * wg.rootChord
  const beacon: V3 = [-beaconX, 0, tTail ? finTopZ + 0.15 : crownZ(beaconX, 0) + 0.1]
  return { items, groundY, tail: -Lb, nose: 0, beacon }
}

/** Parses an M/L/Z path into rings (closed) or runs (open). */
export function ringsOfPath(d: string, closed = true): Rings {
  if (!d) return []
  const out: Rings = []
  for (const run of d.split('M').filter(Boolean)) {
    const pts = run
      .replace(/Z/g, '')
      .split('L')
      .map((p) => {
        const [x, y] = p
          .trim()
          .split(/[\s,]+/)
          .map(Number)
        return [x, y] as Pt
      })
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    if (pts.length > 1) out.push(closed ? pts : pts)
  }
  return out
}
