// Rock texture, the shared answer to "uniform vertical lines read as drapes": a lit rock mass is
// paper with short uneven horizontal strata dashes and a few fracture ticks, and T4 hatching sits
// on the shaded side only, behind a slanted terminator. `rockMass` is the helper every waterfall
// profile and the Diosso gorge use; `rockStrataB` exposes it as a kit module (a lone outcrop).
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  type Weight,
  hatch,
  occlude,
  ptsBounds,
  stroke,
  toneFill,
} from '../grid'
import { canopyNodes } from './mass-b'
import { type KitModule, num } from './util'

/** Sutherland-Hodgman against the half-plane f(p) >= 0, f linear. */
export function clipPoly(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    const fa = f(a),
      fb = f(b)
    if (fa >= 0) out.push(a)
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb)
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  return out
}

/** Long, gently wavering horizontal strata with a few breaks, plus diagonal fracture ticks. */
export function strata(
  poly: Pt[],
  rand: () => number,
  o: { gap?: number; weight?: Weight; cracks?: number } = {},
): SvgNode[] {
  const gap = o.gap ?? 3.8
  const out: SvgNode[] = []
  for (const row of hatch(poly, 'h', gap, o.weight ?? 'hair', 1.4)) {
    if (row.kind !== 'stroke') continue
    const [a, b] = row.pts
    const ph = rand() * 6
    let cx = a[0] + rand() * 3
    while (cx < b[0] - 3) {
      const e = Math.min(b[0], cx + 16 + rand() * 38)
      if (e - cx > 3) {
        const mid = (cx + e) / 2
        const wob = (xx: number) => a[1] + 0.55 * Math.sin(xx * 0.21 + ph)
        out.push(
          stroke(row.weight, [
            [cx, wob(cx)],
            [mid, wob(mid)],
            [e, wob(e)],
          ]),
        )
      }
      cx = e + 2 + rand() * 5
    }
  }
  const [x0, y0, x1, y1] = ptsBounds(poly)
  for (let k = 0; k < (o.cracks ?? 0); k++) {
    const cx = x0 + (x1 - x0) * (0.12 + 0.76 * rand())
    const cy = y0 + (y1 - y0) * (0.2 + 0.6 * rand())
    const len = 4 + rand() * 6
    if (pointIn(poly, [cx, cy]) && pointIn(poly, [cx + len * 0.35, cy + len])) {
      out.push(
        stroke('fine', [
          [cx, cy],
          [cx + len * 0.35, cy + len],
        ]),
      )
    }
  }
  return out
}

/** Subdivides each edge and nudges the new points, so rock edges are not ruler-straight. */
export function rough(poly: Pt[], rand: () => number, amp = 1, step = 6): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    out.push(a)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.floor(len / step)
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      const nx = -(b[1] - a[1]) / (len || 1),
        ny = (b[0] - a[0]) / (len || 1)
      const j = (rand() - 0.5) * 2 * amp
      out.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j])
    }
  }
  return out
}

function pointIn(poly: Pt[], p: Pt): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export type RockOpts = {
  /** Top silhouette drawn as a `line` stroke (the lit ridge). */
  ridge?: Pt[]
  /** Fraction of the width where the shade begins (0 = all T4, 1 = all lit). */
  shade?: number
  /** Shade on the right (light from the left) or the left. */
  side?: 'right' | 'left'
  /** Terminator slant in units of x per unit of y. */
  slant?: number
  strataGap?: number
  cracks?: number
  /** Skip the occlusion (when the caller already erased the backdrop). */
  keep?: boolean
  /** Gap of the T4 hatching (default 2.4; narrow pillars use 2.0 to read near solid). */
  darkGap?: number
  /** Keep the polygon edges as given (default: roughened). */
  smooth?: boolean
  /** Add long horizontal strata over the fracture hatching (small masses only: both together make a lattice). */
  strata?: boolean
  /** Gap and angle of the diagonal fracture hatching on the lit side. */
  fracture?: number
  angle?: number
}

/** A rock mass: erases what is behind, strata on the lit side, T4 on the shaded side. */
export function rockMass(poly0: Pt[], rand: () => number, o: RockOpts = {}): SvgNode[] {
  const poly = o.smooth ? poly0 : rough(poly0, rand, 0.9, 7)
  const [x0, y0, x1, y1] = ptsBounds(poly)
  const side = o.side ?? 'right'
  const cut0 = x0 + (x1 - x0) * (o.shade ?? 0.6)
  const slant = o.slant ?? 0.18
  const ym = (y0 + y1) / 2
  const cutAt = (y: number) => cut0 + slant * (y - ym)
  const dark = clipPoly(poly, ([x, y]) => (side === 'right' ? x - cutAt(y) : cutAt(y) - x))
  const lit = clipPoly(poly, ([x, y]) => (side === 'right' ? cutAt(y) - x : x - cutAt(y)))
  const out: SvgNode[] = []
  if (!o.keep) out.push(occlude(poly))
  if (lit.length > 2) {
    // Fine diagonal fracture hatching (the T2 distance tone, opened up) sets lit rock apart from
    // the horizontal sky, with sparse long strata on top.
    if (o.fracture !== 0)
      out.push(...toneFill(lit, 'T2', { gap: o.fracture ?? 4.8, angle: o.angle ?? -58 }))
    if (o.strata)
      out.push(...strata(lit, rand, { gap: (o.strataGap ?? 3.8) * 2.2, cracks: o.cracks }))
  }
  if (dark.length > 2) out.push(...toneFill(dark, 'T4', { gap: o.darkGap ?? 2.4, weight: 'hair' }))
  if (o.ridge) out.push(stroke('line', o.ridge))
  return out
}

