import type { MakerKey } from '@kuuki/data/aircraft-makers'

const C = Math.cos(Math.PI / 6),
  S = 0.5

export type P3 = readonly [number, number, number]
export type Pt = readonly [number, number]
export type Paint =
  | 'top'
  | 'front'
  | 'side'
  | 'line'
  | 'crease'
  | 'detail'
  | 'glass'
  | 'ghost'
  | 'accent'
  | 'accent-side'
  | 'accent-plate'
  | 'shadow'
  | 'shade'
  | 'land'
  | 'on-accent'
  | 'ink'
  | 'muted'
  | 'none'
  | `maker:${MakerKey}`
  | `maker-side:${MakerKey}`

export type IsoNode =
  | {
      kind: 'polygon'
      points: string
      fill: Paint
      stroke: Paint
      strokeOpacity?: number
      width?: number
      opacity?: number
    }
  | {
      kind: 'path'
      d: string
      fill: Paint
      stroke: Paint
      width: number
      dash?: string
    }
  | {
      kind: 'text'
      text: string
      x: number
      y: number
      transform?: string
      size: number
      weight: number
      mono: boolean
      anchor: 'start' | 'middle' | 'end'
      fill: Paint
    }
  | { kind: 'glow'; blur: number; children: IsoNode[] }
  | {
      kind: 'group'
      part: string
      clip?: string
      vars?: Record<string, string>
      children: IsoNode[]
    }

export type IsoFigureData = {
  width: number
  height: number
  shadowBounds?: { x: number; y: number; width: number; height: number }
  shadowBlur?: number
  viewBox: string
  nodes: IsoNode[]
}

export const SHADOW_BLUR = 1.6
export const MIN_LABEL_PX = 6
export const labelSize = (size: number, px: number) =>
  px > 0 ? Math.max(size, MIN_LABEL_PX / px) : size

export const r1 = (n: number) => Math.round(n * 10) / 10
export const r3 = (n: number) => Math.round(n * 1000) / 1000

let measuring = 0
function measure<T>(build: () => T): T {
  measuring++
  try {
    return build()
  } finally {
    measuring--
  }
}

export class Scene {
  readonly k: number
  private stack: IsoNode[][] = [[]]
  private pts: Pt[] = []
  private shadowPts: Pt[] = []
  private haloPts: Pt[] = []
  private sigma = 0

  constructor(k = 1) {
    this.k = k
  }

  private push(node: IsoNode) {
    this.stack[this.stack.length - 1].push(node)
  }
  private collect(draw: () => void): IsoNode[] {
    this.stack.push([])
    draw()
    return this.stack.pop()!
  }

  P(x: number, y: number, z: number): Pt {
    const p: Pt = [(x - y) * C * this.k, ((x + y) * S - z) * this.k]
    this.pts.push(p)
    return p
  }
  project([x, y, z]: P3): Pt {
    return [(x - y) * C * this.k, ((x + y) * S - z) * this.k]
  }
  vector(dx: number, dy: number, dz: number): Pt {
    return [r1((dx - dy) * C * this.k), r1(((dx + dy) * S - dz) * this.k)]
  }
  include(pts3: readonly P3[]) {
    for (const [x, y, z] of pts3) this.P(x, y, z)
  }
  pp(list: readonly P3[]): Pt[] {
    return list.map(([x, y, z]) => this.P(x, y, z))
  }
  str(pts: readonly Pt[]) {
    if (measuring) return ''
    return pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')
  }

