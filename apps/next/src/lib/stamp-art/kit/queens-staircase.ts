// Bahamas: the Queen's Staircase in Nassau, a flight of steps cut through a gorge in the limestone.
// Two rock walls rise towards the cutting (left wall lit with strata, right wall shaded with
// fall-line hatching) and frame a stepped path that narrows upwards to a notch of sky. The box is
// the whole cutting; the bottom is the foot of the steps.
import { type Pt, type SvgNode, body, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const queensStaircase: KitModule = ([x, y, w, h], p) => {
  const cx = x + w * 0.5
  const steps = Math.max(6, Math.round(num(p, 'steps', 14)))
  const gapTop = w * num(p, 'gapTop', 0.1)
  const gapBot = w * num(p, 'gapBot', 0.4)
  const pathTop = y + h * 0.3
  const half = (t: number) => (gapTop + (gapBot - gapTop) * t) / 2 // t: 0 top, 1 bottom
  const out: SvgNode[] = []
  const edge = (side: -1 | 1): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push([cx + side * half(t), pathTop + t * (y + h - pathTop)])
    }
    return pts
  }
  // Crag tops step down and outwards from the cutting.
  const tops = (side: -1 | 1): Pt[] => {
    const gx = cx + side * (gapTop / 2 + 2)
    const far = side < 0 ? x : x + w
    const pts: Pt[] = [
      [gx, y + h * 0.03],
      [gx + side * w * 0.07, y + h * 0.02],
      [gx + side * w * 0.14, y + h * 0.1],
      [gx + side * w * 0.19, y + h * 0.08],
      [gx + side * w * 0.27, y + h * 0.2],
      [far, y + h * 0.26],
    ]
    return pts
  }
  const left: Pt[] = [...tops(-1), [x, y + h], ...edge(-1).reverse(), [cx - gapTop / 2, pathTop]]
  const right: Pt[] = [...tops(1), [x + w, y + h], ...edge(1).reverse(), [cx + gapTop / 2, pathTop]]
  // Close the notch between the crags.
  left.unshift([cx - gapTop / 2, pathTop])
  right.unshift([cx + gapTop / 2, pathTop])
  out.push(...body(left, 'line'), ...body(right, 'line'))
  out.push(...toneFill(right, 'T4', { inset: 0.8, gap: [2.8, 2.8], weight: 'fine' }))
  for (let i = 0; i < 6; i++) {
    const yy = y + h * (0.3 + i * 0.12)
    const t = (yy - pathTop) / (y + h - pathTop)
    out.push(hline('hair', x + 4 + (i % 2) * 6, cx - half(Math.min(1, t)) - 3, yy))
  }
  for (let i = 0; i < 5; i++) {
    const yy = y + h * (0.34 + i * 0.12)
    const xx = x + 9 + (i % 2) * 8
    out.push(
      stroke('fine', [
        [xx, yy],
        [xx, yy + h * 0.1],
        [xx + 11, yy + h * 0.1],
      ]),
    )
  }
  // The flight: treads across the path, risers at the edges.
  for (let i = 0; i < steps; i++) {
    const sy = pathTop + ((y + h - pathTop) * (i + 1)) / steps
    const hw = half((i + 1) / steps)
    const prev = pathTop + ((y + h - pathTop) * i) / steps
    const phw = half(i / steps)
    const tread: Pt[] = [
      [cx - phw, prev],
      [cx + phw, prev],
      [cx + hw, sy],
      [cx - hw, sy],
    ]
    out.push(...body(tread, 'hair'))
    if (i % 2) out.push(...toneFill(tread, 'T4', { gap: 2.4, weight: 'fine' }))
    out.push(hline('hair', cx - hw, cx + hw, sy))
  }
  out.push(
    occlude([
      [cx - gapTop / 2, y],
      [cx + gapTop / 2, y],
      [cx + gapTop / 2, pathTop],
      [cx - gapTop / 2, pathTop],
    ]),
    stroke('hair', [
      [cx - gapTop / 2, pathTop],
      [cx + gapTop / 2, pathTop],
    ]),
  )
  return out
}
