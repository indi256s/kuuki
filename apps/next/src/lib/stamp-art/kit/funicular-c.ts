// Peak Tram (Hong Kong): a steep funicular track climbing a hillside, drawn as a paper (T0) band
// that cuts the backdrop hatching, two rails, sleepers, and one small car on the line. `from` and
// `to` are [x, y] fractions of the box.
import { type Pt, type SvgNode, fill, occlude, stroke } from '../grid'
import { type KitModule, nums } from './util'

export const funicularC: KitModule = ([x, y, w, h], p) => {
  const from = nums(p, 'from', [0.2, 0.9])
  const to = nums(p, 'to', [0.5, 0.2])
  const a: Pt = [x + w * from[0], y + h * from[1]]
  const b: Pt = [x + w * to[0], y + h * to[1]]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ux = (b[0] - a[0]) / len
  const uy = (b[1] - a[1]) / len
  const nx = -uy
  const ny = ux
  const at = (t: number, off = 0): Pt => [
    a[0] + ux * len * t + nx * off,
    a[1] + uy * len * t + ny * off,
  ]
  const out: SvgNode[] = []
  const band: Pt[] = [at(0, -2.4), at(1, -2.4), at(1, 2.4), at(0, 2.4)]
  out.push(occlude(band, { halo: 1.6 }))
  out.push(stroke('hair', [at(0, -2.4), at(1, -2.4)]), stroke('hair', [at(0, 2.4), at(1, 2.4)]))
  for (let t = 0.04; t < 1; t += 0.1) out.push(stroke('fine', [at(t, -2.4), at(t, 2.4)]))
  // The car: a box tilted with the track and one dark window band, halfway up the climb.
  const c0 = 0.5
  const c1 = 0.5 + 12 / len
  const body: Pt[] = [at(c0, 2.4), at(c0, 8.4), at(c1, 8.4), at(c1, 2.4)]
  out.push(occlude(body, { halo: 1.4 }), stroke('line', body, true))
  const win: Pt[] = [
    at(c0 + 2 / len, 4.4),
    at(c1 - 2 / len, 4.4),
    at(c1 - 2 / len, 7),
    at(c0 + 2 / len, 7),
  ]
  out.push(fill(win))
  return out
}
