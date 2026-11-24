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
  out.push(...canopyNodes(X(0), X(0.3), base, h * 0.62, rand, { crowns: 3, thr: 0.3 }))
  out.push(...canopyNodes(X(0.7), X(1), base, h * 0.7, rand, { crowns: 3, thr: 0.3 }))
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
    const dark = clipPoly(poly, ([px]) => px - (cx + w * ht * 0.6))
    out.push(...toneFill(dark, 'T4', { gap: 2.2 }))
    out.push(hline('bold', cx - w * hb, cx + w * hb, yb))
    if (i === 0) out.push(hline('hair', cx - w * hb * 0.96, cx - w * 0.06, Y(0.9)))
    footV = topV
  })
  const bx0 = X(0.28),
    bx1 = X(0.72),
    by0 = Y(0.1),
    by1 = Y(0.43)
  out.push(...body(rectPts(bx0, by0, bx1 - bx0, by1 - by0), 'line'))
  const fz0 = by0 + 3,
    fz1 = by0 + (by1 - by0) * 0.52
  out.push(...toneFill(rectPts(bx0 + 1.6, fz0, bx1 - bx0 - 3.2, fz1 - fz0), 'T4', { gap: 2.0 }))
  out.push(hline('hair', bx0, bx1, fz1 + 2.2))
  out.push(fill(rectPts(cx - 3.6, by1 - (by1 - fz1) * 0.62, 7.2, (by1 - fz1) * 0.62)))
  out.push(hline('bold', bx0 - 1.5, bx1 + 1.5, by0))
  const ux0 = X(0.42),
    ux1 = X(0.58)
  out.push(...body(rectPts(ux0, y + 2, ux1 - ux0, by0 - y - 2), 'line'))
  out.push(...toneFill(rectPts(cx + 1, y + 1.5, ux1 - cx - 1, by0 - y - 1.5), 'T4', { gap: 2.2 }))
  out.push(hline('bold', ux0 - 1, ux1 + 1, y + 2))
  return out
}
