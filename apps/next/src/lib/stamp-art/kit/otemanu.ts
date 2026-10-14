// Bora Bora: Mount Otemanu, a basalt plug with a notched summit, about 40% of the width and
// centred, the lower Pahia shoulder behind it on the left and a ragged band of forest at the foot.
// Rock follows the shared rule: strata and fracture on the lit left, T4 on the shaded right, no
// vertical drapes. The box is the whole massif; its bottom is the waterline of the lagoon.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { canopyNodes } from './mass-b'
import { rockMass } from './rock-b'
import { type KitModule, num } from './util'

export const otemanu: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const base = y + h
  const out: SvgNode[] = []
  // Pahia: the lower, rounder shoulder on the left, T2.
  const pahia: Pt[] = [
    [X(0.0), base],
    [X(0.03), Y(0.78)],
    [X(0.12), Y(0.64)],
    [X(0.22), Y(0.56)],
    [X(0.3), Y(0.52)],
    [X(0.36), Y(0.56)],
    [X(0.42), Y(0.8)],
    [X(0.46), base],
  ]
  out.push(
    occlude(pahia),
    ...toneFill(pahia, 'T2', { gap: 3.0 }),
    stroke('line', pahia.slice(1, -1)),
  )
  // Otemanu: steep plug, left peak higher than the right, a notch between them.
  const cx = X(0.5)
  const half = w * 0.19
  const R = (dx: number, v: number): Pt => [cx + (dx / 33) * half, Y(v)]
  const plug: Pt[] = [
    R(-40, 0.92),
    R(-34, 0.78),
    R(-31, 0.58),
    R(-30, 0.38),
    R(-28, 0.2),
    R(-23, 0.08),
    R(-16, 0.02),
    R(-10, 0.0),
    R(-6, 0.05),
    R(-3, 0.14),
    R(0, 0.09),
    R(4, 0.03),
    R(12, 0.04),
    R(20, 0.12),
    R(26, 0.28),
    R(30, 0.5),
    R(33, 0.7),
    R(37, 0.86),
    R(42, 0.92),
  ]
  const ridge = plug.slice(0, -1)
  out.push(
    ...rockMass([...plug, R(42, 1), R(-40, 1)], rand, {
      ridge,
      shade: 0.6,
      slant: 0.1,
      fracture: 4.2,
      angle: -62,
      cracks: 0,
    }),
  )
  // Forest at the foot of both: crowns, lit, over a ragged band.
  out.push(...canopyNodes(X(0.0), X(0.36), base, h * 0.2, rand, { crowns: 3, thr: 0.25 }))
  out.push(...canopyNodes(X(0.34), X(0.66), base, h * 0.14, rand, { crowns: 3, thr: 0.25 }))
  out.push(...canopyNodes(X(0.62), X(0.8), base, h * 0.12, rand, { crowns: 2, thr: 0.25 }))
  return out
}
