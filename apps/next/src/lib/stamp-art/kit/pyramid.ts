// Pyramids seen corner-on: a lit face left, a shaded face right, one silhouette. `pyramid` is the
// smooth-sided Giza kind; `stepped-pyramid` is the terraced Mesoamerican kind (El Castillo). Both
// are drawn from a box whose bottom is the front corner of the base.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

/**
 * Smooth pyramid. The apex sits at `apex` (fraction of the width) from the left; the base corners
 * are `depth` (fraction of the height) higher than the front corner. The right face takes diagonal
 * hair hatching, the left face stays lit with `courses` fine casing lines.
 */
export const pyramid: KitModule = ([x, y, w, h], p) => {
  const apexAt = num(p, 'apex', 0.42)
  const depth = h * num(p, 'depth', 0.07)
  const courses = Math.round(num(p, 'courses', 0))
  const A: Pt = [x + w * apexAt, y]
  const F: Pt = [A[0], y + h]
  const L: Pt = [x, y + h - depth]
  const R: Pt = [x + w, y + h - depth]
  const out: SvgNode[] = [...body([A, L, F, R], 'line')]
  out.push(
    ...toneFill([A, F, R], 'T4', {
      angle: num(p, 'angle', -64),
      gap: num(p, 'gap', 2.2),
      inset: 0.4,
    }),
  )
  out.push(stroke('line', [A, F]))
  for (let i = 1; i <= courses; i++) {
    const t = i / (courses + 1)
    const a: Pt = [A[0] + (L[0] - A[0]) * t, A[1] + (L[1] - A[1]) * t]
    const b: Pt = [A[0], A[1] + (F[1] - A[1]) * t]
    out.push(stroke('fine', [a, b]))
  }
  return out
}

/**
 * Stepped pyramid with terraces, a central stairway and a summit temple. Proportions are params so
 * the same module draws squat El Castillo (`steep` 0.5) and the tall Tikal or Copan kind (`steep` 1.4+):
 * the box is the whole building (terraces plus temple), `temple` is the temple's share of the height,
 * `top` the width of the summit platform as a fraction of the base. The front face is seen square-on
 * with the right face compressed to a shaded sliver of `side` (fraction of width) so it keeps its mass.
 */
export const steppedPyramid: KitModule = ([x, y, w, h], p) => {
  const terraces = Math.max(2, Math.round(num(p, 'terraces', 9)))
  const templeShare = num(p, 'temple', 0.16)
  const topW = num(p, 'top', 0.34)
  const stairW = num(p, 'stair', 0.2)
  const side = num(p, 'side', 0.14)
  const templeW = num(p, 'templeW', 0.2)
  const bodyH = h * (1 - templeShare)
  const templeH = h - bodyH
  const front = w * (1 - side)
  const cx = x + front / 2
  const base = y + h
  const top = y + templeH
  const out: SvgNode[] = []
  const stepH = bodyH / terraces
  const widthAt = (i: number) => front * (1 - (1 - topW) * (i / terraces)) // i = terraces climbed
  // Terrace fronts, from the base up so each higher one overlaps nothing below it.
  for (let i = 0; i < terraces; i++) {
    const tw = widthAt(i)
    const yb = base - stepH * i
    const sxo = side * w * (1 - i / terraces)
    const face: Pt[] = [
      [cx - tw / 2, yb],
      [cx - tw / 2, yb - stepH],
      [cx + tw / 2, yb - stepH],
      [cx + tw / 2 + sxo, yb - stepH * 0.82],
      [cx + tw / 2 + sxo, yb + 0],
    ]
    // Right cap polygon for this terrace (shaded).
    const cap: Pt[] = [
      [cx + tw / 2, yb - stepH],
      [cx + tw / 2 + sxo, yb - stepH * 0.82],
      [cx + tw / 2 + sxo, yb],
      [cx + tw / 2, yb],
    ]
    out.push(occlude(face), stroke('line', [face[0], face[1], face[2], face[3], face[4]]))
    out.push(hline('line', cx - tw / 2, cx + tw / 2 + sxo, yb))
    out.push(...toneFill(cap, 'T4', { gap: 2 }))
    out.push(stroke('hair', [cap[0], cap[3]]))
  }
  // Stairway: central strip, a dark flank each side, lit treads between (fine lines).
  const sw = front * stairW
  const sTop = top
  const sTw = sw * 0.62
  const stair: Pt[] = [
    [cx - sw / 2, base],
    [cx - sTw / 2, sTop],
    [cx + sTw / 2, sTop],
    [cx + sw / 2, base],
  ]
  out.push(occlude(stair), stroke('line', stair, true))
  for (const s of [-1, 1]) {
    const wall: Pt[] = [
      [cx + (s * sw) / 2, base],
      [cx + (s * sTw) / 2, sTop],
      [cx + s * (sTw / 2 - sw * 0.08), sTop],
      [cx + s * (sw / 2 - sw * 0.11), base],
    ]
    out.push(fill(wall))
  }
  const treads = Math.round(num(p, 'treads', 14))
  for (let i = 1; i < treads; i++) {
    const t = i / treads
    const yy = base - (base - sTop) * t
    const half = (sw / 2) * (1 - t) + (sTw / 2) * t
    out.push(hline('fine', cx - half + sw * 0.14, cx + half - sw * 0.14, yy))
  }
  // Summit temple on the top terrace, a door and a lintel.
  const tw = front * templeW
  const ty = y
  out.push(...body(rectPts(cx - tw / 2, ty + templeH * 0.12, tw, templeH * 0.88), 'line'))
  out.push(...body(rectPts(cx - tw / 2 - 1.2, ty, tw + 2.4, templeH * 0.2), 'line'))
  const dw = tw * 0.34
  out.push(fill(rectPts(cx - dw / 2, ty + templeH * 0.38, dw, templeH * 0.62)))
  out.push(
    stroke('bold', [
      [cx - (front * topW) / 2 - 1.5, top],
      [cx + (front * topW) / 2 + 1.5, top],
    ]),
  )
  return out
}
