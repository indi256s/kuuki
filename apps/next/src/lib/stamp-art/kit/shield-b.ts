// Piton de la Fournaise: a broad low shield. A steep caldera wall stands on the left, a dark
// lava plain runs into a truncated summit cone with a stepped crater, and a lava flow winds
// down the right flank to the sea, ending in a steam cloud. The box bottom is the shoreline.
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule } from './util'

export const shieldB: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const P = (fx: number, fy: number): Pt => [x + w * fx, y + h * (0.12 + (fy - 0.3) * (0.88 / 0.7))]
  const out: SvgNode[] = []
  const wall: Pt[] = [
    P(0, 0.42),
    P(0.05, 0.37),
    P(0.12, 0.38),
    P(0.18, 0.45),
    P(0.22, 0.58),
    P(0.27, 0.66),
  ]
  const coneL = quad(P(0.27, 0.66), P(0.49, 0.6), P(0.535, 0.3), 14)
  const crater: Pt[] = [P(0.535, 0.3), P(0.55, 0.36), P(0.6, 0.36), P(0.64, 0.3)]
  const right = quad(P(0.64, 0.3), P(0.72, 0.8), P(1, 0.93), 16)
  const sil: Pt[] = [
    ...wall,
    ...coneL.slice(1),
    ...crater.slice(1),
    ...right.slice(1),
    P(1, 1),
    P(0, 1),
  ]
  out.push(occlude(sil, { halo: 2 }))
  // Right flank, shaded: dense strokes along the fall line.
  const shaded: Pt[] = [P(0.58, 0.36), P(0.6, 0.36), P(0.64, 0.3), ...right, P(1, 1), P(0.6, 1)]
  out.push(...toneFill(shaded, 'T4', { angle: 58, gap: 2.7, weight: 'hair', inset: 0.2 }))
  // Left flank of the cone, lit: sparse fall-line strokes, closing towards the foot.
  const lit: Pt[] = [...coneL, P(0.55, 0.36), P(0.58, 0.36), P(0.6, 1), P(0.27, 1)]
  out.push(
    ...toneFill(lit, 'T2', {
      angle: -64,
      gap: [4.2, 3.2],
      weight: 'fine',
      inset: 0.4,
      ramp: [y + h * 0.3, base],
    }),
  )
  // Lava plain under the wall: fine diagonals; wall: dark verticals.
  const plain: Pt[] = [P(0.05, 0.7), P(0.27, 0.66), P(0.27, 1), P(0, 1), P(0, 0.7)]
  out.push(...toneFill(plain, 'T2', { angle: -58, gap: 3.2, weight: 'fine', inset: 0.3 }))
  out.push(
    ...toneFill([...wall, P(0.27, 0.7), P(0, 0.72)], 'T4', {
      angle: 88,
      gap: 2.2,
      weight: 'hair',
      inset: 0.2,
    }),
  )
  // Lava flow ribbon down the right flank.
  const path: Pt[] = [
    P(0.65, 0.34),
    P(0.69, 0.5),
    P(0.68, 0.62),
    P(0.75, 0.74),
    P(0.74, 0.84),
    P(0.81, 0.92),
    P(0.8, 0.995),
  ]
  const edge = (side: number): Pt[] =>
    path.map(([px, py], i) => [px + side * (1.6 + (i / path.length) * 2.4), py])
  const rib: Pt[] = [...edge(-1), ...edge(1).reverse()]
  out.push(occlude(rib, { halo: 1.6 }), stroke('hair', edge(-1)), stroke('hair', edge(1)))
  // Steam cloud where the flow meets the sea.
  const sx = x + w * 0.8
  const puffs = [
    [-6, -4, 6],
    [3, -8, 7.5],
    [10, -3, 5.5],
    [-1, -13, 5],
  ] as const
  for (const [dx, dy, r] of puffs)
    out.push(
      occlude(
        Array.from({ length: 14 }, (_, i): Pt => [
          sx + dx + Math.cos((i / 14) * 6.283) * r,
          base + dy + Math.sin((i / 14) * 6.283) * r * 0.85,
        ]),
        { halo: 1.2 },
      ),
    )
  for (const [dx, dy, r] of puffs)
    out.push(
      stroke(
        'hair',
        Array.from({ length: 12 }, (_, i): Pt => [
          sx + dx + Math.cos(Math.PI * (1 + i / 11)) * r,
          base + dy + Math.sin(Math.PI * (1 + i / 11)) * r * 0.85,
        ]),
      ),
    )
  // Outline: wall, cone, nested crater step, right flank.
  out.push(stroke('line', [...wall, ...coneL.slice(1)]))
  out.push(stroke('line', [...crater.slice(0), ...right.slice(1)]), stroke('bold', crater))
  out.push(stroke('hair', [P(0.57, 0.36), P(0.585, 0.39), P(0.605, 0.36)]))
  return out
}
