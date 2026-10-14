// Shared drawing parts for the lane C round 2 monuments (castles, forts, bastions): a lit block with
// a shaded right strip, crenellations, solid roofs and openings. Light comes from the left.
import {
  type Pt,
  type SvgNode,
  type Weight,
  body,
  cubic,
  quad,
  fill,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { archPts } from './windows'

/** T4 vertical hatch over a rectangle. */
export const shadeRect = (x: number, y: number, w: number, h: number): SvgNode[] =>
  toneFill(rectPts(x, y, w, h), 'T4', { inset: 0.3 })

/** A lit stone block: outline, shaded right strip (fraction `shade` of the width). */
export function block(
  x: number,
  y: number,
  w: number,
  h: number,
  o: { shade?: number; weight?: Weight } = {},
): SvgNode[] {
  const out = body(rectPts(x, y, w, h), o.weight ?? 'line')
  const s = o.shade ?? 0.3
  if (s > 0) out.push(...shadeRect(x + w * (1 - s), y + 0.8, w * s, h - 0.8))
  return out
}

/** `n` merlons standing on a wall top at y, spread across [x, x + w]. */
export function merlons(x: number, y: number, w: number, n: number, mh = 2.4): SvgNode[] {
  const pitch = w / n
  const mw = pitch * 0.58
  const out: SvgNode[] = []
  for (let i = 0; i < n; i++)
    out.push(...body(rectPts(x + i * pitch + (pitch - mw) / 2, y - mh, mw, mh), 'hair'))
  return out
}

/** Bold course line, the eaves or cornice. */
export const course = (x0: number, x1: number, y: number, weight: Weight = 'bold'): SvgNode =>
  stroke(weight, [
    [x0, y],
    [x1, y],
  ])

/** Solid conical roof; `lit` leaves the left half as paper and fills only the shaded right half. */
export function cone(
  cx: number,
  baseY: number,
  w: number,
  h: number,
  over = 1.4,
  lit = false,
): SvgNode[] {
  const pts: Pt[] = [
    [cx - w / 2 - over, baseY],
    [cx, baseY - h],
    [cx + w / 2 + over, baseY],
  ]
  if (!lit) return [occlude(pts), fill(pts)]
  return [
    ...body(pts, 'hair'),
    ...toneFill([[cx + 0.2, baseY - h + 1.2], pts[2], [cx + 0.2, baseY]], 'T4', { inset: 0.2 }),
  ]
}

/** Steep pyramid roof with a flared (bell-cast) skirt; `lit` as for `cone`. */
export function spire(
  cx: number,
  baseY: number,
  w: number,
  h: number,
  over = 1.8,
  lit = false,
): SvgNode[] {
  const hw = w / 2
  const pts: Pt[] = [
    [cx - hw - over, baseY],
    [cx - hw + 0.6, baseY - h * 0.2],
    [cx - 0.7, baseY - h],
    [cx + 0.7, baseY - h],
    [cx + hw - 0.6, baseY - h * 0.2],
    [cx + hw + over, baseY],
  ]
  if (!lit) return [occlude(pts), fill(pts)]
  return [
    ...body(pts, 'hair'),
    ...toneFill([[cx, baseY - h + 1.2], pts[3], pts[4], pts[5], [cx, baseY]], 'T4', { inset: 0.2 }),
  ]
}

/** Solid ogee cupola with a short vane. */
export function ogee(cx: number, baseY: number, w: number, h: number): SvgNode[] {
  const r = w / 2
  const left = cubic(
    [cx - r, baseY],
    [cx - r * 1.45, baseY - h * 0.4],
    [cx - r * 0.16, baseY - h * 0.5],
    [cx, baseY - h],
    10,
  )
  const right = left
    .map(([px, py]): Pt => [2 * cx - px, py])
    .reverse()
    .slice(1)
  const pts = [...left, ...right]
  return [
    occlude(pts),
    fill(pts),
    stroke('hair', [
      [cx, baseY - h],
      [cx, baseY - h - 3.4],
    ]),
  ]
}

/** Dark round-headed opening. */
export const arch = (x: number, y: number, w: number, h: number): SvgNode =>
  fill(archPts(x, y, w, h))
/** Dark rectangular slit. */
export const slit = (x: number, y: number, w: number, h: number): SvgNode =>
  fill(rectPts(x, y, w, h))

/** Octagon-ish ellipse as a polygon. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}

/** Linear interpolation of a profile of [x, y] points sorted by x. */
export function profileY(line: Pt[], x: number): number {
  if (x <= line[0][0]) return line[0][1]
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}

/** Sagging arc between two points at the same y, a cylinder cue for round towers. */
export function arcCourse(
  x0: number,
  x1: number,
  y: number,
  sag: number,
  weight: Weight = 'hair',
): SvgNode {
  const pts: Pt[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    pts.push([x0 + (x1 - x0) * t, y + sag * 4 * t * (1 - t)])
  }
  return stroke(weight, pts)
}

/** The part of a polygon between two y values (Sutherland-Hodgman on two half planes). */
export function clipPolyY(poly: Pt[], y0: number, y1: number): Pt[] {
  const cut = (pts: Pt[], keep: (p: Pt) => boolean, at: number): Pt[] => {
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length]
      const ka = keep(a),
        kb = keep(b)
      if (ka) out.push(a)
      if (ka !== kb) {
        const t = (at - a[1]) / (b[1] - a[1])
        out.push([a[0] + (b[0] - a[0]) * t, at])
      }
    }
    return out
  }
  return cut(
    cut(poly, (p) => p[1] >= y0, y0),
    (p) => p[1] <= y1,
    y1,
  )
}

/**
 * A round tower seen from the side: straight flanks, a sagging base and sagging courses (the
 * cylinder cue), a lit left and a T4 right (fraction `shade` of the width). `courses` are heights
 * above the base.
 */
export function drum(
  cx: number,
  top: number,
  bottom: number,
  w: number,
  o: { shade?: number; sag?: number; courses?: number[] } = {},
): SvgNode[] {
  const sag = o.sag ?? 2.4
  const l = cx - w / 2,
    r = cx + w / 2
  const shade = o.shade ?? 0.44
  const out = body(
    [
      [l, top],
      [r, top],
      [r, bottom],
      ...quad([r, bottom], [cx, bottom + sag * 2], [l, bottom], 8).slice(1),
    ],
    'line',
  )
  const sx = r - w * shade
  out.push(
    ...toneFill(
      [
        [sx, top + 1],
        [r - 0.6, top + 1],
        [r - 0.6, bottom - 0.4],
        ...quad(
          [r - 0.6, bottom - 0.4],
          [(sx + r) / 2, bottom + sag * 1.5],
          [sx, bottom + sag * 0.9],
          4,
        ).slice(1),
      ],
      'T4',
      { inset: 0.3 },
    ),
  )
  for (const c of o.courses ?? []) out.push(arcCourse(l, r, bottom - c, sag))
  return out
}

/** A polygon around a polyline of constant width, for paths cut out of a hatched mass. */
export function stripPts(pts: Pt[], width: number): Pt[] {
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0],
      dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * (width / 2),
      ny = (dx / len) * (width / 2)
    left.push([pts[i][0] + nx, pts[i][1] + ny])
    right.push([pts[i][0] - nx, pts[i][1] - ny])
  }
  return [...left, ...right.reverse()]
}
