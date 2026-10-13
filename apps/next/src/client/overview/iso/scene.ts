// Iso-glow kernel: every point is projected here, so the SVG holds absolute screen coordinates (no nested transforms) and 1px strokes stay 1px at any scale.
// Builders return a node tree instead of markup so named parts stay addressable for motion, and paints stay theme roles resolved by CSS variables.

import type { MakerKey } from '@kuuki/data/aircraft-makers'

const C = Math.cos(Math.PI / 6),
  S = 0.5

export type P3 = readonly [number, number, number]
export type Pt = readonly [number, number]
/** Theme roles; IsoFigure maps each to a CSS variable (`--iso-*`, `--accent`, `--text`…). */
export type Paint =
  | 'top'
  | 'front'
  | 'side'
  | 'line'
  /** Quiet stroke for interior edges between two faces of one solid; `line` is the silhouette. */
  | 'crease'
  | 'detail'
  | 'glass'
  | 'ghost'
  | 'accent'
  | 'accent-side'
  | 'accent-plate'
  /** A cast shadow: a polygon with this fill and no stroke is drawn feathered (see `SHADOW_BLUR`) and does not count toward the fit box. */
  | 'shadow'
  /** The shadow colour, never feathered: for dark inner walls and apertures that need a crisp edge. */
  | 'shade'
  | 'land'
  | 'on-accent'
  | 'ink'
  | 'muted'
  | 'none'
  /** A manufacturer's category colour (`--cat-maker-*`) and its shaded side, for figures whose colour is the data. */
  | `maker:${MakerKey}`
  | `maker-side:${MakerKey}`

export type IsoNode =
  | {
      kind: 'polygon'
      points: string
      fill: Paint
      stroke: Paint
      strokeOpacity?: number
      /** Stroke width in px; the renderer defaults to 1. */
      width?: number
      /** Whole-polygon opacity, for a fill whose strength is data (a heat cell). */
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
  /** A blurred copy under an accent part; `blur` is the final stdDeviation in px (Scene.glow already scaled it by k), its opacity is the theme's `--iso-glow`. */
  | { kind: 'glow'; blur: number; children: IsoNode[] }
  /** A named, addressable part (`data-part`), optionally clipped by a screen-space polygon that stays fixed while the part moves. */
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
  /** Filter region including cast shadows, which spill outside the ink-and-glow viewport. */
  shadowBounds?: { x: number; y: number; width: number; height: number }
  /** stdDeviation in px of the feather on cast shadows; 0 when the figure has none. */
  shadowBlur?: number
  viewBox: string
  nodes: IsoNode[]
}

/** Cast shadows are feathered with a Gaussian of this stdDeviation at k = 1. */
export const SHADOW_BLUR = 1.6
/** Smallest rendered size of any label, in CSS px at the fitted scale. Below ~6 px glyph counters close up and mono digits blur together, so text the plane size would shrink under this is enlarged to it (it may then outgrow its plate: widen the plate or shorten the text). */
export const MIN_LABEL_PX = 6
/** Plane-unit font size that renders at least `MIN_LABEL_PX` when each plane unit is `px` screen px. */
export const labelSize = (size: number, px: number) =>
  px > 0 ? Math.max(size, MIN_LABEL_PX / px) : size

export const r1 = (n: number) => Math.round(n * 10) / 10
export const r3 = (n: number) => Math.round(n * 1000) / 1000

export class Scene {
  readonly k: number
  private stack: IsoNode[][] = [[]]
  private pts: Pt[] = []
  /** Bounds of cast shadows and of glow halos, kept apart from `pts` so only glow counts toward the fit. */
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

  /** Projects one point and counts it toward the figure's bounds. */
  P(x: number, y: number, z: number): Pt {
    const p: Pt = [(x - y) * C * this.k, ((x + y) * S - z) * this.k]
    this.pts.push(p)
    return p
  }
  /** Projects without touching the bounds (clip outlines, motion vectors). */
  project([x, y, z]: P3): Pt {
    return [(x - y) * C * this.k, ((x + y) * S - z) * this.k]
  }
  /** Screen offset of an iso displacement, for CSS transforms. */
  vector(dx: number, dy: number, dz: number): Pt {
    return [r1((dx - dy) * C * this.k), r1(((dx + dy) * S - dz) * this.k)]
  }
  /** Extends the bounds to cover points a part reaches while it moves. */
  include(pts3: readonly P3[]) {
    for (const [x, y, z] of pts3) this.P(x, y, z)
  }
  pp(list: readonly P3[]): Pt[] {
    return list.map(([x, y, z]) => this.P(x, y, z))
  }
  str(pts: readonly Pt[]) {
    return pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')
  }

