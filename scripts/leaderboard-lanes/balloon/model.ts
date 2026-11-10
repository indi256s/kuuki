// A hot-air balloon in metres: the envelope axis stands on x = CX, the basket's base centre on z = 0, and the
// envelope's leading edge touches x = 0 (the same "nose" anchor the ground vehicles use). Dimensions follow a large
// passenger balloon (about 16 m wide, 25 m to the crown); the basket is a size up so it reads at lane size. The skin
// stations, the cable layout and every trim size are illustrative.
import type { Surface, V3 } from '../airliner/surface'

export const GORES = 12
export const R_MAX = 8.2
export const WIDTH = 2 * R_MAX
export const CX = -R_MAX
/** Envelope height above its mouth, and the heights of the skirt, its hem, the frame and the basket rim. */
export const ENV_H = 18
export const SKIRT_TOP = 7.0
export const HEM_Z = 6.0
export const HEM_R = 2.3
export const FRAME_Z = 3.6
export const RIM_Z = 1.38
export const CROWN_Z = SKIRT_TOP + ENV_H
export const CROWN_R = 0.9
/** Horizontal load tapes, by height above the mouth. */
export const TAPES = [3.4, 8.4, 13.6]

export const W = (x: number, y: number, z: number): V3 => [CX + x, y, z]
export const TAU = Math.PI * 2
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const frac = (x: number) => x - Math.floor(x)

/** Centripetal-free uniform Catmull-Rom through control points, resampled by arc length. */
function meridianOf(ctrl: [number, number][]) {
  const pts: [number, number][] = []
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]
  for (let i = 1; i < P.length - 2; i++)
    for (let k = 0; k < 24; k++) {
      const t = k / 24,
        t2 = t * t,
        t3 = t2 * t
      const f = (j: 0 | 1) =>
        0.5 *
        (2 * P[i][j] +
          (-P[i - 1][j] + P[i + 1][j]) * t +
          (2 * P[i - 1][j] - 5 * P[i][j] + 4 * P[i + 1][j] - P[i + 2][j]) * t2 +
          (-P[i - 1][j] + 3 * P[i][j] - 3 * P[i + 1][j] + P[i + 2][j]) * t3)
      pts.push([f(0), f(1)])
    }
  pts.push(ctrl[ctrl.length - 1])
  const cum = [0]
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = cum[cum.length - 1]
  const at = (u: number): [number, number] => {
    const s = clamp(u) * total
    let lo = 0,
      hi = cum.length - 1
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (cum[m] <= s) lo = m
      else hi = m
    }
    const k = (s - cum[lo]) / (cum[hi] - cum[lo] || 1)
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * k, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * k]
  }
  return { at, total }
}

