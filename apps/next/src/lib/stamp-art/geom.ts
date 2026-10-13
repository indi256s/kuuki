// Small polygon/segment geometry used by the renderer: occlusion (erase strokes behind a body)
// and mirroring (keep the left half of a module and reflect it).
import { type Pt, type StrokeNode, type SvgNode, mirrorPts, ptsBounds, stroke } from './grid'

const EPS = 1e-9

export function pointInPoly(p: Pt, poly: Pt[]): boolean {
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

/** Parts of segment a-b that lie outside `poly`. */
function segmentOutside(a: Pt, b: Pt, poly: Pt[]): [Pt, Pt][] {
  const ts = [0, 1]
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i],
      d = poly[(i + 1) % poly.length]
    const ex = d[0] - c[0],
      ey = d[1] - c[1]
    const den = dx * ey - dy * ex
    if (Math.abs(den) < EPS) continue
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den
    const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t)
  }
  ts.sort((m, n) => m - n)
  const out: [Pt, Pt][] = []
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i],
      t1 = ts[i + 1]
    if (t1 - t0 < 1e-6) continue
    const tm = (t0 + t1) / 2
    if (!pointInPoly([a[0] + dx * tm, a[1] + dy * tm], poly)) {
      out.push([
        [a[0] + dx * t0, a[1] + dy * t0],
        [a[0] + dx * t1, a[1] + dy * t1],
      ])
    }
  }
  return out
}

const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

/** Chain consecutive segments that touch end to start back into polylines. */
function chain(segs: [Pt, Pt][]): Pt[][] {
  const out: Pt[][] = []
  for (const [a, b] of segs) {
    const last = out[out.length - 1]
    if (last && same(last[last.length - 1], a)) last.push(b)
    else out.push([a, b])
  }
  return out
}

/** Removes the parts of a stroke that fall inside `poly`. */
export function clipStrokeOutside(node: StrokeNode, poly: Pt[]): StrokeNode[] {
  const pts = node.closed ? [...node.pts, node.pts[0]] : node.pts
  const [bx0, by0, bx1, by1] = ptsBounds(poly)
  const [sx0, sy0, sx1, sy1] = ptsBounds(pts)
  if (sx1 < bx0 || sx0 > bx1 || sy1 < by0 || sy0 > by1) return [node]
  const segs: [Pt, Pt][] = []
  for (let i = 0; i + 1 < pts.length; i++) segs.push(...segmentOutside(pts[i], pts[i + 1], poly))
  const lines = chain(segs)
  // A closed outline that survived whole stays closed.
  if (node.closed && lines.length === 1 && lines[0].length === pts.length) return [node]
  return lines.map((l) => stroke(node.weight, l))
}

/** Sutherland-Hodgman against the half-plane x <= cx. */
function clipHalf(poly: Pt[], cx: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    const ain = a[0] <= cx,
      bin = b[0] <= cx
    if (ain) out.push(a)
    if (ain !== bin) {
      const t = (cx - a[0]) / (b[0] - a[0])
      out.push([cx, a[1] + t * (b[1] - a[1])])
    }
  }
  return out
}

const HALF_PLANE_FAR = 1e4

/** Keeps the left half of each node (x <= cx) and adds its reflection. */
export function mirrorLeft(nodes: SvgNode[], cx: number): SvgNode[] {
  const out: SvgNode[] = []
  const wall: Pt[] = [
    [cx, -HALF_PLANE_FAR],
    [HALF_PLANE_FAR, -HALF_PLANE_FAR],
    [HALF_PLANE_FAR, HALF_PLANE_FAR],
    [cx, HALF_PLANE_FAR],
  ]
  for (const n of nodes) {
    if (n.kind === 'stroke') {
      const left = clipStrokeOutside(n, wall)
      for (const s of left) {
        out.push(s, stroke(s.weight, mirrorPts(s.pts, cx).reverse()))
      }
    } else {
      const half = clipHalf(n.pts, cx)
      if (half.length < 3) continue
      out.push({ ...n, pts: half }, { ...n, pts: mirrorPts(half, cx).reverse() })
    }
  }
  return out
}
