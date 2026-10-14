// Timber jetty on posts running straight out over flat water (Pigeon Point, Flying Fish Cove). The
// box holds the jetty from its shore end (left) to its seaward end (right); the bottom is the
// waterline. `hut` puts an open thatched shelter on the end, `crane` a cantilever gantry. Posts are
// hair verticals into the water under a dark deck band; a post-and-rail fence runs along the deck.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill, vline } from '../grid'
import { type KitModule, bool, num } from './util'

export const jettyA: KitModule = ([x, y, w, h], p) => {
  const water = y + h
  const deckY = water - h * num(p, 'deck', 0.16)
  const end = x + w
  const hut = bool(p, 'hut', false)
  const crane = bool(p, 'crane', false)
  const out: SvgNode[] = []

  // Posts down into the water, then the deck: a dark band with a bold top edge.
  const deckEnd = hut ? end - w * 0.04 : end
  for (let px = x + 3; px < deckEnd; px += 8) out.push(vline('line', px, deckY + 4, water + 3))
  out.push(...body(rectPts(x, deckY, deckEnd - x, 4), 'hair'))
  out.push(...toneFill(rectPts(x + 0.5, deckY + 0.5, deckEnd - x - 1, 3), 'T4', { inset: 0.3 }))
  out.push(
    stroke('bold', [
      [x, deckY],
      [deckEnd, deckY],
    ]),
  )
  out.push(
    stroke('hair', [
      [x, water + 3.4],
      [deckEnd, water + 3.4],
    ]),
  )

  // Fence on the shore half of the deck.
  const fenceEnd = hut ? end - w * 0.3 : x + w * 0.55
  for (let fx = x + 2; fx < fenceEnd; fx += 9) out.push(vline('hair', fx, deckY - 6, deckY))
  out.push(hline('hair', x + 2, fenceEnd, deckY - 6))

  if (hut) {
    // Open thatched shelter: four posts under a steep conical roof, lit left and shaded right.
    const hw = w * 0.15
    const cx = end - hw - w * 0.01
    const apex = y
    const eave = y + h * 0.5
    for (const f of [-0.72, -0.24, 0.24, 0.72])
      out.push(vline('line', cx + f * hw, eave + 2, deckY))
    out.push(hline('hair', cx - hw * 0.72, cx + hw * 0.72, deckY - h * 0.2))
    const roof: Pt[] = [
      [cx - hw - 2, eave],
      [cx, apex],
      [cx + hw + 2, eave],
    ]
    out.push(...body(roof, 'line'))
    out.push(
      ...toneFill(
        [
          [cx, apex + 1],
          [cx + hw + 1.2, eave - 0.4],
          [cx, eave - 0.4],
        ],
        'T4',
        { inset: 0.4, gap: [3.2, 3.2] },
      ),
    )
    for (const f of [-0.7, -0.4, -0.15])
      out.push(
        stroke('fine', [
          [cx + f * hw * 0.2, apex + 5],
          [cx + f * hw * 1.2, eave - 1.5],
        ]),
      )
    out.push(
      stroke('bold', [
        [cx - hw - 3, eave],
        [cx + hw + 3, eave],
      ]),
    )
    out.push(fill(rectPts(cx - 0.8, apex - 3, 1.6, 4)))
  }
  if (crane) {
    // Cantilever gantry: two braced legs, a horizontal jib reaching out and a hanging hook line.
    const cx = end - w * 0.26
    const top = y
    const legW = w * 0.13
    out.push(
      stroke('line', [
        [cx - legW / 2, deckY],
        [cx - legW * 0.15, top + 3],
      ]),
    )
    out.push(
      stroke('line', [
        [cx + legW / 2, deckY],
        [cx + legW * 0.15, top + 3],
      ]),
    )
    out.push(
      stroke('hair', [
        [cx - legW / 2, deckY],
        [cx + legW * 0.15, top + 3],
      ]),
    )
    out.push(
      stroke('hair', [
        [cx + legW / 2, deckY],
        [cx - legW * 0.15, top + 3],
      ]),
    )
    out.push(
      stroke('line', [
        [cx - legW, top + 3],
        [end + 2, top + 3],
      ]),
    )
    out.push(
      stroke('fine', [
        [cx - legW * 0.1, top + 3],
        [cx - legW, top + 9],
      ]),
    )
    out.push(vline('fine', end - 2, top + 3, deckY - 4))
    out.push(...body(rectPts(end - 4.4, deckY - 4, 4.8, 4), 'hair'))
  }
  return out
}
