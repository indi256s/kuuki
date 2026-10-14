// Dugout canoe (lane A, `-a` until consolidated): a long solid hull with a tall upswept prow on the
// right and a lower upswept stern on the left, a lit gunwale rim over hatched flanks and a ripple
// under the keel. The box bottom is the waterline; no sail, no crew.
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const dugoutA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const prow = h * num(p, 'prow', 0.75)
  const rimY = base - h * 0.42
  const x0 = x + w * 0.02,
    x1 = x + w * 0.98
  const rim = quad([x0, rimY - prow * 0.55], [(x0 + x1) / 2, rimY + 3.2], [x1, rimY - prow], 18)
  const keel = quad(
    [x1 - 1.5, rimY - prow + 5.2],
    [(x0 + x1) / 2 + 6, base + 2.4],
    [x0 + 1.5, rimY - prow * 0.55 + 4.6],
    18,
  )
  const hull: Pt[] = [...rim, ...keel]
  const out: SvgNode[] = [
    occlude(hull, { halo: 1.2 }),
    ...toneFill(hull, 'T4', { angle: 90, gap: 2.6, weight: 'hair', inset: 0.3 }),
    stroke('line', hull, true),
    stroke('bold', rim),
  ]
  out.push(
    hline('fine', x + w * 0.1, x + w * 0.34, base + 4.6),
    hline('fine', x + w * 0.55, x + w * 0.9, base + 5.4),
  )
  return out
}
