// Gutenberg Castle (Balzers, LI), lane C: a small castle on a steep isolated knoll. The knoll is
// the lower 57% of the box (flat crown, steep flanks, fine diagonal hatch on the lit left, vertical hatch
// on the shaded right); the castle is the upper 43%: a square keep with a crenellated parapet, a
// hall with a steep slate gable, a round turret with a conical slate roof, and a low curtain wall
// with merlons and a dark gate in front. The box bottom is the foot of the knoll.
import { type Pt, type SvgNode, body, fill, hatchPoly, rectPts, stroke } from '../grid'
import { mulberry32 } from '../hash'
import { type KitModule, num } from './util'

const PROFILE: Pt[] = [
  [0, 1],
  [0.04, 0.96],
  [0.09, 0.9],
  [0.14, 0.82],
  [0.19, 0.72],
  [0.23, 0.62],
  [0.26, 0.52],
  [0.28, 0.43],
  [0.72, 0.43],
  [0.75, 0.52],
  [0.79, 0.63],
  [0.83, 0.73],
  [0.88, 0.83],
  [0.93, 0.91],
  [0.97, 0.96],
  [1, 1],
]

export const gutenbergC: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const X = (f: number) => x + f * w
  const Y = (f: number) => y + f * h
  const base = y + h
  const crown = Y(0.43)
  const out: SvgNode[] = []

  // Knoll: a ragged outline, shaded right flank, fine diagonal hatch on the lit left.
  const rock: Pt[] = PROFILE.map(([fx, fy], i) =>
    i === 0 || i === PROFILE.length - 1 || fy === 0.43
      ? [X(fx), Y(fy)]
      : [X(fx) + (rand() - 0.5) * 3.4, Y(fy)],
  )
  out.push(...body(rock, 'line'))
  const shade: Pt[] = [
    [X(0.52), crown],
    ...rock.filter((_, i) => PROFILE[i][0] >= 0.72),
    [X(0.52), base],
  ]
  out.push(...hatchPoly(shade, { angle: 90, gap: 2.4, weight: 'hair' }))
  const lit: Pt[] = [
    [X(0.52), crown],
    [X(0.28), crown],
    ...rock.filter((_, i) => PROFILE[i][0] < 0.28).reverse(),
    [X(0.52), base],
  ]
  out.push(...hatchPoly(lit, { angle: -58, gap: 4.2, weight: 'fine' }))

  // Keep: square tower, parapet with three merlons, two slits, shaded right third.
  const kx = X(0.29),
    kw = 15,
    kTop = crown - h * 0.42
  out.push(...body(rectPts(kx, kTop, kw, crown - kTop), 'line'))
  out.push(
    ...hatchPoly(rectPts(kx + kw * 0.62, kTop + 3, kw * 0.38, crown - kTop - 3), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  for (let m = 0; m < 3; m++) out.push(...body(rectPts(kx + m * 6, kTop - 2.6, 3, 2.6), 'hair'))
  out.push(
    stroke('bold', [
      [kx - 1.2, kTop],
      [kx + kw + 1.2, kTop],
    ]),
  )
  for (const sy of [kTop + 8, kTop + 20]) out.push(fill(rectPts(kx + 3.6, sy, 1.8, 5.5)))

  // Hall: gabled slate roof, two dark windows, shaded right.
  const hx = kx + kw,
    hw = 22,
    hTop = crown - h * 0.24,
    ridge = hTop - h * 0.12
  out.push(...body(rectPts(hx, hTop, hw, crown - hTop), 'line'))
  out.push(
    ...hatchPoly(rectPts(hx + hw * 0.62, hTop, hw * 0.38, crown - hTop), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  const roof: Pt[] = [
    [hx - 1.5, hTop],
    [hx + hw * 0.5, ridge],
    [hx + hw + 1.5, hTop],
  ]
  out.push(...body(roof, 'line'), fill(roof))
  out.push(fill(rectPts(hx + 4, hTop + 4.5, 2.4, 4)), fill(rectPts(hx + 10, hTop + 4.5, 2.4, 4)))

  // Round turret with a conical roof at the right end.
  const tx = hx + hw + 1,
    tw = 10,
    tTop = crown - h * 0.26
  out.push(...body(rectPts(tx, tTop, tw, crown - tTop), 'line'))
  out.push(
    ...hatchPoly(rectPts(tx + tw * 0.55, tTop, tw * 0.45, crown - tTop), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  const cone: Pt[] = [
    [tx - 1.2, tTop],
    [tx + tw / 2, tTop - h * 0.1],
    [tx + tw + 1.2, tTop],
  ]
  out.push(...body(cone, 'line'), fill(cone))

  // Curtain wall in front: merlons, a dark gate.
  const wx = X(0.28),
    ww = X(0.72) - X(0.28),
    wTop = crown - h * 0.1
  out.push(...body(rectPts(wx, wTop, ww, crown - wTop + 0.5), 'line'))
  for (let mx = wx + 1; mx < wx + ww - 3; mx += 5.2)
    out.push(...body(rectPts(mx, wTop - 2.4, 3, 2.4), 'hair'))
  out.push(
    stroke('bold', [
      [wx, wTop],
      [wx + ww, wTop],
    ]),
  )
  out.push(fill(rectPts(wx + ww * 0.42, wTop + 3, 4.6, crown - wTop - 3)))
  return out
}
