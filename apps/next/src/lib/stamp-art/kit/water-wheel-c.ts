// Isle of Man: the Laxey Wheel. A tall spoked iron wheel with a double rim and bucket ticks,
// standing on a stone pier, with a masonry stair tower beside it and a walkway running from the
// tower top to the rim. The box bottom is the ground; the wheel fills the right two thirds.
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
import { type KitModule, num } from './util'

const ring = (cx: number, cy: number, r: number, n = 40): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })

export const waterWheelC: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const base = y + h
  const r = Math.min(h / 2, w * 0.3)
  const cx = x + w * num(p, 'axis', 0.62)
  const cy = base - r - 1
  // stair tower on the left, rising to about the height of the rim top
  const tw = w * 0.17
  const tx = cx - r - tw - w * 0.1
  const tTop = cy - r * 0.92
  out.push(...body(rectPts(tx, tTop, tw, base - tTop), 'line'))
  out.push(
    ...toneFill(rectPts(tx + tw * 0.7, tTop + 1, tw * 0.3, base - tTop - 1), 'T4', { inset: 0.3 }),
  )
  for (let k = 0; k < 3; k++) {
    const sy = tTop + 4 + k * ((base - tTop - 10) / 3)
    out.push(
      stroke('hair', [
        [tx + 1, sy + 6],
        [tx + tw * 0.68, sy],
      ]),
    )
  }
  out.push(...body(rectPts(tx - 1.5, tTop - 3, tw + 3, 3), 'hair'))
  out.push(fill(rectPts(tx + tw * 0.3, base - 8, 3, 8)))
  // walkway from the tower top to the rim top
  const wy = tTop - 3
  const wx1 = cx - r * 0.1
  const wy1 = cy - r - 1.5
  out.push(
    stroke('line', [
      [tx + tw + 1.5, wy],
      [wx1, wy1],
    ]),
  )
  out.push(
    stroke('hair', [
      [tx + tw + 1.5, wy + 2.4],
      [wx1, wy1 + 2.4],
    ]),
  )
  // stone pier under the axle
  const disc = ring(cx, cy, r)
  out.push(occlude(disc, { halo: 2 }))
  const pierW = r * 0.34
  const pier: Pt[] = [
    [cx - pierW * 0.55, cy - 2],
    [cx + pierW * 0.55, cy - 2],
    [cx + pierW * 0.9, base],
    [cx - pierW * 0.9, base],
  ]
  out.push(...body(pier, 'line'))
  out.push(...toneFill(pier, 'T4', { inset: 0.4 }))
  // rim, bucket ticks, spokes, hub
  out.push(stroke('line', disc, true), stroke('hair', ring(cx, cy, r - 4.2), true))
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    out.push(
      stroke('hair', [
        [cx + (r - 4.2) * Math.cos(a), cy + (r - 4.2) * Math.sin(a)],
        [cx + (r - 0.2) * Math.cos(a), cy + (r - 0.2) * Math.sin(a)],
      ]),
    )
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2
    out.push(
      stroke('hair', [
        [cx, cy],
        [cx + (r - 4.2) * Math.cos(a), cy + (r - 4.2) * Math.sin(a)],
      ]),
    )
  }
  out.push(fill(ring(cx, cy, 3.6, 14)))
  // low retaining wall at the foot
  out.push(...body(rectPts(tx - 4, base - 4, cx + r + 6 - (tx - 4), 4), 'hair'))
  out.push(hline('bold', tx - 4, cx + r + 6, base))
  void quad
  return out
}
