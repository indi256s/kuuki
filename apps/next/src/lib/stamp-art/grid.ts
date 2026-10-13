// Drawing primitives for the stamp engraving. Everything lives on a 200x200 grid (y down) and is
// drawn in one ink (#000): the SVG is used as a CSS mask, so there is no second colour and no
// <pattern>. Hatching is emitted as real lines so the mask stays pure geometry.

export const GRID = 200

/** Stroke widths in grid units, tuned to survive a 96px display (2.6 units is about 1.2px). */
export const WEIGHTS = { fine: 1, hair: 1.6, line: 2.6, bold: 4 } as const
export type Weight = keyof typeof WEIGHTS

export type Pt = [number, number]
/** [x, y, width, height] in grid units. */
export type Box = [number, number, number, number]

export type StrokeNode = {
  kind: 'stroke'
  weight: Weight
  pts: Pt[]
  closed: boolean
  /** Backdrop line: stops `halo` units short of a subject silhouette (see `occlude`). */
  bg?: boolean
  /** Drawn after every layer and never occluded (the ground line). */
  late?: boolean
}
/** Solid fill (dark openings). The only fill that is not made of lines. */
export type FillNode = { kind: 'fill'; pts: Pt[] }
/** Invisible silhouette: erases strokes emitted earlier (painter's algorithm in one ink). */
export type OccludeNode = { kind: 'occlude'; pts: Pt[]; halo?: number }
export type SvgNode = StrokeNode | FillNode | OccludeNode

export const stroke = (weight: Weight, pts: Pt[], closed = false): StrokeNode => ({
  kind: 'stroke',
  weight,
  pts,
  closed,
})
export const fill = (pts: Pt[]): FillNode => ({ kind: 'fill', pts })
/**
 * `halo` buffers the silhouette by that many units, but only for backdrop strokes (`bg`): the
 * hatching stops short of the subject and leaves a lit rim. Other strokes use the exact outline.
 */
export const occlude = (pts: Pt[], opts: { halo?: number } = {}): OccludeNode =>
  opts.halo ? { kind: 'occlude', pts, halo: opts.halo } : { kind: 'occlude', pts }
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

type GapRamp = number | [number, number]

/**
 * Hatching as real lines inside a polygon at any angle. `angle` is the direction of the lines in
 * degrees (0 horizontal, 90 vertical, -58 rises to the right). `gap` is the perpendicular spacing,
 * or a [start, end] pair interpolated across `ramp` (the perpendicular coordinate range, which for
 * horizontal lines is y). Pure geometry: nothing is clipped here beyond the polygon itself.
 */
export function hatchPoly(
  poly: Pt[],
  opts: {
    angle: number
    gap: GapRamp
    weight: Weight
    ramp?: [number, number]
    inset?: number
    phase?: number
  },
): StrokeNode[] {
  const th = (opts.angle * Math.PI) / 180
  const c = Math.cos(th),
    s = Math.sin(th)
  const rot = (p: Pt): Pt => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]
  const unrot = (p: Pt): Pt => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]
  const r = poly.map(rot)
  const [, y0, , y1] = ptsBounds(r)
  const [g0, g1] = typeof opts.gap === 'number' ? [opts.gap, opts.gap] : opts.gap
  const [r0, r1] = opts.ramp ?? [y0, y1]
  const gapAt = (y: number) => g0 + (g1 - g0) * Math.min(1, Math.max(0, (y - r0) / (r1 - r0 || 1)))
  const inset = opts.inset ?? 0
  const out: StrokeNode[] = []
  for (let y = y0 + gapAt(y0) * (opts.phase ?? 0.5); y < y1; y += gapAt(y)) {
    const xs: number[] = []
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length]
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
      out.push(stroke(opts.weight, [unrot([xa, y]), unrot([xb, y])]))
    }
  }
  return out
}

/**
 * The tone ladder. T0 is bare paper (lit walls). T1 to T4 are hatch presets, T5 is solid. Weights
 * and gaps are grid units; the grey figure is the rough look at 96px. A `gap` pair opens or closes
 * across the `ramp` the caller gives (sky: top to horizon, ground: horizon to bottom).
 */
export const TONES = {
  /** Lit walls. */
  T0: { kind: 'paper' },
  /** Sky: horizontal fine lines, gap 3.0 at the top opening to 4.8 at the horizon (20-33%). */
  T1: { kind: 'hatch', angle: 0, weight: 'fine', gap: [3, 4.8] },
  /** Distance: diagonal fine lines, gap 2.4 (~40%). Lit faces may open to 3.4. */
  T2: { kind: 'hatch', angle: -58, weight: 'fine', gap: [2.4, 2.4] },
  /** Ground and water: horizontal hair lines, gap 3.6 at the horizon closing to 2.2 (45-70%). */
  T3: { kind: 'hatch', angle: 0, weight: 'hair', gap: [3.6, 2.2] },
  /** Shaded faces, passages, crawlspace: vertical hair lines, gap 2.4 (~65%). */
  T4: { kind: 'hatch', angle: 90, weight: 'hair', gap: [2.4, 2.4] },
  /** Openings, slate roofs, the quadriga: solid. */
  T5: { kind: 'solid' },
} as const
export type ToneName = keyof typeof TONES

export type ToneOpts = {
  /** Overrides the preset's angle, gap pair, weight. */
  angle?: number
  gap?: GapRamp
  weight?: Weight
  ramp?: [number, number]
  inset?: number
  phase?: number
}

/** Fills a closed polygon with a tone from the ladder. */
export function toneFill(poly: Pt[], tone: ToneName, o: ToneOpts = {}): SvgNode[] {
  const t = TONES[tone]
  if (t.kind === 'paper') return []
  if (t.kind === 'solid') return [fill(poly)]
  return hatchPoly(poly, {
    angle: o.angle ?? t.angle,
    gap: o.gap ?? [...t.gap],
    weight: o.weight ?? t.weight,
    ramp: o.ramp,
    inset: o.inset,
    phase: o.phase,
  })
}

/** Marks every stroke of a list as backdrop. */
export const asBackdrop = (nodes: SvgNode[]): SvgNode[] =>
  nodes.map((n) => (n.kind === 'stroke' ? { ...n, bg: true } : n))
