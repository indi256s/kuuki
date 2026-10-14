// Shibam, Hadramawt: a dense cluster of tall mud-brick tower houses, flat-topped, packed shoulder
// to shoulder. A back row stands in dark vertical hatching so the lit front row reads against it;
// each front tower has a whitewashed top band, rows of small dark windows and a shaded right
// third. The box bottom is the foot of the towers; they stand on a dark rock plinth.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

type Tower = [number, number, number]

const BACK: Tower[] = [
  [0.02, 0.09, 0.5],
  [0.1, 0.1, 0.74],
  [0.2, 0.09, 0.6],
  [0.29, 0.1, 0.92],
  [0.4, 0.09, 0.7],
  [0.5, 0.1, 0.86],
  [0.6, 0.09, 0.64],
  [0.7, 0.1, 0.8],
  [0.8, 0.09, 0.6],
  [0.89, 0.09, 0.46],
]
const FRONT: Tower[] = [
  [0.0, 0.12, 0.4],
  [0.1, 0.11, 0.6],
  [0.2, 0.12, 0.8],
  [0.32, 0.1, 0.52],
  [0.41, 0.13, 1.0],
  [0.53, 0.1, 0.66],
  [0.62, 0.12, 0.86],
  [0.73, 0.1, 0.5],
  [0.82, 0.11, 0.7],
  [0.92, 0.08, 0.42],
]

function tower(x: number, base: number, w: number, h: number, lit: boolean, rand: () => number) {
  const top = base - h
  const inset = w * 0.07
  const poly: Pt[] = [
    [x, base],
    [x + inset, top],
    [x + w - inset, top],
    [x + w, base],
  ]
  const out: SvgNode[] = body(poly, 'line')
  if (!lit) {
    out.push(...toneFill(poly, 'T4', { gap: 4, weight: 'fine', inset: 0.5 }))
    return out
  }
  // Mud-brick lower storeys in fine vertical hatching, whitewashed upper storeys left bare.
  const split = top + h * 0.64
  const at = (yy: number, side: -1 | 1) =>
    side < 0 ? x + (inset * (base - yy)) / h : x + w - (inset * (base - yy)) / h
  const lower: Pt[] = [
    [x, base],
    [at(split, -1), split],
    [at(split, 1), split],
    [x + w, base],
  ]
  out.push(...toneFill(lower, 'T4', { gap: 3.1, weight: 'fine', inset: 0.5 }))
  out.push(hline('bold', at(split, -1) - 0.6, at(split, 1) + 0.6, split))
  // Notched parapet.
  for (let tx = x + inset + 1; tx < x + w - inset - 2.4; tx += 4) {
    out.push(
      stroke('hair', [
        [tx, top],
        [tx, top - 2],
        [tx + 2, top - 2],
        [tx + 2, top],
      ]),
    )
  }
  // A few window rows in the white storeys, hand-cut and uneven.
  const rows = Math.max(1, Math.round((split - top - 4) / 10))
  for (let r = 0; r < rows; r++) {
    const yy = top + 4 + r * ((split - top - 6) / rows)
    const cols = w > 13 ? 2 : 1
    for (let c = 0; c < cols; c++) {
      const xx = x + w * (0.28 + 0.34 * c) + (rand() - 0.5) * 1.6
      out.push(fill(rectPts(xx, yy + (rand() - 0.5), 1.8, 3.2)))
    }
  }
  // Shaded right quarter of the white storeys.
  out.push(
    ...toneFill(
      [
        [x + w * 0.74, top + 1],
        [at(top, 1), top + 1],
        [at(split, 1), split],
        [x + w * 0.76, split],
      ],
      'T4',
      { gap: 2.6, weight: 'fine', inset: 0.4 },
    ),
  )
  return out
}

export const shibam: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const plinth = num(p, 'plinth', 5)
  const lift = num(p, 'lift', 0)
  const base = y + h - plinth
  const tallest = base - y
  // The rock spur rises toward both ends, so the cluster fits a narrow window.
  const baseAt = (t: number) => base - lift * Math.pow(Math.abs(2 * t - 1), 2)
  const out: SvgNode[] = []
  for (const [tx, tw, th] of BACK) {
    const b = baseAt(tx + tw / 2)
    out.push(...tower(x + w * tx, b - 2, w * tw, (tallest - lift * 0.4) * th * 0.92, false, rand))
  }
  for (const [tx, tw, th] of FRONT) {
    const b = baseAt(tx + tw / 2)
    out.push(...tower(x + w * tx, b, w * tw, (tallest - lift * 0.3) * th, true, rand))
  }
  // Rock mound under the cluster: dark, hatched, with a bold top line.
  const edge: Pt[] = []
  for (let t = 0; t <= 1.001; t += 0.05)
    edge.push([x + w * t, baseAt(t) + 1 + Math.sin(t * 19) * 0.8])
  const rock: Pt[] = [[x, y + h], ...edge, [x + w, y + h]]
  out.push(occlude(rock), ...toneFill(rock, 'T4', { gap: 3, weight: 'hair', inset: 0.4 }))
  out.push(stroke('bold', edge))
  return out
}
