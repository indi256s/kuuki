// A low harbour city along the horizon: flat-roofed blocks of unequal height, shaded on their right
// third with vertical fine hatching, and a couple of crane masts. The box bottom is the horizon.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, rectPts, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const bayCity: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const maxH = num(p, 'height', 9)
  const masts = Math.round(num(p, 'masts', 2))
  const out: SvgNode[] = []
  let px = x
  while (px < x + w) {
    const bw = 6 + rand() * 7
    const bh = maxH * (0.4 + rand() * 0.6)
    const x1 = Math.min(x + w + 1, px + bw)
    const poly = rectPts(px, base - bh, x1 - px, bh)
    out.push(occlude(poly, { halo: 0.8 }))
    out.push(
      stroke('hair', [
        [px, base],
        [px, base - bh],
        [x1, base - bh],
        [x1, base],
      ]),
    )
    out.push(
      ...toneFill(rectPts(px + (x1 - px) * 0.62, base - bh + 1, (x1 - px) * 0.38, bh - 1), 'T4', {
        gap: 1.8,
        weight: 'fine',
      }),
    )
    px = x1 + 0.8
  }
  for (let i = 0; i < masts; i++) {
    const mx = x + w * (0.12 + (0.76 * (i + rand() * 0.5)) / Math.max(1, masts))
    const top = base - maxH - 8 - rand() * 4
    out.push(vline('hair', mx, top, base - 2))
    out.push(hline('hair', mx - 3, mx + 3, top + 2.5))
    const jib: Pt[] = [
      [mx, top + 0.5],
      [mx + 6, top + 3.5],
    ]
    out.push(stroke('hair', jib))
  }
  out.push(hline('hair', x, x + w, base))
  return out
}
