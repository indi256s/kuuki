import { type Pt, type SvgNode, fill, occlude, quad, stroke } from '../grid'
import { type KitModule } from './util'

export const junkC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h
  const hullH = 9
  const deck = base - hullH
  const bot = deck - 1.5

  const sails: [number, number, number][] = [
    [0.46, 0.5, 0],
    [0.1, 0.3, 0.3],
    [0.8, 0.24, 0.44],
  ]
  for (const [fx, fw, ft] of sails) {
    const mx = x + w * fx
    const sw = w * fw
    const top = y + h * ft + 5
    const rake = 5
    const luffAt = (t: number): Pt => [mx - rake * (1 - t), top + (bot - top) * t]
    const leech: Pt[] = quad(
      [mx + sw * 0.98, top - 5],
      [mx + sw * 1.3, (top + bot) / 2 - 6],
      [mx + sw * 0.8, bot],
      14,
    )
    const leechAt = (s: number): Pt =>
      leech[Math.round(Math.min(1, Math.max(0, s)) * (leech.length - 1))]
    const sail: Pt[] = [luffAt(0), [mx + sw * 0.5, top - 3], ...leech, luffAt(1)]
    out.push(occlude(sail, { halo: 1.4 }), stroke('line', sail, true))
    const n = Math.max(5, Math.round((bot - top) / 8))
    for (let i = 1; i < n; i++) {
      const t = i / n
      out.push(stroke('line', [luffAt(t), leechAt(t - 0.2 * (1 - t))]))
    }
    out.push(
      stroke('bold', [
        [mx - rake - 1.5, top - 3],
        [mx + 1, deck],
      ]),
    )
  }

  const hull: Pt[] = [
    [x - 1, deck - 3],
    [x + w * 0.04, base - 2],
    [x + w * 0.1, base],
    [x + w * 0.9, base],
    [x + w + 3, deck - 6],
    [x + w * 0.96, deck - 6],
    [x + w * 0.9, deck],
    [x + w * 0.2, deck],
  ]
  out.push(occlude(hull, { halo: 1.4 }), fill(hull))
  return out
}
