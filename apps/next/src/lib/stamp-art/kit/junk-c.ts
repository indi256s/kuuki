// Hong Kong: a junk under sail. A curved dark hull with a raised stern, two battened sails (lit,
// with horizontal batten lines) on raked masts. The box bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, stroke } from '../grid'
import { type KitModule } from './util'

export const junkC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h
  const hullH = h * 0.2
  const hull: Pt[] = [
    [x, base - hullH - 1.5],
    [x + w * 0.1, base],
    [x + w * 0.88, base],
    [x + w, base - hullH - 2.5],
    [x + w * 0.9, base - hullH],
    [x + w * 0.1, base - hullH],
  ]
  const sails: [number, number, number][] = [
    [0.3, 0.3, 1],
    [0.62, 0.34, 0.8],
  ]
  for (const [fx, fw, hh] of sails) {
    const sx = x + w * fx
    const sw = w * fw
    const top = y + (1 - hh) * (h - hullH) * 0.6
    const sail: Pt[] = [
      [sx, top],
      [sx + sw, top + 3],
      [sx + sw * 0.92, base - hullH - 1],
      [sx - sw * 0.04, base - hullH - 1],
    ]
    out.push(occlude(sail, { halo: 1.2 }), ...body(sail, 'hair'))
    const n = 5
    for (let i = 1; i < n; i++) {
      const t = i / n
      const yy = top + (base - hullH - 1 - top) * t
      out.push(hline('hair', sx - sw * 0.04 * t, sx + sw * (1 - 0.08 * t), yy + 3 * (1 - t)))
    }
    out.push(
      stroke('line', [
        [sx + sw * 0.1, top - 2],
        [sx + sw * 0.1, base - hullH],
      ]),
    )
  }
  out.push(occlude(hull, { halo: 1.2 }), fill(hull))
  return out
}