/** (radius, height above the mouth) from the crown (u = 0) down to the mouth (u = 1): a natural-shape envelope. */
export const envelopeMeridian = meridianOf(
  (
    [
      [0.9, 18.0],
      [2.0, 17.85],
      [3.9, 17.3],
      [5.6, 16.4],
      [6.9, 15.0],
      [7.7, 13.3],
      [8.15, 11.4],
      [8.2, 9.4],
      [7.85, 7.4],
      [7.1, 5.4],
      [6.0, 3.5],
      [4.6, 1.9],
      [3.3, 0.7],
      [2.45, 0],
    ] as [number, number][]
  ).map(([r, h]) => [r, h]),
)
/** The u at a height above the mouth (the meridian's height only falls with u past the crown). */
export function uAtHeight(h: number) {
  let lo = 0,
    hi = 1
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (envelopeMeridian.at(m)[1] > h) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** Where gore 0 starts, in radians about the axis: set by the drawing so a livery gore faces the viewer. */
export const phase = { value: 0 }
export const angleOf = (v: number) => phase.value + TAU * v

/** Panels bulge between their seams, which sit as shallow valleys: the silhouette and the shading carry it. */
const bulge = (u: number, v: number) => {
  const g = frac(v * GORES)
  return (
    1 +
    0.012 *
      Math.sin(Math.PI * clamp(u * 12)) *
      Math.sin(Math.PI * clamp((1 - u) * 14)) *
      Math.sin(Math.PI * g) ** 0.7
  )
}
export const envelopeAt = (u: number, v: number): V3 => {
  const [r, h] = envelopeMeridian.at(u)
  const a = angleOf(v),
    rr = r * bulge(u, v)
  return W(rr * Math.cos(a), rr * Math.sin(a), SKIRT_TOP + h)
}
export const envelope: Surface = {
  at: envelopeAt,
  u: Array.from({ length: 121 }, (_, i) => i / 120),
  v: GORES * 12,
  closed: true,
}
/** The envelope's gores, between v0 and v1 (in gore units), as their own surface so a livery panel shades alike. */
export const gore = (v0: number, v1: number, u0 = 0, u1 = 1): Surface => ({
  at: (u, v) => envelopeAt(u0 + (u1 - u0) * u, (v0 + (v1 - v0) * v) / GORES),
  u: Array.from({ length: 121 }, (_, i) => i / 120),
  v: Math.max(4, Math.ceil((v1 - v0) * 12)),
  closed: false,
})
export const band = (u0: number, u1: number): Surface => gore(0, GORES, u0, u1)

const skirtMeridian = meridianOf([
  [2.45, 0],
  [2.53, -0.32],
  [2.42, -0.7],
  [HEM_R, -1.0],
])
export const skirtAt = (u: number, v: number): V3 => {
  const [r, h] = skirtMeridian.at(u)
  const a = angleOf(v),
    rr = r * (1 + 0.012 * Math.sin(Math.PI * frac(v * GORES)) ** 0.7)
  return W(rr * Math.cos(a), rr * Math.sin(a), SKIRT_TOP + h)
}
export const skirt: Surface = {
  at: skirtAt,
  u: 16,
  v: GORES * 12,
  closed: true,
}
export const hemPoint = (i: number, r = HEM_R + 0.02): V3 => {
  const a = angleOf(i / GORES)
  return W(r * Math.cos(a), r * Math.sin(a), HEM_Z)
}

/** A rounded rectangle of half extents (a, b) and corner radius r, by arc length t over [0, 1): point and outward normal. */
export function roundRect(a: number, b: number, r: number, t: number) {
  const sx = 2 * (a - r),
    sy = 2 * (b - r),
    arc = (Math.PI * r) / 2
  const segs: [number, (s: number) => [number, number, number, number]][] = [
    [sy, (s) => [a, -(b - r) + s, 1, 0]],
    [arc, (s) => corner(a - r, b - r, s / r, 0)],
    [sx, (s) => [a - r - s, b, 0, 1]],
    [arc, (s) => corner(-(a - r), b - r, s / r, Math.PI / 2)],
    [sy, (s) => [-a, b - r - s, -1, 0]],
    [arc, (s) => corner(-(a - r), -(b - r), s / r, Math.PI)],
    [sx, (s) => [-(a - r) + s, -b, 0, -1]],
    [arc, (s) => corner(a - r, -(b - r), s / r, (3 * Math.PI) / 2)],
  ]
  function corner(
    cx: number,
    cy: number,
    th: number,
    th0: number,
  ): [number, number, number, number] {
    const c = Math.cos(th0 + th),
      s = Math.sin(th0 + th)
    return [cx + r * c, cy + r * s, c, s]
  }
  const total = segs.reduce((n, [l]) => n + l, 0)
  let s = (((t % 1) + 1) % 1) * total
  for (const [l, f] of segs) {
    if (s <= l) return f(s)
    s -= l
  }
  return segs[0][1](0)
}
/** The parameter t at the middle of corner arc k (0..3, counter-clockwise from the right edge). */
export function cornerT(a: number, b: number, r: number, k: number) {
  const sx = 2 * (a - r),
    sy = 2 * (b - r),
    arc = (Math.PI * r) / 2
  const total = 2 * sx + 2 * sy + 4 * arc
  const starts = [sy, sy + arc + sx, 2 * sy + 2 * arc + sx, 2 * sy + 3 * arc + 2 * sx]
  return (starts[k] + arc / 2) / total
}
/** The parameter t on the near (+y) wall at lateral position x. */
export function nearT(a: number, b: number, r: number, x: number) {
  const sx = 2 * (a - r),
    sy = 2 * (b - r),
    arc = (Math.PI * r) / 2
  const total = 2 * sx + 2 * sy + 4 * arc
  return (sy + arc + (a - r - x)) / total
}

export const BASKET = { a: 1.3, b: 0.8, r: 0.22, flare: 0.07, z0: 0.02, z1: RIM_Z - 0.08 }
const basketAt =
  (grow: number, zLo: number, zHi: number) =>
  (u: number, v: number): V3 => {
    const k = BASKET.flare * u
    const p = roundRect(BASKET.a + k + grow, BASKET.b + k + grow, BASKET.r, v)
    return W(p[0], p[1], zLo + (zHi - zLo) * u)
  }
export const basketOuter = (u0 = 0, u1 = 1, v0 = 0, v1 = 1): Surface => {
  const f = basketAt(0, BASKET.z0, BASKET.z1)
  return {
    at: (u, v) => f(u0 + (u1 - u0) * u, v0 + (v1 - v0) * v),
    u: Math.max(2, Math.ceil((u1 - u0) * 10)),
    v: Math.max(8, Math.ceil((v1 - v0) * 220)),
    closed: false,
  }
}
export const basketInner: Surface = {
  at: basketAt(-0.07, 0.12, RIM_Z),
  u: 8,
  v: 200,
  closed: true,
}
/** The rim's padded tube: its path at the wall's top, tube radius PAD. */
export const PAD = 0.095
export const rimPath = (t: number): { p: V3; n: [number, number] } => {
  const q = roundRect(BASKET.a + 0.08, BASKET.b + 0.08, BASKET.r + 0.06, t)
  return { p: W(q[0], q[1], RIM_Z), n: [q[2], q[3]] }
}
export const rimAt =
  (t0: number, t1: number) =>
  (u: number, v: number): V3 => {
    const { p, n } = rimPath(t0 + (t1 - t0) * u)
    const phi = TAU * v
    return [
      p[0] + PAD * Math.cos(phi) * n[0],
      p[1] + PAD * Math.cos(phi) * n[1],
      p[2] + PAD * Math.sin(phi),
    ]
  }
