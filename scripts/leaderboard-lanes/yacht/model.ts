// A modern cruising sloop in metres: stern station a = 0, bow station LOA, z up from the waterline, y positive on
// the near flank. The envelope is a typical 11 m production cruiser; every intermediate station, fitting size and
// rig dimension is an illustrative estimate. The mast head sits at 12.95 m, a little under scale, so a 56-72 px boat
// stays a boat rather than a mast.
import { profile } from '../car/model'
import type { Surface, V3 } from '../airliner/surface'

export const LOA = 11
export const BEAM = 3.6
export const at = (a: number, y: number, z: number): V3 => [a - LOA, y, z]

const clamp = (x: number) => Math.max(0, Math.min(1, x))
export const smooth = (x: number) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
export const D2R = Math.PI / 180

// ------------------------------------------------------------------------------------------------ hull
/** Half beam at the sheer, at the waterline, and the sheer height above the water. */
export const hb = profile([
  [0, 1.28],
  [0.6, 1.5],
  [2, 1.72],
  [3.6, 1.8],
  [5, 1.76],
  [6.6, 1.56],
  [8.2, 1.12],
  [9.6, 0.58],
  [10.5, 0.2],
  [LOA, 0],
])
export const hw = profile([
  [0, 0.98],
  [1, 1.3],
  [3, 1.52],
  [4.6, 1.55],
  [6.4, 1.38],
  [8.2, 1.0],
  [9.6, 0.5],
  [10.5, 0.16],
  [LOA, 0],
])
export const zs = profile([
  [0, 0.82],
  [1, 0.78],
  [3, 0.73],
  [5, 0.72],
  [7, 0.77],
  [9, 0.88],
  [10.4, 1.0],
  [LOA, 1.08],
])
export const deckZ = (a: number, y = 0) => {
  const h = Math.max(hb(a), 0.05)
  return zs(a) + 0.07 * Math.max(0, 1 - (y / h) ** 2)
}
/** Stern and stem rake: the waterline is shorter than the sheer at both ends. */
const rake = (a: number, t: number) =>
  0.36 * (1 - t) * (1 - smooth(a / 0.7)) - 0.8 * (1 - t) * smooth((a - 9.6) / 1.4)
/** A point on the topsides: a is the sheer station, t the height fraction from the waterline (0) to the sheer (1). */
export const sideAt = (a: number, t: number, sg = 1): V3 =>
  at(a + rake(a, t), sg * (hw(a) + (hb(a) - hw(a)) * t ** 0.8), zs(a) * t)
const ustations = Array.from({ length: 141 }, (_, i) => i / 140)
export const side = (sg: number): Surface => ({
  at: (u, v) => sideAt(u * LOA, v, sg),
  u: ustations,
  v: 8,
  closed: false,
  flip: sg > 0,
})
export const deck: Surface = {
  at: (u, v) => {
    const a = u * LOA,
      y = (2 * v - 1) * hb(a)
    return at(a, y, deckZ(a, y))
  },
  u: ustations,
  v: 14,
  closed: false,
}

// ------------------------------------------------------------------------------------------------ coachroof
export const CB = 0.74
export const roofH = profile([
  [3.6, 1.38],
  [4.6, 1.5],
  [6, 1.52],
  [7, 1.47],
  [7.55, 1.33],
  [8, 1.12],
  [8.4, 0.8],
])
export const roofW = profile([
  [3.6, 1.0],
  [4.6, 1.14],
  [6, 1.14],
  [7, 1.02],
  [7.6, 0.82],
  [8, 0.66],
  [8.4, 0.35],
])
export const CAB0 = 3.6
export const CAB1 = 8.4
export const cabinAt = (a: number, v: number): V3 => {
  const th = v * Math.PI,
    f = Math.cos(th)
  return at(
    a,
    roofW(a) * Math.sign(f) * Math.abs(f) ** 0.62,
    CB + (roofH(a) - CB) * Math.sin(th) ** 0.45,
  )
}
export const cabinU = (a: number) => (a - CAB0) / (CAB1 - CAB0)
export const cabin: Surface = {
  at: (u, v) => cabinAt(CAB0 + (CAB1 - CAB0) * u, v),
  u: 70,
  v: 40,
  closed: false,
  flip: true,
}
/** Roof height where the cabin is |y| wide: the sprayhood stands on it. */
export const roofAtY = (a: number, y: number) => {
  const f = Math.min(1, Math.abs(y) / roofW(a)) ** (1 / 0.62)
  return CB + (roofH(a) - CB) * Math.sin(Math.acos(f)) ** 0.45
}

