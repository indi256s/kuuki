// Steel through-arch bridge over water (Bridge of the Americas). The box spans the whole bridge
// with its piers standing on the box bottom. The deck humps up toward the middle, a tied arch
// rises over the centre span with fine hangers, approach girders are T4 bands on slim piers.
import { type Pt, type SvgNode, fill, occlude, quad, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const bridge: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const deckEnd = y + h * num(p, 'deckEnd', 0.74)
  const deckMid = y + h * num(p, 'deckMid', 0.6)
  const girder = num(p, 'girder', 3.2)
  const n = 24
  const deck = quad([x, deckEnd], [cx, 2 * deckMid - deckEnd], [x + w, deckEnd], n)
  const out: SvgNode[] = []
  const deckAt = (px: number) => {
    const t = (px - x) / w
    return deck[Math.round(t * n)][1]
  }
  // Piers first, so the girder sits over them.
  const piers = [0.07, 0.17, 0.27, 0.73, 0.83, 0.93]
  for (const f of piers) {
    const px = x + w * f
    const main = f === 0.27 || f === 0.73
    const half = main ? 3.2 : 1.8
    const top = deckAt(px) + girder
    const pier: Pt[] = [
      [px - half * 0.8, top],
      [px + half * 0.8, top],
      [px + half, base],
      [px - half, base],
    ]
    out.push(occlude(pier), fill(pier))
  }
  // Girder band under the deck.
  const under: Pt[] = [...deck, ...[...deck].reverse().map(([px, py]): Pt => [px, py + girder])]
  out.push(occlude(under))
  out.push(...toneFill(under, 'T4', { gap: 3, weight: 'fine', inset: 0.3 }))
  out.push(stroke('bold', deck))
  out.push(
    stroke(
      'hair',
      deck.map(([px, py]): Pt => [px, py + girder]),
    ),
  )
  // Arch over the middle span, from the main piers.
  const xa = x + w * 0.27
  const xb = x + w * 0.73
  const ya = deckAt(xa)
  const yb = deckAt(xb)
  const rib = (lift: number) =>
    quad([xa, ya - lift], [cx, 2 * (y + lift) - (ya + yb) / 2], [xb, yb - lift], 20)
  const top = rib(0)
  const inner = rib(0).map(([px, py]): Pt => [px, py + 2.6])
  const ribPoly: Pt[] = [...top, ...[...inner].reverse()]
  out.push(
    occlude(ribPoly),
    occlude([
      ...inner,
      ...[...deck.slice(Math.round(0.27 * n), Math.round(0.73 * n) + 1)].reverse(),
    ]),
  )
  out.push(stroke('line', top), stroke('hair', inner))
  // Hangers from the lower rib to the deck.
  for (let px = xa + 4; px < xb - 3; px += 5.2) {
    const t = (px - xa) / (xb - xa)
    const idx = Math.round(t * 20)
    out.push(vline('fine', px, inner[idx][1], deckAt(px)))
  }
  return out
}
