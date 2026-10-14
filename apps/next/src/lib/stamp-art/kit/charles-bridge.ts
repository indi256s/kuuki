// Charles Bridge (lane C): a long low stone bridge on many segmental arches with pointed
// cutwaters, a parapet, a steep Gothic gate tower at the left end and a low tower pair on the
// right bank (CZ). The box base is the waterline.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

const arc = (cx: number, base: number, rx: number, ry: number): Pt[] =>
  Array.from({ length: 13 }, (_, i): Pt => {
    const a = Math.PI - (i / 12) * Math.PI
    return [cx + rx * Math.cos(a), base - ry * Math.sin(a)]
  })

export const charlesBridge: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const base = y + h
  const deckY = y + h * num(p, 'deck', 0.55)
  const bridgeFrom = x + w * 0.22
  const bridgeTo = x + w
  const n = Math.round(num(p, 'arches', 7))
  const pitch = (bridgeTo - bridgeFrom) / n
  // deck mass
  out.push(...body(rectPts(bridgeFrom, deckY, bridgeTo - bridgeFrom, base - deckY), 'line'))
  out.push(hline('bold', bridgeFrom, bridgeTo, deckY))
  out.push(hline('hair', bridgeFrom, bridgeTo, deckY + 3))
  // parapet ticks
  for (let px = bridgeFrom + 2; px < bridgeTo - 1; px += 4)
    out.push(
      stroke('hair', [
        [px, deckY],
        [px, deckY - 2.4],
      ]),
    )
  out.push(hline('hair', bridgeFrom, bridgeTo, deckY - 2.4))
  // arches
  for (let i = 0; i < n; i++) {
    const cx = bridgeFrom + (i + 0.5) * pitch
    const rx = pitch * 0.36
    const ry = (base - deckY) * 0.62
    const top = arc(cx, base, rx, ry)
    const open: Pt[] = [...top, [cx + rx, base], [cx - rx, base]]
    out.push(occlude(open))
    out.push(...hatchPoly(open, { angle: 0, gap: 3.2, weight: 'hair' }))
    out.push(stroke('line', top))
    // cutwater: pointed pier foot on the left of each arch
    const px = bridgeFrom + i * pitch
    out.push(
      stroke('hair', [
        [px, base - (base - deckY) * 0.5],
        [px - 2.2, base],
      ]),
    )
  }
  // gate tower at the left end: shaft, gallery, steep hip roof, corner pinnacles
  const tw = w * 0.17
  const tx = x + w * 0.1
  const tTop = y + h * 0.18
  out.push(...body(rectPts(tx, tTop, tw, base - tTop), 'line'))
  out.push(
    ...hatchPoly(rectPts(tx + tw * 0.62, tTop + 1, tw * 0.38, base - tTop - 1), {
      angle: 90,
      gap: 2.2,
      weight: 'hair',
    }),
  )
  out.push(hline('bold', tx - 1.5, tx + tw + 1.5, tTop))
  out.push(fill(archPts(tx + tw * 0.28, base - 17, tw * 0.28, 17)))
  out.push(
    fill(rectPts(tx + tw * 0.25, tTop + 8, 2, 6)),
    fill(rectPts(tx + tw * 0.25, tTop + 26, 2, 6)),
  )
  const roofTop = y
  const roof: Pt[] = [
    [tx - 2, tTop],
    [tx + tw / 2 - 1, roofTop],
    [tx + tw / 2 + 1, roofTop],
    [tx + tw + 2, tTop],
  ]
  out.push(occlude(roof), fill(roof))
  for (const px of [tx - 1, tx + tw + 1]) {
    const pin: Pt[] = [
      [px - 2.4, tTop],
      [px, tTop - 9],
      [px + 2.4, tTop],
    ]
    out.push(occlude(pin), fill(pin))
  }
  // two small towers at the far end
  for (const [fx, up] of [
    [0.86, 0.3],
    [0.95, 0.22],
  ] as const) {
    const sx = x + w * fx - 5
    const sTop = deckY - h * up
    out.push(...body(rectPts(sx, sTop, 10, deckY - sTop + 1), 'line'))
    out.push(fill(rectPts(sx + 4, sTop + 5, 2, 5)))
    const cap: Pt[] = [
      [sx - 1.5, sTop],
      [sx + 5, sTop - 12],
      [sx + 11.5, sTop],
    ]
    out.push(occlude(cap), fill(cap))
  }
  return out
}