  poly(
    pts3: readonly P3[],
    fill: Paint,
    stroke: Paint = 'line',
    strokeOpacity?: number,
    width?: number,
    opacity?: number,
  ) {
    const cast = fill === 'shadow' && stroke === 'none'
    const projected = cast ? pts3.map((p) => this.project(p)) : this.pp(pts3)
    if (cast) this.castShadow(projected)
    this.push({
      kind: 'polygon',
      points: this.str(projected),
      fill,
      stroke,
      strokeOpacity,
      width,
      opacity,
    })
  }
  private castShadow(pts: readonly Pt[]) {
    this.shadowPts.push(...pts)
    this.sigma = SHADOW_BLUR * this.k
  }
  poly2(pts: readonly Pt[], fill: Paint, stroke: Paint = 'line', width?: number) {
    if (fill === 'shadow' && stroke === 'none') this.castShadow(pts)
    else this.pts.push(...pts)
    this.push({ kind: 'polygon', points: this.str(pts), fill, stroke, width })
  }
  line(pts3: readonly P3[], stroke: Paint = 'line', width = 1, dash?: string) {
    const pts = this.pp(pts3)
    const d = measuring ? '' : 'M' + pts.map(([a, b]) => `${r1(a)} ${r1(b)}`).join('L')
    this.push({ kind: 'path', d, fill: 'none', stroke, width, dash })
  }
  area(polys: readonly (readonly Pt[])[], fill: Paint) {
    const d = polys
      .map((pts) => {
        this.pts.push(...pts)
        if (measuring) return ''
        const twice = pts.reduce((sum, [a, b], i) => {
          const [c, e] = pts[(i + 1) % pts.length]
          return sum + a * e - c * b
        }, 0)
        const ring = twice < 0 ? [...pts].reverse() : pts
        return 'M' + ring.map(([a, b]) => `${r1(a)} ${r1(b)}`).join('L') + 'Z'
      })
      .join('')
    this.push({ kind: 'path', d, fill, stroke: 'none', width: 0 })
  }
  segs(list: readonly (readonly P3[])[], stroke: Paint, width = 1) {
    const d = list
      .map((seg) => {
        const pts = this.pp(seg)
        return measuring ? '' : 'M' + pts.map(([a, b]) => `${r1(a)} ${r1(b)}`).join('L')
      })
      .join('')
    this.push({ kind: 'path', d, fill: 'none', stroke, width })
  }
  glow(blur: number, draw: () => void) {
    const from = this.pts.length
    const children = this.collect(draw)
    const sigma = r3(blur * this.k)
    for (const [x, y] of this.pts.slice(from))
      this.haloPts.push([x - 3 * sigma, y - 3 * sigma], [x + 3 * sigma, y + 3 * sigma])
    this.push({ kind: 'glow', blur: sigma, children })
  }
  lit(pts3: readonly P3[], blur = 4) {
    this.glow(blur, () => this.poly(pts3, 'accent', 'none'))
    this.poly(pts3, 'accent', 'accent')
  }
  group(
    part: string,
    draw: () => void,
    { clip, vars }: { clip?: readonly P3[]; vars?: Record<string, string> } = {},
  ) {
    const children = this.collect(draw)
    this.push({
      kind: 'group',
      part,
      clip: clip ? this.str(hull(clip.map((p) => this.project(p)))) : undefined,
      vars,
      children,
    })
  }

  on(O: P3, U: P3, V: P3) {
    return (u: number, v: number): P3 => [
      O[0] + u * U[0] + v * V[0],
      O[1] + u * U[1] + v * V[1],
      O[2] + u * U[2] + v * V[2],
    ]
  }
  matrix(O: P3, U: P3, V: P3) {
    const o = this.P(O[0], O[1], O[2])
    if (measuring) return ''
    const d = (v: P3) => [(v[0] - v[1]) * C * this.k, ((v[0] + v[1]) * S - v[2]) * this.k]
    const u = d(U),
      w = d(V)
    return `matrix(${r3(u[0])} ${r3(u[1])} ${r3(w[0])} ${r3(w[1])} ${r1(o[0])} ${r1(o[1])})`
  }
  text(
    text: string,
    O: P3,
    U: P3,
    V: P3,
    {
      size = 10,
      fill = 'ink' as Paint,
      weight = 600,
      mono = false,
      anchor = 'start' as 'start' | 'middle' | 'end',
    } = {},
  ) {
    const unit = Math.min(
      Math.hypot((U[0] - U[1]) * C * this.k, (U[0] + U[1]) * S * this.k - U[2] * this.k),
      Math.hypot((V[0] - V[1]) * C * this.k, (V[0] + V[1]) * S * this.k - V[2] * this.k),
    )
    this.push({
      kind: 'text',
      text,
      x: 0,
      y: 0,
      transform: this.matrix(O, U, V),
      size: labelSize(size, unit),
      weight,
      mono,
      anchor,
      fill,
    })
  }
  screenText(
    text: string,
    [x3, y3, z3]: P3,
    {
      size = 10,
      fill = 'muted' as Paint,
      weight = 500,
      anchor = 'middle' as 'start' | 'middle' | 'end',
      dx = 0,
      dy = 0,
    } = {},
  ) {
    size = Math.max(size, MIN_LABEL_PX)
    const [x0, y] = this.P(x3, y3, z3),
      x = x0 + dx
    const width = text.length * size * 0.62
    const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2
    this.pts.push([left, y + dy - size], [left + width, y + dy])
    this.push({
      kind: 'text',
      text,
      x: r1(x),
      y: r1(y + dy),
      size,
      weight,
      mono: true,
      anchor,
      fill,
    })
  }

