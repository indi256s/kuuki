// Drawing primitives for the stamp engraving. Everything lives on a 200x200 grid (y down) and is
// drawn in one ink (#000): the SVG is used as a CSS mask, so there is no second colour and no
// <pattern>. Hatching is emitted as real lines so the mask stays pure geometry.

export const GRID = 200

/** Stroke widths in grid units, tuned to survive a 96px display (2.6 units is about 1.2px). */
export const WEIGHTS = { hair: 1.6, line: 2.6, bold: 4 } as const
export type Weight = keyof typeof WEIGHTS

export type Pt = [number, number]
/** [x, y, width, height] in grid units. */
export type Box = [number, number, number, number]

export type StrokeNode = { kind: 'stroke'; weight: Weight; pts: Pt[]; closed: boolean }
/** Solid fill (dark openings). The only fill that is not made of lines. */
export type FillNode = { kind: 'fill'; pts: Pt[] }
/** Invisible silhouette: erases strokes emitted earlier (painter's algorithm in one ink). */
export type OccludeNode = { kind: 'occlude'; pts: Pt[] }
export type SvgNode = StrokeNode | FillNode | OccludeNode

export const stroke = (weight: Weight, pts: Pt[], closed = false): StrokeNode => ({
  kind: 'stroke',
  weight,
  pts,
  closed,
})
export const fill = (pts: Pt[]): FillNode => ({ kind: 'fill', pts })
export const occlude = (pts: Pt[]): OccludeNode => ({ kind: 'occlude', pts })
/** A solid body: hides what is behind it and draws its outline. */
export const body = (pts: Pt[], weight: Weight = 'line'): SvgNode[] => [
  occlude(pts),
  stroke(weight, pts, true),
]

export const rectPts = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]
export const boxPts = (b: Box): Pt[] => rectPts(b[0], b[1], b[2], b[3])
export const hline = (weight: Weight, x1: number, x2: number, y: number) =>
  stroke(weight, [
    [x1, y],
    [x2, y],
  ])
export const vline = (weight: Weight, x: number, y1: number, y2: number) =>
  stroke(weight, [
    [x, y1],
    [x, y2],
  ])

/** Quadratic Bezier sampled into `n` segments. */
export function quad(p0: Pt, p1: Pt, p2: Pt, n = 10): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ])
  }
  return out
}

/** Cubic Bezier sampled into `n` segments. */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 14): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return out
}

export const mirrorPts = (pts: Pt[], cx: number): Pt[] => pts.map(([x, y]) => [2 * cx - x, y])

export function ptsBounds(pts: Pt[]): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

/** Drawn bounds of a node, stroke half-width included. Occluders are not drawn. */
export function nodeBounds(node: SvgNode): [number, number, number, number] | null {
  if (node.kind === 'occlude' || node.pts.length === 0) return null
  const [x0, y0, x1, y1] = ptsBounds(node.pts)
  const h = node.kind === 'stroke' ? WEIGHTS[node.weight] / 2 : 0
  return [x0 - h, y0 - h, x1 + h, y1 + h]
}

/**
 * Hatching as real lines inside a closed polygon. `h` runs horizontal lines (sky, water),
 * `v` vertical lines (shaded faces). `gap` is the spacing, `inset` shortens each line.
 */
export function hatch(
  poly: Pt[],
  dir: 'h' | 'v',
  gap: number,
  weight: Weight = 'hair',
  inset = 0,
  phase = 0.5,
): SvgNode[] {
  const p: Pt[] = dir === 'h' ? poly : poly.map(([x, y]) => [y, x])
  const [, y0, , y1] = ptsBounds(p)
  const out: SvgNode[] = []
  for (let y = y0 + gap * phase; y < y1; y += gap) {
    const xs: number[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length]
      if (a[1] === b[1]) continue
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    }
    xs.sort((m, n) => m - n)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = xs[i] + inset,
        xb = xs[i + 1] - inset
      if (xb - xa < 0.8) continue
      out.push(
        stroke(
          weight,
          dir === 'h'
            ? [
                [xa, y],
                [xb, y],
              ]
            : [
                [y, xa],
                [y, xb],
              ],
        ),
      )
    }
  }
  return out
}
