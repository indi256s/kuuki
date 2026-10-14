// Ngalawa: a slim Comorian dugout with an outrigger float carried on two curved arms and a tall
// triangular sail on a raked mast. Bow to the right; the box bottom is the waterline, the float
// rides just in front of it.
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const ngalawa: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  const x0 = x + w * 0.04,
    x1 = x + w * 0.82
  const rimY = base - 9
  const rim = quad([x0, rimY - 4], [(x0 + x1) / 2, rimY + 2], [x1, rimY - 6], 16)
  const keel = quad([x1 - 3, base + 0.5], [(x0 + x1) / 2, base + 3.4], [x0 + 3, base + 0.5], 16)
  const hull: Pt[] = [...rim, ...keel]
  // Sail first (behind the hull): triangle between mast, boom and a curved leech.
  const mx = x + w * num(p, 'mast', 0.5)
  const top: Pt = [mx - w * 0.07, y + 1]
  const tack: Pt = [mx + 1, rimY - 1]
  const clew: Pt = [x + w * 0.1, rimY - 6]
  const leech = quad(top, [mx - w * 0.2, y + h * 0.5], clew, 12)
  const sail: Pt[] = [...leech, tack]
  out.push(occlude(sail, { halo: 1 }))
  for (let k = 1; k < 6; k++) {
    const t = k / 6
    const a: Pt = [tack[0] + (top[0] - tack[0]) * t, tack[1] + (top[1] - tack[1]) * t]
    const b: Pt = [tack[0] + (clew[0] - tack[0]) * t, tack[1] + (clew[1] - tack[1]) * t]
    out.push(
      stroke('fine', quad(a, [(a[0] + b[0]) / 2 - 1.5, (a[1] + b[1]) / 2 + 1.5 + k * 0.3], b, 8)),
    )
  }
  out.push(
    ...toneFill(
      [[top[0] + 4, top[1] + 8], ...leech.slice(2, 10), [tack[0] - 8, tack[1] - 20]],
      'T2',
      { angle: 62, gap: 3.4, weight: 'fine', inset: 1.5 },
    ).slice(0, 0),
  )
  out.push(stroke('line', [...leech, tack], true))
  out.push(stroke('bold', [[mx + 1, rimY], top]), stroke('bold', [clew, [mx + 1, rimY - 1]]))
  // Hull.
  out.push(
    occlude(hull, { halo: 1.2 }),
    ...toneFill(hull, 'T4', { angle: 90, gap: 2.4, weight: 'hair', inset: 0.3 }),
  )
  out.push(stroke('line', hull, true), stroke('bold', rim))
  // Outrigger: float and two curved arms.
  const fy = base + 7.5
  const f0 = x + w * 0.18,
    f1 = x + w * 0.78
  const float: Pt[] = [
    ...quad([f0, fy - 3.4], [(f0 + f1) / 2, fy + 0.6], [f1, fy - 3.6], 14),
    ...quad([f1 - 1, fy + 3], [(f0 + f1) / 2, fy + 4.4], [f0 + 1, fy + 3], 14),
  ]
  out.push(
    occlude(float, { halo: 0.8 }),
    ...toneFill(float, 'T4', { angle: 90, gap: 2.2, weight: 'fine' }),
  )
  out.push(stroke('line', float, true))
  for (const f of [0.34, 0.66]) {
    const ax = x0 + (x1 - x0) * f
    out.push(
      stroke('line', quad([ax, rimY + 1], [ax + 5, rimY + 8], [ax + (f - 0.5) * 6, fy - 2], 8)),
    )
  }
  out.push(
    stroke('hair', [
      [x0 + (x1 - x0) * 0.34 + 1, base - 4],
      [x0 + (x1 - x0) * 0.66 + 4, base - 4],
    ]),
  )
  // Water: broken glints, closing in towards the bottom.
  for (const [dy, a, b] of [
    [12.5, 0.04, 0.3],
    [14.2, 0.55, 0.95],
    [16.2, 0.12, 0.5],
  ] as const)
    out.push(hline('hair', x + w * a, x + w * b, base + dy))
  return out
}