  box(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    f: { top?: Paint; front?: Paint; side?: Paint; stroke?: Paint } = {},
  ) {
    const edge = f.stroke ?? 'crease'
    this.poly(
      [
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x + w, y, z],
      ],
      f.side ?? 'side',
      edge,
    )
    this.poly(
      [
        [x, y + d, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x, y + d, z],
      ],
      f.front ?? 'front',
      edge,
    )
    this.poly(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      f.top ?? 'top',
      edge,
    )
    if (!f.stroke)
      this.poly2(
        hull(
          [
            [x, y, z + h],
            [x + w, y, z + h],
            [x + w, y, z],
            [x + w, y + d, z],
            [x, y + d, z],
            [x, y + d, z + h],
          ].map(([a, b, c]) => this.project([a, b, c])),
        ),
        'none',
        'line',
      )
  }
  rbox(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    r: number,
    f: { top?: Paint; wall?: Paint; side?: Paint; stroke?: Paint } = {},
  ) {
    const fp = roundRect(x, y, w, d, r)
    const bottom = fp.map(([a, b]) => this.P(a, b, z)),
      top = fp.map(([a, b]) => this.P(a, b, z + h)),
      outline = hull([...bottom, ...top])
    this.poly2(outline, f.wall ?? 'front', 'none')
    const facing: number[] = []
    fp.forEach(([x0, y0], i) => {
      const [x1, y1] = fp[(i + 1) % fp.length]
      const nx = y1 - y0,
        ny = x0 - x1
      if (nx + ny > 1e-6 && nx > ny) facing.push(i)
    })
    if (facing.length) {
      const run = [...facing, (facing[facing.length - 1] + 1) % fp.length]
      this.poly2(
        [
          ...run.map((i) => this.P(fp[i][0], fp[i][1], z + h)),
          ...[...run].reverse().map((i) => this.P(fp[i][0], fp[i][1], z)),
        ],
        f.side ?? 'side',
        'none',
      )
    }
    this.poly2(top, f.top ?? 'top', f.stroke ?? 'crease')
    this.poly2(outline, 'none', f.stroke ?? 'line')
  }
  prism(
    profile: readonly Pt[],
    y: number,
    d: number,
    f: { top?: Paint; side?: Paint; front?: Paint; stroke?: Paint } = {},
  ) {
    const near = profile.map(([a, b]) => this.P(a, y + d, b)),
      far = profile.map(([a, b]) => this.P(a, y, b)),
      outline = hull([...near, ...far])
    this.poly2(outline, f.side ?? 'side', 'none')
    const n = profile.length,
      up = profile.map(([a0, b0], i) => {
        const [a1, b1] = profile[(i + 1) % n]
        const nx = b1 - b0,
          nz = a0 - a1
        return nx + nz > 1e-6 && nz > nx
      })
    for (let j = 0; j < n; j++) {
      if (!up[j] || up[(j + n - 1) % n]) continue
      const run = [j]
      while (up[run[run.length - 1]]) run.push((run[run.length - 1] + 1) % n)
      this.poly2(
        [...run.map((k) => near[k]), ...[...run].reverse().map((k) => far[k])],
        f.top ?? 'top',
        'none',
      )
    }
    this.poly2(near, f.front ?? 'front', f.stroke ?? 'crease')
    this.poly2(outline, 'none', f.stroke ?? 'line')
  }
  cylinder(
    cx: number,
    cy: number,
    r: number,
    z0: number,
    z1: number,
    f: { side?: Paint; top?: Paint; n?: number } = {},
  ) {
    const n = f.n ?? 32,
      a = this.circle([cx, cy, z0], [1, 0, 0], [0, 1, 0], 0, 0, r, n),
      b = this.circle([cx, cy, z1], [1, 0, 0], [0, 1, 0], 0, 0, r, n)
    this.poly2(hull(this.pp([...a, ...b])), f.side ?? 'front', 'line')
    this.poly(b, f.top ?? 'top', 'line')
  }
  circle(O: P3, U: P3, V: P3, cu: number, cv: number, rad: number, n = 28): P3[] {
    const at = this.on(O, U, V),
      out: P3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI
      out.push(at(cu + rad * Math.cos(a), cv + rad * Math.sin(a)))
    }
    return out
  }

  done(pad = 3): IsoFigureData {
    const box = (pts: readonly Pt[]) => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const [x, y] of pts) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
      return { minX, minY, maxX, maxY }
    }
    const reach = 2 * this.sigma
    const shadow = this.shadowPts.flatMap(([x, y]): Pt[] => [
      [x - reach, y - reach],
      [x + reach, y + reach],
    ])
    const fitBox = box([...this.pts, ...this.haloPts]),
      all = box([...this.pts, ...this.haloPts, ...shadow])
    const size = (b: typeof fitBox) => ({
      width: Math.ceil(b.maxX - b.minX + 2 * pad),
      height: Math.ceil(b.maxY - b.minY + 2 * pad),
    })
    const { width, height } = size(fitBox)
    return {
      width,
      height,
      shadowBounds: this.sigma
        ? { x: r1(all.minX - pad), y: r1(all.minY - pad), ...size(all) }
        : undefined,
      shadowBlur: this.sigma ? r3(this.sigma) : undefined,
      viewBox: `${r1(fitBox.minX - pad)} ${r1(fitBox.minY - pad)} ${width} ${height}`,
      nodes: this.stack[0],
    }
  }
}