// Sprayhood over the companionway: an arch that ramps down into the roof.
export const HOOD0 = 3.6
export const HOOD1 = 4.75
const hoodW = (a: number) => roofW(a) * 0.8
const hoodTop = (a: number) => roofH(a) + 0.5 * (1 - smooth((a - 3.75) / (HOOD1 - 3.75))) ** 0.9
export const hoodAt = (a: number, v: number): V3 => {
  const th = v * Math.PI,
    f = Math.cos(th),
    w = hoodW(a)
  const z0 = roofAtY(a, w * 0.98) - 0.02
  return at(
    a,
    w * Math.sign(f) * Math.abs(f) ** 0.5,
    z0 + Math.max(0.01, hoodTop(a) - z0) * Math.sin(th) ** 0.6,
  )
}
export const hoodU = (a: number) => (a - HOOD0) / (HOOD1 - HOOD0)
export const hood: Surface = {
  at: (u, v) => hoodAt(HOOD0 + (HOOD1 - HOOD0) * u, v),
  u: 24,
  v: 28,
  closed: false,
  flip: true,
}

// ------------------------------------------------------------------------------------------------ rig
export const MAST = { a: 6.2, base: 1.5, top: 12.95 }
export const BOOM = { z: 1.66, rise: 0.04, len: 3.95, swing: 14 * D2R, y0: 0.07, a0: 6.14 }
const MAIN_FOOT = 3.85
const MAIN_HEAD = 12.05
const mainChord = (v: number) =>
  0.42 + (MAIN_FOOT - 0.42) * (1 - v) ** 1.22 + 0.5 * Math.sin(Math.PI * v) ** 1.3
export const boomAt = (d: number): V3 =>
  at(BOOM.a0 - d * Math.cos(BOOM.swing), BOOM.y0 + d * Math.sin(BOOM.swing), BOOM.z + BOOM.rise * d)
/** Mainsail: u luff to leech, v boom to head. Sheeted to the near flank, belly to leeward (near), twisting open aloft. */
export const mainAt = (u: number, v: number): V3 => {
  const c = mainChord(v),
    d = u * c
  const th = BOOM.swing + 8 * D2R * v
  const belly = 0.12 * c * Math.sin(Math.PI * u ** 0.82) * (0.85 - 0.45 * v)
  const zFoot = BOOM.z + 0.07 + BOOM.rise * d
  return at(
    BOOM.a0 - d * Math.cos(th),
    BOOM.y0 + d * Math.sin(th) + belly,
    (1 - v) * zFoot + v * MAIN_HEAD,
  )
}
export const mainSail: Surface = {
  at: mainAt,
  u: 30,
  v: 44,
  closed: false,
}

export const FORESTAY_TOP: V3 = at(6.32, 0, 12.7)
export const STEM: V3 = at(10.75, 0, 1.12)
const onForestay = (t: number): V3 => [
  FORESTAY_TOP[0] + (STEM[0] - FORESTAY_TOP[0]) * t,
  0,
  FORESTAY_TOP[2] + (STEM[2] - FORESTAY_TOP[2]) * t,
]
export const JIB = {
  tack: onForestay(0.988),
  head: onForestay(0.065),
  clew: at(5.85, 1.28, 1.9),
}
/** Jib: u luff to clew, v foot to head. */
export const jibAt = (u: number, vv: number): V3 => {
  // The head is a point; stop a hair short so the surface keeps a normal there.
  const v = vv * 0.994
  const { tack, head, clew } = JIB
  const L: V3 = [
    tack[0] + (head[0] - tack[0]) * v,
    tack[1] + (head[1] - tack[1]) * v,
    tack[2] + (head[2] - tack[2]) * v,
  ]
  const hollow = 0.1 * Math.sin(Math.PI * v)
  const E: V3 = [
    clew[0] + (head[0] - clew[0]) * v + hollow,
    clew[1] + (head[1] - clew[1]) * v,
    clew[2] + (head[2] - clew[2]) * v,
  ]
  const d: V3 = [E[0] - L[0], E[1] - L[1], E[2] - L[2]]
  const len = Math.hypot(...d)
  const belly = 0.11 * len * Math.sin(Math.PI * u ** 0.85) * (1 - 0.55 * v)
  return [L[0] + d[0] * u, L[1] + d[1] * u + belly, L[2] + d[2] * u]
}
export const jibSail: Surface = {
  at: jibAt,
  u: 26,
  v: 40,
  closed: false,
}