  /** Planar polygon in 3D. */
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
  /** Polygon already in screen space. */
  poly2(pts: readonly Pt[], fill: Paint, stroke: Paint = 'line', width?: number) {
    if (fill === 'shadow' && stroke === 'none') this.castShadow(pts)
    else this.pts.push(...pts)
    this.push({ kind: 'polygon', points: this.str(pts), fill, stroke, width })
  }
  line(pts3: readonly P3[], stroke: Paint = 'line', width = 1, dash?: string) {
    const d =
      'M' +
      this.pp(pts3)
        .map(([a, b]) => `${r1(a)} ${r1(b)}`)
        .join('L')
    this.push({ kind: 'path', d, fill: 'none', stroke, width, dash })
  }
  /** Several screen-space polygons filled as one shape: each is wound the same way, so overlaps fill once under the nonzero rule (a translucent fill does not darken where they meet). */
  area(polys: readonly (readonly Pt[])[], fill: Paint) {
    const d = polys
      .map((pts) => {
        this.pts.push(...pts)
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
  /** Many separate segments as one path. */
  segs(list: readonly (readonly P3[])[], stroke: Paint, width = 1) {
    const d = list
      .map(
        (seg) =>
          'M' +
          this.pp(seg)
            .map(([a, b]) => `${r1(a)} ${r1(b)}`)
            .join('L'),
      )
      .join('')
    this.push({ kind: 'path', d, fill: 'none', stroke, width })
  }
  /** Soft light under an accent part: whatever `draw` emits, blurred. `blur` is the stdDeviation at k = 1, so glows scale with the figure like its geometry. */
  glow(blur: number, draw: () => void) {
    const from = this.pts.length
    const children = this.collect(draw)
    const sigma = r3(blur * this.k)
    // The blur reaches 3 sigma past the part it copies.
    for (const [x, y] of this.pts.slice(from))
      this.haloPts.push([x - 3 * sigma, y - 3 * sigma], [x + 3 * sigma, y + 3 * sigma])
    this.push({ kind: 'glow', blur: sigma, children })
  }
  /** Accent face with glow; `blur` is at k = 1. */
  lit(pts3: readonly P3[], blur = 4) {
    this.glow(blur, () => this.poly(pts3, 'accent', 'none'))
    this.poly(pts3, 'accent', 'accent')
  }
  /** Wraps whatever `draw` emits in a named part. `clip` is a set of 3D points whose projected hull stays fixed while the part moves. */
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

  /** A point on a plane: O + u·U + v·V. */
  on(O: P3, U: P3, V: P3) {
    return (u: number, v: number): P3 => [
      O[0] + u * U[0] + v * V[0],
      O[1] + u * U[1] + v * V[1],
      O[2] + u * U[2] + v * V[2],
    ]
  }
  /** Affine matrix for drawing 2D text on a plane; local v grows "down" along V. It carries k, so text sizes are plane units. */
  matrix(O: P3, U: P3, V: P3) {
    const o = this.P(O[0], O[1], O[2])
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
    // Floor: plane units are screen px times the projected length of the axes, so enlarge a label that would render under MIN_LABEL_PX.
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
  /** Upright label anchored at a projected point; sizes are screen pixels and do not scale with k. */
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

  /** Block with a top, front and side face. Edges between its own faces take `crease`, the outer silhouette `line`; an explicit `stroke` paints every edge that colour and skips the silhouette. */
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
  /**
   * Rounded box (edges: top `crease`, silhouette `line`; an explicit `stroke` paints both): the outline is filled `wall` (the y-facing tone), the visible facets that face more along x than y are merged into one `side` polygon, then come the outline stroke and a rounded top.
   * Facets are the straight runs of `roundRect`, which winds counter-clockwise in plan, so a facet's outward normal is (dy, -dx).
   */
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
    // Facing the viewer needs nx + ny > 0 (the camera looks along -x -y); nx > ny picks the x-facing half, one contiguous run of the loop.
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
  /**
   * Prism extruded along y from `y` to `y + d`, from a convex x–z profile wound counter-clockwise with z up (`roundRect(x, z, w, h, r)`), so a facet's outward normal is (dz, -dx).
   * Edges: the end face is `crease`, the silhouette `line` (an explicit `stroke` paints both).
   * The outline is filled `side`, visible facets that face more up than along x are merged into `top` runs, then the near end face (`front`) and the outline stroke.
   */
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
    // Facing the viewer needs nx + nz > 0; a run of up-facing facets is one polygon, so no seams show between them.
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
  /** Upright cylinder centred at (cx, cy) from z0 to z1: the hull of its two rims, then the top disc. */
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
  /** Circle on a plane, given its centre and radius in plane units. */
  circle(O: P3, U: P3, V: P3, cu: number, cv: number, rad: number, n = 28): P3[] {
    const at = this.on(O, U, V),
      out: P3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI
      out.push(at(cu + rad * Math.cos(a), cv + rad * Math.sin(a)))
    }
    return out
  }

  /** Closes the ink-and-glow viewport with stroke padding. Glow adds 3 sigma; cast shadows spill through overflow: visible into a separate filter region with 2 sigma of feather (the tail beyond is under 3% opacity). */
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

/** The largest scale (to 0.005) at which `build(k)` is at most `width` px wide, so a tile can draw a figure at the width its box has (sized by ink and glow, not cast shadows) instead of CSS shrinking it. Width is near-linear in k below the scales where detail switches on: two probes place the guess and a few steps settle it. */
export function fitK(width: number, build: (k: number) => { width: number }): number {
  const wide = (k: number) => build(k).width
  const w1 = wide(0.8),
    w2 = wide(0.4)
  const slope = (w1 - w2) / 0.4
  let k = Math.round((0.8 + (width - w1) / slope) / 0.005) * 0.005
  for (let i = 0; i < 20 && wide(k) > width; i++) k -= 0.005
  for (let i = 0; i < 20 && wide(k + 0.005) <= width; i++) k += 0.005
  return Math.round(k * 1000) / 1000
}

/** Like fitK, but the figure must also be at most `height` px tall: upright figures (a board, a calendar) run out of height before width. */
export function fitBox(width: number, height: number, build: (k: number) => Sized): number {
  return Math.min(
    fitK(width, build),
    fitK(width, (k) => ({ width: (build(k).height * width) / height })),
  )
}

/** Rounded rectangle wound counter-clockwise from the (x + w, y) corner. `r` is one radius or one per corner in that order; a 0 corner is a single sharp point. */
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

/** The run of a closed plan's outline the viewer sees (edges facing +x/+y on screen), as points from its first corner to its last. */
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