/** A lone outcrop: lumpy lit rock with strata, shaded right side, ridge in `line`. */
export const rockStrataB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const ridge: Pt[] = []
  for (let i = 0; i <= 12; i++) {
    const u = i / 12
    ridge.push([
      x + w * u,
      y + h * (0.12 + 0.18 * Math.abs(Math.sin(u * 4.1 + 0.5)) + (rand() - 0.5) * 0.06),
    ])
  }
  const poly: Pt[] = [...ridge, [x + w, y + h], [x, y + h]]
  return rockMass(poly, rand, { ridge, shade: num(p, 'shade', 0.6), cracks: 3 })
}

/**
 * A dry gorge: two benched cliff walls of red earth with horizontal strata, fluted pinnacles
 * standing on them, low scrub (T3-style hatched crowns) on the tops, and a dry floor between.
 * Lit sides are paper with strata only, T4 on the shaded side. The box bottom is the floor.
 */
export const gorgePinnaclesB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const out: SvgNode[] = []
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const tower = (u: number, wu: number, hv: number, shade: number) => {
    const x0 = X(u),
      ww = w * wu,
      top = Y(1 - hv)
    const S = 5
    const left: Pt[] = [],
      right: Pt[] = []
    for (let k = 1; k <= S; k++) {
      const t = k / S
      const yk = base - (base - top) * t ** 0.92
      const inL = ww * 0.3 * t ** 1.1 + (rand() - 0.5) * 1.6
      const inR = ww * 0.3 * t ** 1.1 + (rand() - 0.5) * 1.6
      // A ledge: the wall steps out below each stratum, then back in.
      left.push([x0 + inL - 1.4, yk + 3.2], [x0 + inL, yk + 0.6])
      right.push([x0 + ww - inR + 1.4, yk + 3.2], [x0 + ww - inR, yk + 0.6])
    }
    const lTop = left[left.length - 1],
      rTop = right[right.length - 1]
    const cap: Pt[] = [
      lTop,
      [lTop[0] + (rTop[0] - lTop[0]) * 0.35, top - 0.8],
      [lTop[0] + (rTop[0] - lTop[0]) * 0.7, top + 0.4],
      rTop,
    ]
    const ridge: Pt[] = [
      [x0 - 0.5, base],
      ...left,
      ...cap.slice(1, -1),
      ...[...right].reverse(),
      [x0 + ww + 0.5, base],
    ]
    out.push(
      ...rockMass([...ridge], rand, {
        ridge: ridge.slice(1, -1),
        shade,
        fracture: 0,
        strata: true,
        strataGap: 1.9,
        slant: 0.1,
        smooth: true,
      }),
    )
    out.push(...canopyNodes(lTop[0] + 0.5, rTop[0] - 0.5, top + 2.2, 4.5, rand, { crowns: 2 }))
  }
  const bench = (u0: number, u1: number, v: number, left: boolean) => {
    const a = X(u0),
      b = X(u1)
    const ridge: Pt[] = []
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const edge = left ? t : 1 - t
      ridge.push([a + (b - a) * t, Y(v) + (1 - edge) * -2 + edge * 5 + (rand() - 0.5) * 1.5])
    }
    const poly: Pt[] = [...ridge, [b, base], [a, base]]
    out.push(
      ...rockMass(poly, rand, {
        ridge,
        shade: left ? 0.8 : 0.6,
        fracture: 0,
        strata: true,
        strataGap: 2.4,
        slant: 0.1,
      }),
    )
    return ridge
  }
  const bl = bench(0.0, 0.36, 0.5, true)
  const br = bench(0.64, 1.0, 0.5, false)
  tower(0.02, 0.15, 0.9, 0.68)
  tower(0.17, 0.14, 0.66, 0.7)
  tower(0.3, 0.16, 0.82, 0.68)
  tower(0.6, 0.15, 0.74, 0.62)
  tower(0.73, 0.17, 0.9, 0.64)
  tower(0.86, 0.12, 0.64, 0.62)
  // Scrub along the bench tops and a few bushes on the dry floor.
  void bl
  void br
  for (const u of [0.36, 0.5, 0.58])
    out.push(...canopyNodes(X(u) - 5, X(u) + 5, base - 0.5, 4.5, rand, { crowns: 1 }))
  return out
}
