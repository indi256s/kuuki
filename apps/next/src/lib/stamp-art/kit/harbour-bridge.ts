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

export const harbourBridge: KitModule = ([x, y, w, h], p) => {
  const water = y + h
  const deckY = y + h * num(p, 'deck', 0.6)
  const pylonW = w * 0.075
  const pylonTop = y + h * num(p, 'pylon', 0.33)
  const x0 = x + w * 0.1
  const x1 = x + w * 0.9
  const span = x1 - x0
  const out: SvgNode[] = []
  const t = (i: number, n: number) => i / n
  const topAt = (u: number) => {
    const k = 1 - Math.pow(2 * u - 1, 2)
    return y + h * 0.5 - k * h * 0.5
  }
  const botAt = (u: number) => {
    const k = 1 - Math.pow(2 * u - 1, 2)
    return water - h * 0.04 - k * (water - h * 0.04 - (y + h * 0.15))
  }
  const N = 64
  const topPts: Pt[] = []
  const botPts: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const u = t(i, N)
    topPts.push([x0 + u * span, topAt(u)])
    botPts.push([x0 + u * span, botAt(u)])
  }

  for (const [a, b] of [
    [x, x0],
    [x1, x + w],
  ] as const) {
    out.push(...body(rectPts(Math.min(a, b), deckY - 1, Math.abs(b - a), 5), 'hair'))
    const lo = Math.min(a, b)
    const len = Math.abs(b - a)
    for (const f of [0.28, 0.62])
      out.push(...body(rectPts(lo + len * f, deckY + 4, 3, water - deckY - 4), 'hair'))
  }

  const arch: Pt[] = [...topPts, ...botPts.slice().reverse()]
  out.push(occlude(arch, { halo: 1.5 }))
  const lattice: SvgNode[] = []
  const panels = 20
  for (let i = 0; i < panels; i++) {
    const u0 = i / panels
    const u1 = (i + 1) / panels
    const a: Pt = [x0 + u0 * span, i % 2 === 0 ? topAt(u0) : botAt(u0)]
    const b: Pt = [x0 + u1 * span, i % 2 === 0 ? botAt(u1) : topAt(u1)]
    lattice.push(stroke('fine', [a, b]))
  }
  out.push(...lattice)
  out.push(stroke('line', topPts), stroke('line', botPts))
  out.push(stroke('line', [topPts[0], botPts[0]]), stroke('line', [topPts[N], botPts[N]]))

  out.push(
    stroke('bold', [
      [x, deckY],
      [x + w, deckY],
    ]),
  )
  for (let i = 4; i < N - 3; i += 4) {
    const [hx, hy] = botPts[i]
    if (hy < deckY - 4) out.push(vline('fine', hx, hy, deckY))
  }

  for (const px of [x0, x1]) {
    const bx = px - pylonW / 2
    const poly: Pt[] = [
      [bx - 1.6, water],
      [bx + 0.6, pylonTop + 4],
      [bx + pylonW - 0.6, pylonTop + 4],
      [bx + pylonW + 1.6, water],
    ]
    out.push(...body(poly, 'line'))
    const shade: Pt[] = [
      [px + 0.3, pylonTop + 5],
      [bx + pylonW - 0.6, pylonTop + 5],
      [bx + pylonW + 1.2, water - 1],
      [px + 0.3, water - 1],
    ]
    out.push(...toneFill(shade, 'T4', { inset: 0.5 }))
    for (let c = pylonTop + 14; c < water - 6; c += 10) out.push(hline('fine', bx + 1.5, px, c))
    const crown = rectPts(bx - 2, pylonTop, pylonW + 4, 4.4)
    out.push(...body(crown, 'line'))
    for (let m = bx - 1; m < bx + pylonW + 2; m += 3.2)
      out.push(fill(rectPts(m, pylonTop - 2.2, 1.8, 2.2)))
  }
  out.push(
    stroke('bold', [
      [x, water],
      [x + w, water],
    ]),
  )
  return out
}
