// A 993-inspired narrow-body coupe in metres: tail station 0, nose station LENGTH, z above the road.
// Envelope and wheelbase are factory dimensions; all intermediate skin and trim stations are illustrative.
import type { Surface, V3 } from '../airliner/surface'

export const LENGTH = 4.245
export const WIDTH = 1.735
export const HEIGHT = 1.3
export const WHEELBASE = 2.272
export const AXLES = [1.073, 1.073 + WHEELBASE] as const
export const TYRE_R = 0.315
export const ARCH_R = 0.365
export const TRACK = [1.444, 1.405] as const
export const TYRE_W = [0.245, 0.205] as const

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
// Monotone Hermite interpolation keeps the roof and body free of spline overshoot at short stations.
export function profile(rows: [number, number][]) {
  const slopes = rows.slice(1).map(([x, y], i) => (y - rows[i][1]) / (x - rows[i][0]))
  const tangent = rows.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === rows.length - 1) return slopes[i - 1]
    const a = slopes[i - 1],
      b = slopes[i]
    return a * b <= 0 ? 0 : 2 / (1 / a + 1 / b)
  })
  return (x: number) => {
    const i = Math.max(0, Math.min(rows.length - 2, rows.findIndex(([q]) => q > x) - 1))
    if (x <= rows[0][0]) return rows[0][1]
    if (x >= rows.at(-1)![0]) return rows.at(-1)![1]
    const [a, va] = rows[i],
      [b, vb] = rows[i + 1]
    const h = b - a,
      t = (x - a) / h
    return (
      (2 * t ** 3 - 3 * t * t + 1) * va +
      (t ** 3 - 2 * t * t + t) * h * tangent[i] +
      (-2 * t ** 3 + 3 * t * t) * vb +
      (t ** 3 - t * t) * h * tangent[i + 1]
    )
  }
}
export const halfWidth = profile([
  [0, 0.52],
  [0.14, 0.7],
  [0.45, 0.81],
  [1.03, WIDTH / 2],
  [1.65, 0.81],
  [2.65, 0.795],
  [3.35, 0.835],
  [3.8, 0.78],
  [4.1, 0.68],
  [LENGTH, 0.5],
])
const belt = profile([
  [0, 0.52],
  [0.2, 0.65],
  [0.65, 0.78],
  [1.073, 0.82],
  [1.65, 0.77],
  [2.65, 0.76],
  [3.345, 0.82],
  [3.75, 0.77],
  [4.1, 0.62],
  [LENGTH, 0.49],
])
const deck = profile([
  [0, 0.58],
  [0.25, 0.72],
  [0.8, 0.84],
  [1.5, 0.84],
  [2.8, 0.82],
  [3.15, 0.77],
  [3.65, 0.7],
  [4.05, 0.58],
  [LENGTH, 0.5],
])
const roof = profile([
  [0.55, 0.81],
  [0.85, 0.95],
  [1.25, 1.13],
  [1.65, 1.26],
  [1.95, HEIGHT],
  [2.24, 1.29],
  [2.48, 1.2],
  [2.73, 1.01],
  [2.96, 0.82],
])
const cabinWidth = profile([
  [0.55, 0.42],
  [0.9, 0.53],
  [1.4, 0.63],
  [2.15, 0.64],
  [2.5, 0.61],
  [2.8, 0.57],
  [2.96, 0.51],
])
const baseZ = 0.24
export const at = (a: number, y: number, z: number): V3 => [a - LENGTH, y, z]
const endSweep = (a: number, yFraction: number) =>
  a +
  0.12 * yFraction * yFraction * (1 - smooth(a / 0.3)) -
  0.14 * yFraction * yFraction * smooth((a - 3.9) / 0.345)
/** The wheel cut is a real boundary of each side panel, not a dark patch painted over a closed body. */
export function lowerEdge(a: number) {
  let z = baseZ
  for (const axle of AXLES) {
    const dx = a - axle
    if (Math.abs(dx) < ARCH_R)
      z = Math.max(z, baseZ + (TYRE_R + ARCH_R - baseZ) * Math.sqrt(1 - (dx / ARCH_R) ** 2))
  }
  return z
}
export const sideAt = (a: number, z: number, sg = 1): V3 =>
  at(
    endSweep(a, sg),
    sg * halfWidth(a) * (1 - 0.055 * (1 - clamp((z - baseZ) / (belt(a) - baseZ))) ** 2),
    z,
  )
export const topAt = (a: number, v: number): V3 => {
  const theta = v * Math.PI
  const f = Math.cos(theta)
  const y = halfWidth(a) * Math.sign(f) * Math.abs(f) ** 0.55
  const z = belt(a) + (deck(a) - belt(a)) * Math.sin(theta) ** 1.1
  return at(endSweep(a, f), y, z)
}
export const top: Surface = {
  at: (u, v) => topAt(u * LENGTH, v),
  u: 100,
  v: 52,
  closed: false,
  flip: true,
}
// Include every arch endpoint and crown, so no sampled side polygon bridges a wheel opening.
const xs = [
  ...Array.from({ length: 121 }, (_, i) => (LENGTH * i) / 120),
  ...AXLES.flatMap((a) =>
    Array.from({ length: 41 }, (_, i) => a + ARCH_R * Math.cos((Math.PI * i) / 40)),
  ),
].sort((a, b) => a - b)
export const side = (sg: number): Surface => ({
  at: (u, v) => {
    const a = u * LENGTH,
      low = lowerEdge(a),
      z = low + (belt(a) - low) * v
    return sideAt(a, z, sg)
  },
  u: xs.map((x) => x / LENGTH),
  v: 10,
  closed: false,
  flip: sg > 0,
})
/** Cabin section: upright at the belt, round shoulders into a broad roof; one continuous fastback. */
export const cabinAt = (a: number, v: number): V3 => {
  const theta = v * Math.PI,
    f = Math.cos(theta)
  const y = cabinWidth(a) * Math.sign(f) * Math.abs(f) ** 0.68
  const base = 0.8
  return at(a, y, base + (roof(a) - base) * Math.sin(theta) ** 0.48)
}
export const cabin: Surface = {
  at: (u, v) => cabinAt(0.55 + 2.41 * u, v),
  u: 85,
  v: 48,
  closed: false,
  flip: true,
}
export const cabinU = (a: number) => (a - 0.55) / 2.41
