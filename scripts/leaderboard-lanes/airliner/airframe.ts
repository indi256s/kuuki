// The aircraft record turned into derived geometry: the wing planform, the stance, the fuselage sections and the tail
// flags, in the frame of airliner.ts. No camera or kit: these values and surfaces stay in world coordinates.
import type { AircraftGeometry } from './model'
import type { Surface, V3 } from './surface'

export const D2R = Math.PI / 180
export const tan = (deg: number) => Math.tan(deg * D2R)
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const smooth = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

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
export function stations(n: number, at: number[] = [], ends = 0): number[] {
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

/** A fuselage section at a station: the heights of its crown and keel and its half-width. */
type Sec = { top: number; bottom: number; w: number }

export const midHalf = (s: Sec) => [(s.top + s.bottom) / 2, (s.top - s.bottom) / 2] as const
export const nacelleFlat = (e: AircraftGeometry['engines'][number]) =>
  e.section === 'flat-bottom' ? 0.82 : 1

/** Wheel track (m) by ICAO type, then by family; published values, rounded. */
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

export type Airframe = {
  g: AircraftGeometry
  /** The fuselage's length to the end of its tail cone: the record's `end`, else the overall length. */
  Lb: number
  /** The barrel's half width and half height. */
  R: number
  H: number
  /** The nose and tail cone lengths. */
  nl: number
  tc: number
  high: boolean
  prop: boolean
  wide: boolean
  half: number
  /** Where the wing root meets the barrel: low wings below its widest line, the high wing on the crown (y = 0). */
  y0: number
  /** Where the straight wing ends (a device or the raked tip continues from here). */
  tipY: number
  /** Where the wing's own foil ends: the true tip at half span for a raked tip, else `tipY`. */
  wingEnd: number
  kink: number | null
  rake: { x: number; y: number }[] | null
  rootTE: number
  /** Leading and trailing edge stations (xg) of the wing at y, the raked tip included. */
  leAt: (y: number) => number
  teAt: (y: number) => number
  chordAt: (y: number) => number
  /** Thickness ratio: a supercritical root about 14%, thinning to 10% at the tip (turboprop 16 to 12%). */
  tau: (y: number) => number
  tanD: number
  /** Height of the wing's chord plane at y. */
  wingZ: (y: number) => number
  /** Height of the wing's lower skin at y. */
  lowerAt: (y: number) => number
  wheelD: number
  tyreW: number
  /** Half the wheel track. */
  trackHalf: number
  /** Height of the barrel's centre line. */
  zc: number
  sec: (xg: number) => Sec
  /** The belly fairing under the wing box, from fairing0 to fairing1 (xg). */
  fairing0: number
  fairing1: number
  body: Surface
  /** The skin's half-width at height z, and the crown's height at y (for parts that stand on it). */
  skinY: (xg: number, z: number) => number
  crownZ: (xg: number, y: number) => number
  /** Angle on the section (degrees from the crown) of a height above the fuselage bottom at a station. */
  thetaAt: (xg: number, zAbove: number) => number
  tTail: boolean
  finTopZ: number
}

export function airframeOf(g: AircraftGeometry): Airframe {
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
      : Math.max(tip.height, tip.type === 'at-winglet' ? tip.below : 0) * tan(tip.cant)
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
  const lowerWith = (y: number, belly: number) =>
    rootUpOf(belly) + tanD * (y - y0) - (high ? 0.5 : 0.42) * tau(y) * chordAt(y)
  const nacelleBottom = (e: AircraftGeometry['engines'][number], belly: number) =>
    lowerWith(e.y, belly) - e.dropBelowWing - (e.nacelleDiameter / 2) * nacelleFlat(e)
  const clearance = prop ? 0.95 : 0.5
  const belly = Math.max(
    high ? 1.0 : wheelD * 1.2,
    ...g.engines.map((e) => clearance - nacelleBottom(e, 0)),
  )
  const lowerAt = (y: number) => lowerWith(y, belly)
  const wingZ = (y: number) => rootUpOf(belly) + tanD * (y - y0)
  const zc = belly + H

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
    const [m, h] = midHalf(s)
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
  const skinY = (xg: number, z: number) => {
    const s = sec(xg)
    const [m, h] = midHalf(s)
    const t = (z - m) / h
    return Math.abs(t) >= 1 ? 0 : s.w * Math.sqrt(1 - t * t)
  }
  const crownZ = (xg: number, y: number) => {
    const s = sec(xg)
    const [m, h] = midHalf(s)
    const t = y / s.w
    return Math.abs(t) >= 1 ? m : m + h * Math.sqrt(1 - t * t)
  }
  const thetaAt = (xg: number, zAbove: number) => {
    const s = sec(xg)
    const [m, h] = midHalf(s)
    const z = s.bottom + zAbove
    return Math.acos(clamp((z - m) / h, -1, 1)) / D2R
  }

  // ------------------------------------------------------------ tail flags and landing gear sizes
  const tTail = g.htail.position === 't-tail'
  const finTopZ = crownZ(g.vtail.rootLEx, 0) + g.vtail.height
  const trackHalf = (tracks[g.icao] ?? tracks[fam] ?? Math.max(2.4 * R, 0.2 * g.dims.span)) / 2
  const tyreW = wheelD * 0.36

  return {
    g,
    Lb,
    R,
    H,
    nl,
    tc,
    high,
    prop,
    wide,
    half,
    y0,
    tipY,
    wingEnd,
    kink,
    rake,
    rootTE,
    leAt,
    teAt,
    chordAt,
    tau,
    tanD,
    wingZ,
    lowerAt,
    wheelD,
    tyreW,
    trackHalf,
    zc,
    sec,
    fairing0,
    fairing1,
    body,
    skinY,
    crownZ,
    thetaAt,
    tTail,
    finTopZ,
  }
}
