// Mont Choungui, Mayotte: a rounded forested peak with a lower shoulder on the left, spurs running
// down its flanks, a fringe of shore palms and the reef edge breaking in the lagoon in front.
// Neutral nature only. The box bottom is the shoreline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'
import { palm } from './palm'

export const choungui: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 13)))
  const base = y + h
  const P = (fx: number, fy: number): Pt => [x + w * fx, y + h * fy]
  const out: SvgNode[] = []
  // Left shoulder then the main dome, steeper on the right.
  const shoulder = quad(P(0.02, 0.98), P(0.14, 0.52), P(0.3, 0.5), 12)
  const saddle = quad(P(0.3, 0.5), P(0.38, 0.5), P(0.43, 0.34), 8)
  const dome =
    p.horn === true
      ? quad(P(0.43, 0.34), P(0.55, 0.2), P(0.64, 0), 12)
      : quad(P(0.43, 0.34), P(0.55, 0.0), P(0.7, 0.06), 14)
  const right = quad(p.horn === true ? P(0.64, 0) : P(0.7, 0.06), P(0.84, 0.22), P(0.9, 0.62), 12)
  const toe = quad(P(0.9, 0.62), P(0.93, 0.92), P(0.99, 0.98), 8)
  const outline: Pt[] = [
    ...shoulder,
    ...saddle.slice(1),
    ...dome.slice(1),
    ...right.slice(1),
    ...toe.slice(1),
  ]
  const body: Pt[] = [...outline, P(0.99, 1), P(0.02, 1)]
  out.push(occlude(body, { halo: 2 }))
  // Shaded right flank: dense strokes down the fall line. Lit left: sparse, closing towards the foot.
  const ridgeX = P(0.62, 0)[0]
  const shade: Pt[] = [
    P(0.6, 0.02),
    ...dome.filter((q) => q[0] > ridgeX),
    ...right.slice(1),
    ...toe.slice(1),
    P(0.99, 1),
    P(0.66, 1),
    P(0.62, 0.55),
  ]
  out.push(...toneFill(shade, 'T4', { angle: 66, gap: 3.1, weight: 'hair', inset: 0.2 }))
  const lit: Pt[] = [
    ...shoulder,
    ...saddle.slice(1),
    ...dome.slice(1).filter((q) => q[0] <= ridgeX),
    P(0.6, 0.02),
    P(0.62, 0.55),
    P(0.66, 1),
    P(0.02, 1),
  ]
  out.push(
    ...toneFill(lit, 'T2', {
      angle: -62,
      gap: p.horn === true ? [5.5, 4.2] : [4, 3],
      weight: 'fine',
      inset: 0.5,
      ramp: [y, base],
    }),
  )
  // Spurs: gullies running down the lit flank.
  for (const [fx0, fy0, fx1, fy1] of [
    [0.5, 0.12, 0.42, 0.7],
    [0.55, 0.1, 0.52, 0.8],
    [0.36, 0.55, 0.3, 0.9],
    [0.25, 0.58, 0.2, 0.9],
  ] as const)
    out.push(
      stroke(
        'hair',
        quad(P(fx0, fy0), P(fx0 + (fx1 - fx0) * 0.4 - 0.03, (fy0 + fy1) / 2), P(fx1, fy1), 8),
      ),
    )
  out.push(stroke('line', outline))
  // Shore palms, small, on the lit left foot.
  for (const [fx, s] of [
    [0.07, 20],
    [0.16, 25],
    [0.77, 18],
    [0.87, 14],
  ] as const)
    out.push(
      ...palm([x + w * fx - 8, base - s - 0.5, 16, s], {
        lean: rand() * 0.5 - 0.25,
        seed: Math.round(rand() * 30),
        frond: 0.58,
        fronds: 6,
      }),
    )
  out.push(
    stroke('bold', [
      [x + w * 0.02, base],
      [x + w * 0.99, base],
    ]),
  )
  // Reef edge: broken surf arcs across the lagoon.
  for (let sx = x + 14; sx < x + w - 16; sx += 10 + rand() * 6)
    out.push(stroke('hair', quad([sx, base + 11], [sx + 4.5, base + 7.6], [sx + 9, base + 11], 6)))
  return out
}
