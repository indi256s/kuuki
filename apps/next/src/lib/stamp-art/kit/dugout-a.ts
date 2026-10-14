// Dugout canoe (lane A, `-a` until consolidated): a long solid hull with a tall upswept prow on the
// right and a lower upswept stern on the left, a lit gunwale rim over hatched flanks and a ripple
// under the keel. The box bottom is the waterline; no sail, no crew.
import { type Pt, type SvgNode, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const dugoutA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const prow = h * num(p, 'prow', 0.75)
  const rimY = base - h * 0.42
  const x0 = x + w * 0.02,
    x1 = x + w * 0.98
  const stern = num(p, 'stern', 0.55)
  const rim = quad([x0, rimY - prow * stern], [(x0 + x1) / 2, rimY + 3.2], [x1, rimY - prow], 18)
  const keel = quad(
    [x1 - 1.5, rimY - prow + 5.2],
    [(x0 + x1) / 2 + 6, base + 2.4 + num(p, 'depth', 0)],
    [x0 + 1.5, rimY - prow * stern + 4.6],
    18,
  )
  const hull: Pt[] = [...rim, ...keel]
  const out: SvgNode[] = [
    occlude(hull, { halo: 1.2 }),
    ...toneFill(hull, 'T4', { angle: 90, gap: num(p, 'gap', 2.6), weight: 'hair', inset: 0.3 }),
    stroke('line', hull, true),
    stroke('bold', rim),
  ]
  if (num(p, 'carve', 0) > 0) {
    // Carved prow: the tip curls forward into a hook with a lit centre, and inlay dots run down it.
    const tip = rim[rim.length - 1]
    const curl = quad(
      [tip[0] - 7, tip[1] + 11],
      [tip[0] + 1, tip[1] - 3],
      [tip[0] + 6, tip[1] - 2],
      8,
    )
    const curl2 = quad(
      [tip[0] + 6, tip[1] - 2],
      [tip[0] + 9, tip[1] + 3],
      [tip[0] + 3, tip[1] + 6],
      6,
    )
    out.push(stroke('line', [...curl, ...curl2.slice(1)]))
    for (const t of [0.22, 0.42, 0.62]) {
      const px = tip[0] - 2.5 - (1 - t) * 4
      const py = tip[1] + 12 + t * 9
      out.push(
        fill([
          [px - 1.3, py],
          [px, py - 1.3],
          [px + 1.3, py],
          [px, py + 1.3],
        ]),
      )
    }
  }
  out.push(
    hline('fine', x + w * 0.22, x + w * 0.4, base + 4.6),
    hline('fine', x + w * 0.55, x + w * 0.9, base + 5.4),
  )
  return out
}
