export const GRID = 200

export const WEIGHTS = { fine: 1, hair: 1.6, line: 2.6, bold: 4 } as const
export type Weight = keyof typeof WEIGHTS

export type Pt = [number, number]
export type Box = [number, number, number, number]

export type StrokeNode = {
  kind: 'stroke'
  weight: Weight
  pts: Pt[]
  closed: boolean
  bg?: boolean
  late?: boolean
}
export type FillNode = { kind: 'fill'; pts: Pt[] }
export type OccludeNode = { kind: 'occlude'; pts: Pt[]; halo?: number }
export type SvgNode = StrokeNode | FillNode | OccludeNode

export const stroke = (weight: Weight, pts: Pt[], closed = false): StrokeNode => ({
  kind: 'stroke',
  weight,
  pts,
  closed,
})
export const fill = (pts: Pt[]): FillNode => ({ kind: 'fill', pts })
export const occlude = (pts: Pt[], opts: { halo?: number } = {}): OccludeNode =>
  opts.halo ? { kind: 'occlude', pts, halo: opts.halo } : { kind: 'occlude', pts }
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

export function nodeBounds(node: SvgNode): [number, number, number, number] | null {
  if (node.kind === 'occlude' || node.pts.length === 0) return null
  const [x0, y0, x1, y1] = ptsBounds(node.pts)
  const h = node.kind === 'stroke' ? WEIGHTS[node.weight] / 2 : 0
  return [x0 - h, y0 - h, x1 + h, y1 + h]
}

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

export const TONES = {
  T0: { kind: 'paper' },
  T1: { kind: 'hatch', angle: 0, weight: 'fine', gap: [3, 4.8] },
  T2: { kind: 'hatch', angle: -58, weight: 'fine', gap: [2.4, 2.4] },
  T3: { kind: 'hatch', angle: 0, weight: 'hair', gap: [3.6, 2.2] },
  T4: { kind: 'hatch', angle: 90, weight: 'hair', gap: [2.4, 2.4] },
  T5: { kind: 'solid' },
} as const
export type ToneName = keyof typeof TONES

export type ToneOpts = {
  angle?: number
  gap?: GapRamp
  weight?: Weight
  ramp?: [number, number]
  inset?: number
  phase?: number
}

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

export const asBackdrop = (nodes: SvgNode[]): SvgNode[] =>
  nodes.map((n) => (n.kind === 'stroke' ? { ...n, bg: true } : n))
