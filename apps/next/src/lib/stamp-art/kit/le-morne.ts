// Le Morne Brabant: a compact basalt monolith with a flat, slightly domed crest and near-vertical
// faces, skirts of wooded talus, and reef surf in the lagoon in front. Lit from the left.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num, xAtY } from './util'

export const leMorne: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const P = (fx: number, fy: number): Pt => [x + w * fx, y + h * (0.06 + 0.94 * fy)]
  const out: SvgNode[] = []
  const leftEdge: Pt[] = [P(0.27, 0.05), P(0.245, 0.3), P(0.21, 0.55), P(0.13, 0.78), P(0.03, 1)]
  const crest: Pt[] = [P(0.27, 0.05), P(0.31, 0.005), P(0.44, 0), P(0.57, 0.03), P(0.63, 0.1)]
  const rightEdge: Pt[] = [
    P(0.63, 0.1),
    P(0.655, 0.36),
    P(0.7, 0.58),
    P(0.79, 0.78),
    P(0.93, 0.93),
    P(1, 1),
  ]
  const ridge: Pt[] = [
    P(0.55, 0.04),
    P(0.5, 0.3),
    P(0.49, 0.56),
    P(0.54, 0.78),
    P(0.62, 0.95),
    P(0.64, 1),
  ]
  const foot = ridge[ridge.length - 1]
  const outline: Pt[] = [...leftEdge.slice().reverse(), ...crest.slice(1), ...rightEdge.slice(1)]
  const poly: Pt[] = [
    ...leftEdge,
    [x + w * 0.04, base],
    [x + w, base],
    ...rightEdge.slice().reverse(),
    ...crest.slice(0, -1).reverse(),
  ]
  out.push(occlude(poly, { halo: 2 }))
  // Shaded right face: dense verticals.
  const rightFace: Pt[] = [
    ridge[0],
    ...crest.slice(3),
    ...rightEdge.slice(1),
    [x + w, base],
    foot,
    ...ridge.slice(0, -1).reverse(),
  ]
  out.push(...toneFill(rightFace, 'T4', { angle: 84, gap: 2.2, weight: 'hair', inset: 0.2 }))
  // Lit left face: gullies; wooded talus below in diagonals.
  for (let k = 0; k < 7; k++) {
    const ly0 = y + h * (0.1 + rand() * 0.3)
    const ly1 = ly0 + h * (0.25 + rand() * 0.3)
    const gx = (yy: number): number =>
      xAtY(leftEdge, yy) + (xAtY(ridge, yy) - xAtY(leftEdge, yy)) * (0.1 + k * 0.12)
    out.push(
      stroke('fine', [
        [gx(ly0), ly0],
        [gx((ly0 + ly1) / 2) + (rand() - 0.5) * 1.2, (ly0 + ly1) / 2],
        [gx(ly1), ly1],
      ]),
    )
  }
  const talus: Pt[] = [
    P(0.17, 0.8),
    P(0.22, 0.7),
    P(0.44, 0.66),
    ridge[3],
    ridge[4],
    ridge[5],
    [x + w * 0.04, base],
  ]
  out.push(...toneFill(talus, 'T2', { angle: 52, gap: 2.8, weight: 'fine', inset: 0.4 }))
  out.push(stroke('line', outline), stroke('bold', crest))
  out.push(stroke('hair', ridge))
  // Reef surf in the lagoon: scalloped white breaks.
  for (const [dy, a, b] of [
    [10, 0.0, 0.4],
    [14, 0.5, 1.0],
    [18, 0.1, 0.55],
  ] as const) {
    for (let sx = x + w * a; sx < x + w * b - 8; sx += 9 + rand() * 4)
      out.push(
        stroke('hair', quad([sx, base + dy], [sx + 4, base + dy - 3.2], [sx + 8, base + dy], 6)),
      )
  }
  return out
}
