// Boat shed, slipway and longboat at the head of a cove (Bounty Bay, lane A, `-a` until
// consolidated). Box: the shed stands on its footing at the upper left, the slipway runs from its
// door down and to the right into the water, and the longboat sits at the foot of the slip. The box
// bottom is the waterline.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule } from './util'

export const slipwayA: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const water = y + h
  const footY = y + h * 0.55
  // Slipway: a lit strip widening toward the viewer, sleepers across it.
  const s0 = x + w * 0.2
  const slip: Pt[] = [
    [s0, footY],
    [s0 + 9, footY],
    [x + w * 0.92, water - 5],
    [x + w * 0.58, water - 5],
  ]
  out.push(...body(slip, 'line'))
  for (let t = 0.14; t < 0.95; t += 0.14) {
    const ax = slip[0][0] + (slip[3][0] - slip[0][0]) * t
    const ay = slip[0][1] + (slip[3][1] - slip[0][1]) * t
    const bx = slip[1][0] + (slip[2][0] - slip[1][0]) * t
    const by = slip[1][1] + (slip[2][1] - slip[1][1]) * t
    out.push(
      stroke('hair', [
        [ax, ay],
        [bx, by],
      ]),
    )
  }
  // Shed: gabled box with a dark door; roof in T4.
  const sw = w * 0.36
  const sh = h * 0.3
  const sx = x
  const sy = footY - sh
  out.push(...body(rectPts(sx, sy, sw, sh), 'line'))
  const roof: Pt[] = [
    [sx - 3, sy],
    [sx + sw / 2, sy - sh * 0.55],
    [sx + sw + 3, sy],
  ]
  out.push(...body(roof, 'line'))
  out.push(...toneFill(roof, 'T4', { inset: 0.5 }))
  out.push(fill(rectPts(sx + sw * 0.55, sy + sh * 0.3, sw * 0.3, sh * 0.7)))
  out.push(
    stroke('bold', [
      [sx - 5, footY],
      [sx + sw + 6, footY],
    ]),
  )
  // Longboat: a long open hull with raised ends, thwarts and a plank line.
  const bx0 = x + w * 0.42
  const bx1 = x + w * 0.98
  const by = water - 3
  const sheer = quad([bx0, by - 11], [(bx0 + bx1) / 2, by - 5], [bx1, by - 11], 18)
  const keel = quad([bx1 - 3, by - 3.5], [(bx0 + bx1) / 2, by + 3], [bx0 + 3, by - 3.5], 18)
  const hull: Pt[] = [...sheer, ...keel]
  out.push(occlude(hull, { halo: 1.4 }))
  out.push(...toneFill(hull, 'T4', { gap: 2.6, inset: 0.3 }))
  out.push(stroke('line', hull, true), stroke('bold', sheer))
  for (let t = 0.2; t < 0.85; t += 0.2) {
    const tx = bx0 + (bx1 - bx0) * t
    out.push(
      stroke('hair', [
        [tx, by - 8],
        [tx, by - 14],
      ]),
    )
  }
  out.push(hline('hair', bx0 + 6, bx1 - 6, by - 14.5))
  out.push(hline('fine', x + w * 0.5, x + w * 0.9, water + 3.2))
  return out
}
