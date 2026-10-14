// Gaff-rigged island cutter (lane A, `-a` until consolidated): a double-ended hull, a four-sided
// gaff mainsail with seam lines on a boom that overhangs the stern, a T4 jib to a short bowsprit
// and a pennant. Unlike the sloop it carries a quadrilateral sail. The box is the boat; its bottom
// is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const catboatA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const mx = x + w * num(p, 'mast', 0.44)
  const x0 = x + w * 0.04
  const x1 = x + w * 0.9
  const out: SvgNode[] = []
  const sheer = quad([x0, base - 7], [(x0 + x1) / 2, base - 3], [x1, base - 11], 16)
  const keel = quad([x1 - 3, base - 4], [(x0 + x1) / 2 + 4, base + 3], [x0 + 3, base - 3], 16)
  const hull: Pt[] = [...sheer, ...keel]
  const topMast = y + h * 0.04
  const boomY = base - 12
  // Mainsail: luff on the mast, foot on the boom, a gaff across the head.
  const peak: Pt = [x + w * 0.16, y + h * 0.2]
  const leech = quad(peak, [x0 + w * 0.0, boomY - h * 0.3], [x0 - 2, boomY], 10)
  const main: Pt[] = [[mx, boomY], [mx, topMast + 3], peak, ...leech.slice(1)]
  out.push(...body(main, 'line'))
  for (let t = 0.22; t < 0.9; t += 0.22) {
    const lx = mx
    const ly = boomY + (topMast + 3 - boomY) * t
    const rx = leech[Math.round(leech.length * t)]?.[0] ?? x0
    const ry = leech[Math.round(leech.length * t)]?.[1] ?? boomY
    out.push(
      stroke('fine', [
        [lx, ly],
        [rx, ry + 2],
      ]),
    )
  }
  out.push(stroke('hair', [[mx, topMast + 3], peak]))
  // Jib.
  const jib: Pt[] = [
    [mx + 1.5, topMast + 5],
    [x1 + 3, base - 12],
    [mx + 1.5, boomY + 1],
  ]
  out.push(...body(jib, 'line'))
  out.push(...toneFill(jib, 'T4', { inset: 0.5, gap: 3 }))
  // Mast, boom, pennant.
  out.push(
    stroke('line', [
      [mx, topMast - 2],
      [mx, base - 8],
    ]),
  )
  out.push(
    stroke('line', [
      [x0 - 4, boomY + 0.5],
      [mx, boomY],
    ]),
  )
  out.push(
    fill([
      [mx, topMast - 2],
      [mx + 8, topMast + 0.2],
      [mx, topMast + 2.4],
    ]),
  )
  // Hull.
  out.push(occlude(hull, { halo: 1.2 }))
  out.push(...toneFill(hull, 'T4', { gap: 2.8, inset: 0.3 }))
  out.push(stroke('line', hull, true), stroke('bold', sheer))
  out.push(hline('fine', x + w * 0.2, x + w * 0.7, base + 4.4))
  return out
}
