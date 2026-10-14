// A polar research station: a row of low flat-roofed blocks on a shelf above a dark sea cliff,
// a lattice radio mast with guy wires on the right. The box bottom is the waterline at the cliff
// foot; the shelf sits at `shelf` of the box height.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

export const stationB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const shelf = y + h * num(p, 'shelf', 0.76)
  const out: SvgNode[] = []
  // Sea cliff: ragged top edge, dark vertical columns, broken foot.
  const top: Pt[] = []
  for (let px = x; px <= x + w + 0.01; px += 5) top.push([px, shelf + (rand() - 0.5) * 2.4])
  const cliff: Pt[] = [
    ...top,
    [x + w, base],
    ...Array.from({ length: 12 }, (_, i): Pt => [
      x + w - ((i + 1) * w) / 12,
      base - (i % 2 ? 0.5 : 2.6),
    ]).slice(0, 11),
  ]
  out.push(occlude([...top, [x + w, base], [x, base]], { halo: 1.6 }))
  out.push(...toneFill(cliff, 'T4', { angle: 84, gap: 3, weight: 'fine', inset: 0.2 }))
  out.push(stroke('bold', top))
  // Blocks on the shelf.
  const ws = [19, 24, 14, 21, 15],
    hs = [14, 21, 13, 24, 16]
  let bx = x + 4
  const blocks: number[] = []
  ws.forEach((bw, i) => {
    const by = shelf - 0.5
    const bh = hs[i]
    const pts = rectPts(bx, by - bh, bw, bh)
    out.push(occlude(pts, { halo: 1 }), stroke('line', pts, true))
    out.push(
      ...toneFill(rectPts(bx + bw * 0.78, by - bh, bw * 0.22, bh), 'T4', {
        angle: 90,
        gap: 2,
        weight: 'fine',
        inset: 0.1,
      }),
    )
    out.push(
      stroke('bold', [
        [bx - 1, by - bh],
        [bx + bw + 1, by - bh],
      ]),
    )
    for (let wx = bx + 3; wx < bx + bw * 0.7 - 2; wx += 5.5)
      out.push(fill(rectPts(wx, by - bh * 0.62, 2.6, Math.min(3.2, bh * 0.3))))
    blocks.push(bx + bw)
    bx += bw + 3
  })
  // Lattice mast with guy wires.
  const mx = x + w * num(p, 'mast', 0.86)
  const mt = y + h * 0.12
  const half = (yy: number): number => 1.4 + ((yy - mt) / (shelf - mt)) * 3.4
  out.push(
    stroke('line', [
      [mx - half(shelf), shelf],
      [mx - half(mt), mt],
    ]),
    stroke('line', [
      [mx + half(shelf), shelf],
      [mx + half(mt), mt],
    ]),
  )
  const rungs = 9
  for (let i = 0; i < rungs; i++) {
    const y0 = mt + ((shelf - mt) * i) / rungs,
      y1 = mt + ((shelf - mt) * (i + 1)) / rungs
    out.push(
      stroke(
        'fine',
        i % 2
          ? [
              [mx - half(y0), y0],
              [mx + half(y1), y1],
            ]
          : [
              [mx + half(y0), y0],
              [mx - half(y1), y1],
            ],
      ),
    )
    out.push(hline('fine', mx - half(y1), mx + half(y1), y1))
  }
  out.push(
    stroke('bold', [
      [mx, mt - 1],
      [mx, mt - 6],
    ]),
  )
  const gy = mt + (shelf - mt) * 0.62
  out.push(
    stroke('fine', [
      [mx, gy],
      [mx - 22, shelf],
    ]),
    stroke('fine', [
      [mx, mt + 4],
      [mx - 30, shelf],
    ]),
    stroke('fine', [
      [mx, gy],
      [mx + 12, shelf],
    ]),
  )
  // Foam at the cliff foot.
  for (let fx = x + 4; fx < x + w - 6; fx += 9 + rand() * 5)
    out.push(stroke('hair', quad([fx, base + 2], [fx + 3, base - 1.2], [fx + 6, base + 2], 6)))
  return out
}
