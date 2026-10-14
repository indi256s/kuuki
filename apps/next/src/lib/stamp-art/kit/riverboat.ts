// A sternwheel river steamer seen from the side, bow to the left: low hull with a rail line, two
// white decks with rows of windows, a pilot house, two tall funnels with dark caps and a big
// paddle wheel at the stern drawn as a spoked disc. The box bottom is the waterline.
import {
  type Pt,
  type SvgNode,
  body,
  rectPts,
  fill,
  hline,
  occlude,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

export const riverboat: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const hullH = h * 0.2
  const hullTop = base - hullH
  const out: SvgNode[] = []
  const hull: Pt[] = [
    [x, hullTop - 1],
    [x + w * 0.04, base],
    [x + w * 0.9, base],
    [x + w * 0.96, hullTop],
  ]
  out.push(occlude(hull), stroke('line', hull, true))
  out.push(...toneFill(hull, 'T4', { gap: 2, weight: 'hair', inset: 0.5 }))
  const deckH = h * 0.2
  const d1: Pt[] = [
    [x + w * 0.04, hullTop - deckH],
    [x + w * 0.86, hullTop - deckH],
    [x + w * 0.86, hullTop],
    [x + w * 0.02, hullTop],
  ]
  out.push(occlude(d1), stroke('line', d1, true))
  const d2y = hullTop - deckH * 2
  const d2: Pt[] = [
    [x + w * 0.16, d2y],
    [x + w * 0.76, d2y],
    [x + w * 0.76, hullTop - deckH],
    [x + w * 0.16, hullTop - deckH],
  ]
  out.push(occlude(d2), stroke('line', d2, true))
  out.push(
    hline('bold', x + w * 0.01, x + w * 0.88, hullTop - deckH),
    hline('bold', x + w * 0.14, x + w * 0.78, d2y),
  )
  for (const [a, b, yy, hh] of [
    [0.08, 0.84, hullTop - deckH, deckH],
    [0.2, 0.74, d2y, deckH],
  ] as const)
    for (let wx = x + w * a; wx < x + w * b - 3; wx += 5)
      out.push(
        fill([
          [wx, yy + hh * 0.35],
          [wx + 2.6, yy + hh * 0.35],
          [wx + 2.6, yy + hh * 0.75],
          [wx, yy + hh * 0.75],
        ]),
      )
  const pilot: Pt[] = [
    [x + w * 0.3, d2y - deckH * 0.8],
    [x + w * 0.5, d2y - deckH * 0.8],
    [x + w * 0.5, d2y],
    [x + w * 0.3, d2y],
  ]
  out.push(
    occlude(pilot),
    stroke('line', pilot, true),
    hline('bold', x + w * 0.28, x + w * 0.52, d2y - deckH * 0.8),
  )
  out.push(
    fill([
      [x + w * 0.33, d2y - deckH * 0.6],
      [x + w * 0.47, d2y - deckH * 0.6],
      [x + w * 0.47, d2y - deckH * 0.3],
      [x + w * 0.33, d2y - deckH * 0.3],
    ]),
  )
  for (const fx of [0.58, 0.67]) {
    const f: Pt[] = [
      [x + w * fx, d2y - deckH * 1.6],
      [x + w * (fx + 0.05), d2y - deckH * 1.6],
      [x + w * (fx + 0.05), d2y],
      [x + w * fx, d2y],
    ]
    out.push(
      occlude(f),
      stroke('line', f, true),
      fill([
        [x + w * fx - 0.8, d2y - deckH * 1.9],
        [x + w * (fx + 0.05) + 0.8, d2y - deckH * 1.9],
        [x + w * (fx + 0.05), d2y - deckH * 1.5],
        [x + w * fx, d2y - deckH * 1.5],
      ]),
    )
  }
  // Stern paddle wheel.
  const wr = hullH + deckH * num(p, 'wheel', 1.1)
  const wcx = x + w * 0.9,
    wcy = base - wr * 0.55
  const ring: Pt[] = Array.from({ length: 20 }, (_, i) => [
    wcx + Math.cos((i / 20) * Math.PI * 2) * wr,
    wcy + Math.sin((i / 20) * Math.PI * 2) * wr,
  ])
  out.push(occlude(ring), stroke('line', ring, true))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    out.push(
      stroke('hair', [
        [wcx, wcy],
        [wcx + Math.cos(a) * wr, wcy + Math.sin(a) * wr],
      ]),
    )
  }
  out.push(
    fill([
      [wcx - 1.6, wcy - 1.6],
      [wcx + 1.6, wcy - 1.6],
      [wcx + 1.6, wcy + 1.6],
      [wcx - 1.6, wcy + 1.6],
    ]),
  )
  if (p.housing === true)
    out.push(...body(rectPts(wcx - wr * 1.08, wcy - wr * 1.1, wr * 2.16, wr * 1.3), 'line'))
  return out
}
