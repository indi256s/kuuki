// Lane C bridge family (lane A's bridge module is not merged yet). `adolphe`: a wide two-tier
// stone arch over a valley with a row of small arches under the deck (Luxembourg). `stari`: one
// steep humpbacked arch with a stone tower at each end (Mostar).
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
import { type KitModule, num, str } from './util'
import { archPts, lerpLine } from './windows'

const arcPts = (cx: number, base: number, rx: number, ry: number, n = 28): Pt[] =>
  Array.from({ length: n + 1 }, (_, i): Pt => {
    const a = Math.PI - (i / n) * Math.PI
    return [cx + rx * Math.cos(a), base - ry * Math.sin(a)]
  })

export const bridgeC: KitModule = ([x, y, w, h], p) => {
  const kind = str(p, 'kind', ['adolphe', 'stari'] as const, 'adolphe')
  const out: SvgNode[] = []
  const cx = x + w / 2
  const base = y + h
  if (kind === 'adolphe') {
    const deckY = y + h * 0.08
    const deckH = h * 0.1
    const rx = w * 0.4
    const ry = h * 0.7
    const thick = h * 0.1
    const outer = arcPts(cx, base, rx + thick * 0.4, ry + thick)
    const inner = arcPts(cx, base, rx - thick * 0.6, ry)
    const rxIn = rx - thick * 0.6
    const solid: Pt[] = [
      [x, deckY],
      [x + w, deckY],
      [x + w, base],
      [cx + rxIn, base],
      ...inner.slice().reverse(),
      [cx - rxIn, base],
      [x, base],
    ]
    out.push(...body(solid, 'line'))
    // wall above the arch: small arches under the deck
    const n = Math.max(5, Math.round(num(p, 'arches', 9)))
    const pitch = (w * 0.9) / n
    const sx = x + w * 0.05
    for (let i = 0; i < n; i++) {
      const ax = sx + i * pitch + pitch * 0.18
      const aw = pitch * 0.64
      const eY = lerpLine(outer, ax + aw / 2)
      const ah = Math.min(base - (deckY + deckH) - 1, eY - 2.5 - (deckY + deckH))
      if (ah > 3.4) out.push(fill(archPts(ax, eY - 2 - ah, aw, ah)))
    }
    // the great arch: dark ring with a lit soffit gap beneath
    const ring: Pt[] = [...outer, ...inner.slice().reverse()]
    out.push(occlude(ring), stroke('line', outer), stroke('line', inner))
    const voussoirs = 26
    for (let i = 1; i < voussoirs; i++) {
      const t = i / voussoirs
      out.push(
        stroke('hair', [
          outer[Math.round(t * (outer.length - 1))],
          inner[Math.round(t * (inner.length - 1))],
        ]),
      )
    }
    out.push(hline('bold', x, x + w, deckY), hline('line', x, x + w, deckY + deckH))
    for (const lx of [x + w * 0.08, x + w * 0.5, x + w * 0.92])
      out.push(vline('hair', lx, deckY - 6, deckY), fill(rectPts(lx - 1, deckY - 8, 2, 2)))
  } else {
    const rx = w * 0.3
    const ry = h * 0.52
    const archBase = base - h * 0.06
    const top = arcPts(cx, archBase, rx + 3, ry + 3)
    const inner = arcPts(cx, archBase, rx - 1, ry - 1)
    const bank = base - h * 0.06
    // abutments and towers
    for (const side of [-1, 1]) {
      const ax = side < 0 ? x : x + w - w * 0.2
      out.push(...body(rectPts(ax, bank - h * 0.18, w * 0.2, h * 0.24), 'line'))
      const tw = w * 0.1
      const tx = side < 0 ? x + w * 0.04 : x + w - w * 0.2 + w * 0.06
      out.push(...body(rectPts(tx, bank - h * 0.52, tw, h * 0.36), 'line'))
      out.push(
        ...toneFill(rectPts(tx + tw * 0.55, bank - h * 0.5, tw * 0.45, h * 0.34), 'T4', {
          inset: 0.3,
        }),
      )
      const cap: Pt[] = [
        [tx - 1.5, bank - h * 0.52],
        [tx + tw / 2, bank - h * 0.52 - tw * 1.1],
        [tx + tw + 1.5, bank - h * 0.52],
      ]
      out.push(occlude(cap), fill(cap))
      out.push(fill(rectPts(tx + tw / 2 - 1, bank - h * 0.4, 2, 5)))
    }
    const ring: Pt[] = [...top, ...inner.slice().reverse()]
    out.push(
      occlude(ring),
      ...toneFill(ring, 'T4', { gap: 1.9, weight: 'hair' }),
      stroke('line', top),
      stroke('line', inner),
    )
    const tickN = 11
    for (let i = 1; i < tickN; i++) {
      const a = Math.PI - (i / tickN) * Math.PI
      const o: Pt = [cx + (rx + 3) * Math.cos(a), archBase - (ry + 3) * Math.sin(a)]
      const q: Pt = [cx + (rx + 7) * Math.cos(a), archBase - (ry + 7) * Math.sin(a)]
      out.push(stroke('hair', [o, q]))
    }
    out.push(stroke('bold', arcPts(cx, archBase, rx + 7, ry + 7).slice(2, -2)))
    out.push(hline('bold', x, x + w, base))
  }
  return out
}
