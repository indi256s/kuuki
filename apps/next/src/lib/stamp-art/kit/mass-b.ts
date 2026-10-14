// Plume and canopy: soft masses drawn as hatching with no contour, so they never read as chains of
// circles. A mass is a lumpy silhouette (an envelope over a few hidden blobs, flat at the base)
// filled with fine diagonal hatching that keeps only where a shade field is high: the upper-left
// is lit paper with an irregular eroded edge, the lower-right is dense. A second, interleaved
// hatch set doubles the density in the darkest part. The silhouette is only used to erase the
// backdrop (with a lit halo); it is never stroked.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, type Weight, hatchPoly, occlude, ptsBounds, stroke } from '../grid'
import { type KitModule, num } from './util'

export type Blob = [number, number, number, number]

/** Top envelope of overlapping ellipses, flat at `base`. */
export function crownPoly(blobs: Blob[], x0: number, x1: number, base: number, step = 1.4): Pt[] {
  const top: Pt[] = []
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    let ty = base
    for (const [cx, cy, rx, ry] of blobs) {
      const d = (x - cx) / rx
      if (Math.abs(d) < 1) ty = Math.min(ty, cy - ry * Math.sqrt(1 - d * d))
    }
    top.push([x, ty])
  }
  return [[x0, base], ...top, [x1, base]]
}

type MassOpts = {
  angle: number
  gap: number
  weight: Weight
  /** Shade threshold: higher means more lit paper. */
  thr: number
  /** Weights of the left-to-right and top-to-bottom shade ramps. */
  wx?: number
  wy?: number
}

/** Hatching kept only where the shade field is above the threshold. */
export function hatchMass(poly: Pt[], rand: () => number, o: MassOpts): SvgNode[] {
  const [x0, y0, x1, y1] = ptsBounds(poly)
  const w = x1 - x0 || 1,
    h = y1 - y0 || 1
  const ph = rand() * 6.28,
    ph2 = rand() * 6.28
  const shade = (x: number, y: number) =>
    (o.wx ?? 0.6) * ((x - x0) / w) +
    (o.wy ?? 0.5) * ((y - y0) / h) +
    0.2 * Math.sin(x * 0.45 + ph) * Math.sin(y * 0.6 + ph2) +
    0.14 * Math.sin(x * 1.3 + y * 0.9 + ph)
  const out: SvgNode[] = []
  const pass = (phase: number, thr: number) => {
    for (const s of hatchPoly(poly, { angle: o.angle, gap: o.gap, weight: o.weight, phase })) {
      const [a, b] = s.pts
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.ceil(len / 0.7))
      let start = -1
      for (let i = 0; i <= n + 1; i++) {
        const t = Math.min(1, i / n)
        const on = i <= n && shade(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) > thr
        if (on && start < 0) start = i
        if ((!on || i === n + 1) && start >= 0) {
          const t0 = start / n,
            t1 = Math.min(1, (i - 1) / n)
          if ((t1 - t0) * len >= 1.4) {
            out.push(
              stroke(o.weight, [
                [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
                [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
              ]),
            )
          }
          start = -1
        }
      }
    }
  }
  pass(0.5, o.thr)
  pass(0.0, o.thr + 0.3)
  return out
}

/** A spray plume rising from `base`: tall central lobes, tonal on the shaded lower right. */
export function plumeNodes(
  x0: number,
  x1: number,
  base: number,
  h: number,
  rand: () => number,
  o: { lobes?: number; halo?: number } = {},
): SvgNode[] {
  const n = o.lobes ?? 5
  const w = x1 - x0
  const blobs: Blob[] = []
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const bump = Math.max(0.25, 1 - 1.5 * Math.abs(u - 0.5)) * (0.8 + rand() * 0.35)
    const ry = h * 0.55 * bump
    const rx = (w / n) * (0.75 + rand() * 0.35)
    blobs.push([x0 + w * u + (rand() - 0.5) * 2, base - ry * 0.9, rx, ry])
  }
  blobs.push([x0 + w * (0.42 + rand() * 0.16), base - h * 0.78, w * 0.2, h * 0.24])
  const poly = crownPoly(blobs, x0, x1, base)
  return [
    occlude(poly, { halo: o.halo ?? 1.8 }),
    ...hatchMass(poly, rand, { angle: -62, gap: 2.1, weight: 'fine', thr: 0.5 }),
  ]
}

/** A foliage band: rounded crowns over a ragged underside, same hatching language. */
export function canopyNodes(
  x0: number,
  x1: number,
  base: number,
  h: number,
  rand: () => number,
  o: { crowns?: number; thr?: number; halo?: number } = {},
): SvgNode[] {
  const w = x1 - x0
  const n = o.crowns ?? Math.max(2, Math.round(w / 15))
  const blobs: Blob[] = []
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const ry = h * (0.62 + rand() * 0.38)
    const rx = (w / n) * (0.62 + rand() * 0.3)
    blobs.push([x0 + w * u + (rand() - 0.5) * 3, base - ry * 0.55, rx, ry])
  }
  const poly = crownPoly(blobs, x0, x1, base)
  // Ragged underside.
  const ragged = poly.map(
    ([x, y], i) => (i === 0 || i === poly.length - 1 ? [x, y + 1 + rand() * 2] : [x, y]) as Pt,
  )
  return [
    occlude(ragged, { halo: o.halo ?? 1.6 }),
    ...hatchMass(ragged, rand, {
      angle: 72,
      gap: 2.0,
      weight: 'fine',
      thr: o.thr ?? 0.2,
      wx: 0.3,
      wy: 0.45,
    }),
  ]
}

export const plumeB: KitModule = ([x, y, w, h], p) =>
  plumeNodes(x, x + w, y + h, h, mulberry32(Math.round(num(p, 'seed', 3))), {
    lobes: Math.round(num(p, 'lobes', 5)),
  })

export const canopyB: KitModule = ([x, y, w, h], p) =>
  canopyNodes(x, x + w, y + h, h, mulberry32(Math.round(num(p, 'seed', 3))), {
    crowns: p.crowns === undefined ? undefined : Math.round(num(p, 'crowns', 3)),
    thr: num(p, 'thr', 0.2),
  })
