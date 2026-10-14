// Hong Kong: the Peak Tram. A straight steep track climbing a hillside, with sleepers, a small car
// part way up and a low station at the summit end. The box is the whole hill; `from` and `to` are
// [x, y] fractions of it (foot of the track, summit station).
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke } from '../grid'
import { type KitModule, nums } from './util'

export const funicularC: KitModule = ([x, y, w, h], p) => {
  const from = nums(p, 'from', [0.2, 0.92])
  const to = nums(p, 'to', [0.58, 0.2])
  const ax = x + w * from[0],
    ay = y + h * from[1],
    bx = x + w * to[0],
    by = y + h * to[1]
  const len = Math.hypot(bx - ax, by - ay)
  const ux = (bx - ax) / len,
    uy = (by - ay) / len
  const nx = -uy,
    ny = ux
  const half = 3.4
  const at = (t: number, off: number): Pt => [
    ax + ux * len * t + nx * off,
    ay + uy * len * t + ny * off,
  ]
  const out: SvgNode[] = []
  const strip: Pt[] = [at(0, -half), at(1, -half), at(1, half), at(0, half)]
  out.push(occlude(strip, { halo: 1.4 }))
  out.push(stroke('hair', [at(0, -half), at(1, -half)]), stroke('hair', [at(0, half), at(1, half)]))
  out.push(stroke('line', [at(0, -1.1), at(1, -1.1)]), stroke('line', [at(0, 1.1), at(1, 1.1)]))
  for (let t = 0.03; t < 1; t += 3.2 / len) out.push(stroke('hair', [at(t, -half), at(t, half)]))
  // car
  const c0 = 0.5,
    c1 = 0.5 + 15 / len
  const car: Pt[] = [
    at(c0, -half - 3.6),
    at(c1, -half - 3.6),
    at(c1, half - 0.4),
    at(c0, half - 0.4),
  ]
  out.push(occlude(car, { halo: 1 }), ...body(car, 'line'))
  for (let k = 0; k < 3; k++) {
    const t = c0 + (3 + k * 4.2) / len
    out.push(
      fill([
        at(t, -half - 2.4),
        at(t + 2.6 / len, -half - 2.4),
        at(t + 2.6 / len, -half + 0.6),
        at(t, -half + 0.6),
      ]),
    )
  }
  // summit station
  out.push(
    occlude(rectPts(bx - 9, by - 9, 20, 9), { halo: 1.4 }),
    ...body(rectPts(bx - 9, by - 9, 20, 9), 'line'),
  )
  out.push(
    fill(rectPts(bx - 6, by - 6, 3, 3)),
    fill(rectPts(bx - 0.5, by - 6, 3, 3)),
    fill(rectPts(bx + 5, by - 6, 3, 3)),
  )
  return out
}
