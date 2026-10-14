// Fort Christian (Charlotte Amalie): a long low fort block with a flat parapet and a row of arched
// windows, a battered bastion wing at each end, and a squat square clock tower rising from the
// middle under a solid hip roof. The box is the whole fort; its bottom is the ground.
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
  vline,
} from '../grid'
import { type KitModule, num } from './util'

const ring = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 14 }, (_, i) => [
    cx + r * Math.cos((i / 14) * Math.PI * 2),
    cy + r * Math.sin((i / 14) * Math.PI * 2),
  ])

export const fortChristian: KitModule = ([x, y, w, h], p) => {
  const ground = y + h
  const cx = x + w * num(p, 'tower', 0.46)
  const blockH = h * num(p, 'block', 0.4)
  const blockTop = ground - blockH
  const tw = w * 0.2
  const towerTop = y + h * 0.1
  const out: SvgNode[] = []

  // Wings: battered bastion walls at both ends, a step lower than the block.
  const wingTop = blockTop + h * 0.07
  const wl: Pt[] = [
    [x + 1, wingTop],
    [x + w * 0.22, wingTop],
    [x + w * 0.22, ground],
    [x - 1, ground],
  ]
  const wr: Pt[] = [
    [x + w * 0.8, wingTop],
    [x + w - 1, wingTop],
    [x + w + 1, ground],
    [x + w * 0.8, ground],
  ]
  for (const wing of [wl, wr]) {
    out.push(...body(wing, 'line'))
  }
  out.push(...toneFill(wr, 'T4', { inset: 0.5 }))
  out.push(
    stroke('bold', [
      [x, wingTop],
      [x + w * 0.22, wingTop],
    ]),
  )
  out.push(
    stroke('bold', [
      [x + w * 0.8, wingTop],
      [x + w, wingTop],
    ]),
  )
  for (let i = 0; i < 3; i++) out.push(fill(rectPts(x + 5 + i * 8, wingTop + 3.5, 2.6, 4.2)))

  // Main block with a bold parapet line and a row of arched windows; right end shaded.
  const bx0 = x + w * 0.2
  const bx1 = x + w * 0.82
  out.push(...body(rectPts(bx0, blockTop, bx1 - bx0, blockH), 'line'))
  out.push(
    ...toneFill(
      rectPts(bx1 - (bx1 - bx0) * 0.22, blockTop + 0.8, (bx1 - bx0) * 0.22 - 0.8, blockH - 0.8),
      'T4',
      { inset: 0.4 },
    ),
  )
  out.push(
    stroke('bold', [
      [bx0 - 1, blockTop],
      [bx1 + 1, blockTop],
    ]),
  )
  out.push(hline('hair', bx0, bx1, blockTop + 4.4))
  const wins = 6
  for (let i = 0; i < wins; i++) {
    const wx = bx0 + 5 + ((bx1 - bx0 - 12) * i) / (wins - 1)
    if (Math.abs(wx - cx) < tw * 0.7) continue
    out.push(fill(rectPts(wx - 1.5, blockTop + blockH * 0.38, 3, blockH * 0.34)))
  }
  out.push(
    stroke('hair', [
      [bx0, ground - 3],
      [bx1, ground - 3],
    ]),
  )

  // Tower: square shaft with a clock stage, cornice and hip roof.
  const tx0 = cx - tw / 2
  const roofH = h * 0.16
  const shaftTop = towerTop + roofH
  out.push(...body(rectPts(tx0, shaftTop, tw, blockTop - shaftTop + 1), 'line'))
  out.push(
    ...toneFill(
      rectPts(cx + tw * 0.15, shaftTop + 1, tw * 0.35 - 0.8, blockTop - shaftTop - 1),
      'T4',
      { inset: 0.4 },
    ),
  )
  out.push(
    stroke('bold', [
      [tx0 - 1.5, shaftTop + 3],
      [tx0 + tw + 1.5, shaftTop + 3],
    ]),
  )
  const clockY = shaftTop + (blockTop - shaftTop) * 0.34
  const clock = ring(cx - tw * 0.1, clockY, tw * 0.3)
  out.push(occlude(clock), stroke('hair', clock, true))
  out.push(
    stroke('hair', [
      [cx - tw * 0.1, clockY],
      [cx - tw * 0.1, clockY - tw * 0.2],
    ]),
  )
  out.push(
    stroke('hair', [
      [cx - tw * 0.1, clockY],
      [cx - tw * 0.1 + tw * 0.15, clockY],
    ]),
  )
  out.push(fill(rectPts(cx - tw * 0.22, blockTop - h * 0.1, tw * 0.24, h * 0.1)))
  out.push(
    stroke('bold', [
      [tx0 - 1.5, shaftTop + (blockTop - shaftTop) * 0.62],
      [tx0 + tw + 1.5, shaftTop + (blockTop - shaftTop) * 0.62],
    ]),
  )
  const roof: Pt[] = [
    [tx0 - 1.6, shaftTop + 3],
    [cx - 1.6, towerTop + 3],
    [cx, towerTop],
    [cx + 1.6, towerTop + 3],
    [tx0 + tw + 1.6, shaftTop + 3],
  ]
  out.push(occlude(roof), fill(roof))
  out.push(vline('hair', cx, towerTop - 4, towerTop))
  return out
}
