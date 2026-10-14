// A band of city roofs along the horizon: flat-topped blocks with sloped mansard caps, shaded with
// vertical hair hatching (buildings, so vertical is right), no outlines except the roof line.
import { mulberry32 } from '../hash'
import { type Pt, occlude, rectPts, stroke, toneFill, type SvgNode } from '../grid'
import { type KitModule, num } from './util'

/** Rooftops from the box's left edge to its right edge, sitting on the horizon. */
export const rooftops: KitModule = ([x, y, w, h], p) => {
  const horizon = num(p, 'horizonY', y + h * 0.7)
  const height = num(p, 'height', 12)
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const out: SvgNode[] = []
  let px = x
  while (px < x + w) {
    const bw = 8 + rand() * 9
    const bh = height * (0.55 + rand() * 0.45)
    const cap = 2.5 + rand() * 2
    const x1 = Math.min(x + w + 2, px + bw)
    const poly: Pt[] = [
      [px, horizon],
      [px, horizon - bh + cap],
      [px + cap * 0.9, horizon - bh],
      [x1 - cap * 0.9, horizon - bh],
      [x1, horizon - bh + cap],
      [x1, horizon],
    ]
    out.push(
      occlude(poly, { halo: 1 }),
      ...toneFill(rectPts(px, horizon - bh + cap, x1 - px, bh - cap), 'T4', {
        gap: 2.2,
        weight: 'fine',
      }),
    )
    out.push({ ...stroke('hair', [poly[0], ...poly.slice(1, 5), poly[5]]), bg: true })
    px = x1 + 0.6
  }
  return out
}