type Sized = { width: number; height: number }

export function fitK(width: number, build: (k: number) => { width: number }): number {
  const wide = (k: number) => measure(() => build(k)).width
  const w1 = wide(0.8),
    w2 = wide(0.4)
  const slope = (w1 - w2) / 0.4
  let k = Math.round((0.8 + (width - w1) / slope) / 0.005) * 0.005
  for (let i = 0; i < 20 && wide(k) > width; i++) k -= 0.005
  for (let i = 0; i < 20 && wide(k + 0.005) <= width; i++) k += 0.005
  return Math.round(k * 1000) / 1000
}

export function fitBox(width: number, height: number, build: (k: number) => Sized): number {
  const sizes = new Map<number, Sized>()
  const sized = (k: number) => {
    let size = sizes.get(k)
    if (!size) {
      const built = build(k)
      sizes.set(k, (size = { width: built.width, height: built.height }))
    }
    return size
  }
  return Math.min(
    fitK(width, sized),
    fitK(width, (k) => ({ width: (sized(k).height * width) / height })),
  )
}

export function roundRect(
  x: number,
  y: number,
  w: number,
  d: number,
  r: number | readonly [number, number, number, number],
  n = 6,
): Pt[] {
  const [r0, r1, r2, r3] = typeof r === 'number' ? [r, r, r, r] : r
  const out: Pt[] = [],
    corners = [
      [x + w - r0, y + r0, -90, r0],
      [x + w - r1, y + d - r1, 0, r1],
      [x + r2, y + d - r2, 90, r2],
      [x + r3, y + r3, 180, r3],
    ]
  for (const [cx, cy, a0, rad] of corners)
    for (let i = 0; i <= (rad ? n : 0); i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180
      out.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)])
    }
  return out
}

export function visibleRun(plan: readonly Pt[]): Pt[] {
  const n = plan.length,
    seen = plan.map(([a0, b0], i) => {
      const [a1, b1] = plan[(i + 1) % n]
      return b1 - b0 + (a0 - a1) > 1e-6
    })
  const from = seen.findIndex((v, i) => v && !seen[(i + n - 1) % n])
  const run: Pt[] = [plan[from]]
  for (let j = from; seen[j % n]; j++) run.push(plan[(j + 1) % n])
  return run
}

export function hull(points: readonly Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: Pt[] = [],
    up: Pt[] = []
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  for (const q of p.reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop()
    up.push(q)
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)]
}
