// Belize: El Castillo at Xunantunich. A broad pyramid wider than tall: three battered terraces,
// the right face of each in T4, a flat-topped temple block on top with the stucco frieze band as T4
// texture across its upper third and a dark doorway, a small upper block above it, jungle crowns
// (canopy hatching) rising on both sides. The box is the whole subject; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, toneFill } from '../grid'
import { canopyNodes } from './mass-b'
import { clipPoly } from './rock-b'
import { type KitModule, num } from './util'

export const castilloA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const out: SvgNode[] = []
  const base = y + h
  // Jungle behind and beside the pyramid.
  out.push(...canopyNodes(X(0), X(0.3), base, h * 0.62, rand, { crowns: 3, thr: 0.3 }))
  out.push(...canopyNodes(X(0.7), X(1), base, h * 0.7, rand, { crowns: 3, thr: 0.3 }))
  // Terraces: [half-width at the foot, half-width at the top, top v].
  const tiers: [number, number, number][] = [
    [0.5, 0.455, 0.8],
    [0.4, 0.365, 0.6],
    [0.3, 0.27, 0.43],
  ]
  let footV = 1
  const cx = X(0.5)
  tiers.forEach(([hb, ht, topV], i) => {
    const yb = Y(footV),
      yt = Y(topV)
    const poly: Pt[] = [
      [cx - w * hb, yb],
      [cx - w * ht, yt],
      [cx + w * ht, yt],
      [cx + w * hb, yb],
    ]
    out.push(...body(poly, 'line'))
    // Light from the left: the right 38% of each riser is in shade.
    const dark = clipPoly(poly, ([px]) => px - (cx + w * ht * 0.6))
    out.push(...toneFill(dark, 'T4', { gap: 2.2 }))
    // Ledge at the foot of the riser, and masonry courses on the lit side.
    out.push(hline('bold', cx - w * hb, cx + w * hb, yb))
    if (i === 0) out.push(hline('hair', cx - w * hb * 0.96, cx - w * 0.06, Y(0.9)))
    footV = topV
  })
  // Temple block on the summit.
  const bx0 = X(0.28),
    bx1 = X(0.72),
    by0 = Y(0.1),
    by1 = Y(0.43)
  out.push(...body(rectPts(bx0, by0, bx1 - bx0, by1 - by0), 'line'))
  // Stucco frieze across the upper third: T4 texture with a lit course above and below.
  const fz0 = by0 + 3,
    fz1 = by0 + (by1 - by0) * 0.52
  out.push(...toneFill(rectPts(bx0 + 1.6, fz0, bx1 - bx0 - 3.2, fz1 - fz0), 'T4', { gap: 2.0 }))
  out.push(hline('hair', bx0, bx1, fz1 + 2.2))
  // Doorway.
  out.push(fill(rectPts(cx - 3.6, by1 - (by1 - fz1) * 0.62, 7.2, (by1 - fz1) * 0.62)))
  // Cornice and the small block above.
  out.push(hline('bold', bx0 - 1.5, bx1 + 1.5, by0))
  const ux0 = X(0.42),
    ux1 = X(0.58)
  out.push(...body(rectPts(ux0, y + 2, ux1 - ux0, by0 - y - 2), 'line'))
  out.push(...toneFill(rectPts(cx + 1, y + 1.5, ux1 - cx - 1, by0 - y - 1.5), 'T4', { gap: 2.2 }))
  out.push(hline('bold', ux0 - 1, ux1 + 1, y + 2))
  return out
}
