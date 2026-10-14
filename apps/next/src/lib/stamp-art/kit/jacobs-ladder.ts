// Jacob's Ladder (Saint Helena): a straight, very steep flight of rungs climbing a dark hillside
// from a few town roofs at the foot to a fort wall on the crest. The box bottom is the ground.
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

export const jacobsLadder: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 31)))
  const base = y + h
  const at = (fx: number, fy: number): Pt => [x + w * fx, y + h * fy]
  const edge: Pt[] = [
    at(0.16, 1),
    at(0.26, 0.7),
    at(0.4, 0.46),
    at(0.55, 0.27),
    at(0.7, 0.14),
    at(0.82, 0.1),
    at(1, 0.1),
  ]
  const rough: Pt[] = edge.map(([px, py], i) =>
    i === 0 || i === edge.length - 1
      ? [px, py]
      : [px + (rand() - 0.5) * 1.4, py + (rand() - 0.5) * 1.4],
  )
  const hill: Pt[] = [...rough, [x + w, base], [x + w * 0.16, base]]
  const out: SvgNode[] = [occlude(hill)]
  // Hillside: dense hatch leaning with the slope, the crest left lit.
  out.push(...toneFill(hill, 'T4', { angle: 72, gap: [3, 3], weight: 'fine' }))
  out.push(stroke('line', rough))
  // Stair: a lit band along a straight line from the foot to the crest, rungs across it.
  const A: Pt = at(0.27, 0.99)
  const B: Pt = at(0.7, 0.2)
  const dx = B[0] - A[0],
    dy = B[1] - A[1]
  const len = Math.hypot(dx, dy)
  const nx = (-dy / len) * 3.6,
    ny = (dx / len) * 3.6
  const band: Pt[] = [
    [A[0] + nx, A[1] + ny],
    [B[0] + nx, B[1] + ny],
    [B[0] - nx, B[1] - ny],
    [A[0] - nx, A[1] - ny],
  ]
  out.push(occlude(band, { halo: 1.2 }))
  out.push(stroke('line', [band[0], band[1]]), stroke('line', [band[3], band[2]]))
  for (let d = 2; d < len - 1; d += 2.3) {
    const px = A[0] + (dx * d) / len,
      py = A[1] + (dy * d) / len
    out.push(
      stroke('hair', [
        [px + nx, py + ny],
        [px - nx, py - ny],
      ]),
    )
  }
  // Fort on the crest: a wall with merlons and a square gate tower at its seaward end.
  const fx = x + w * 0.6,
    fy = y + h * 0.1
  const fw = w * 0.38
  out.push(...body(rectPts(fx, fy - 8, fw, 8), 'line'))
  for (let mx = fx + 1; mx < fx + fw - 3; mx += 5)
    out.push(...body(rectPts(mx, fy - 11, 2.8, 3), 'hair'))
  out.push(...body(rectPts(fx - 2, fy - 17, 11, 17), 'line'))
  out.push(fill(rectPts(fx + 2, fy - 12, 3, 5)))
  out.push(hline('bold', fx - 3, fx + 12, fy - 17))
  // Town roofs at the foot.
  for (const [f, bw, bh] of [
    [0.0, 16, 10],
    [0.11, 13, 14],
    [0.22, 18, 9],
  ] as const) {
    const bx = x + w * f
    out.push(...body(rectPts(bx, base - bh, bw, bh), 'line'))
    out.push(
      fill([
        [bx - 1, base - bh],
        [bx + bw / 2, base - bh - 4],
        [bx + bw + 1, base - bh],
      ]),
    )
  }
  return out
}
