// Tongkonan of Tana Toraja (Indonesia): a raised timber house whose huge saddle roof sags along the
// ridge and sweeps up at both ends like a boat, the front end reaching further. Under it a carved
// wall band and thick posts. Opposite stands a smaller rice barn (alangan) with the same roof on
// tall posts, each capped with a round rat guard. The box is both buildings; its bottom is the ground.
import { type Pt, type SvgNode, body, fill, hline, quad, rectPts, stroke, toneFill } from '../grid'
import { type KitModule } from './util'

/** Boat roof: sagging ridge above, sagging eave below, both swept up to the tips. */
function roof(
  x0: number,
  x1: number,
  tipY: number,
  sag: number,
  thick: number,
  hatch: number,
): SvgNode[] {
  const mid = (x0 + x1) / 2
  const upper = quad([x0, tipY], [mid, tipY + sag * 2], [x1, tipY], 18)
  const lower = quad(
    [x1 - thick * 0.9, tipY + thick * 1.3],
    [mid, tipY + sag * 2 + thick * 1.5],
    [x0 + thick * 0.9, tipY + thick * 1.3],
    18,
  )
  const poly: Pt[] = [...upper, ...lower]
  const out: SvgNode[] = [...body(poly, 'line')]
  // Shingle courses run across the roof: vertical hatching, dense toward the front (right) end.
  const inner: Pt[] = [
    ...upper.map(([px, py]): Pt => [px, py + 2.2]),
    ...lower.map(([px, py]): Pt => [px, py - 1.2]),
  ]
  out.push(
    ...toneFill(
      inner.filter(([px]) => px > x0 + (x1 - x0) * 0.36),
      'T4',
      { angle: 90, gap: [hatch, hatch], weight: 'hair', inset: 0.3 },
    ),
  )
  out.push(
    ...toneFill(
      inner.filter(([px]) => px <= x0 + (x1 - x0) * 0.36 + 0.01),
      'T4',
      { angle: 90, gap: [hatch * 2, hatch * 2], weight: 'fine', inset: 0.3 },
    ),
  )
  return out
}

export const tongkonan: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const out: SvgNode[] = []
  // Barn on the right, behind: tall posts with rat guards, small wall, boat roof.
  const bx0 = x + w * 0.66
  const bx1 = x + w * 0.98
  const barnDeck = base - h * 0.34
  const barnWallTop = barnDeck - h * 0.14
  for (const f of [0.12, 0.36, 0.64, 0.88]) {
    const px = bx0 + (bx1 - bx0) * f
    out.push(
      stroke('line', [
        [px, barnDeck],
        [px, base],
      ]),
    )
    out.push(
      ...body(
        [
          [px - 2.4, barnDeck + 4],
          [px + 2.4, barnDeck + 4],
          [px + 1.6, barnDeck + 6.4],
          [px - 1.6, barnDeck + 6.4],
        ],
        'hair',
      ),
    )
  }
  out.push(...body(rectPts(bx0 + 4, barnWallTop, bx1 - bx0 - 8, barnDeck - barnWallTop), 'line'))
  out.push(
    fill(rectPts(bx0 + (bx1 - bx0) * 0.5 - 2, barnWallTop + 4, 4, barnDeck - barnWallTop - 4)),
  )
  out.push(...roof(bx0 - 2, bx1 - 1, base - 60, 4.2, 14.1, 2.6))
  // Main house on the left, in front.
  const hx0 = x
  const hx1 = x + w * 0.66
  const deck = base - h * 0.24
  const wallTop = deck - h * 0.2
  for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const px = hx0 + 6 + (hx1 - hx0 - 12) * f
    out.push(
      stroke('line', [
        [px, deck],
        [px, base],
      ]),
    )
  }
  out.push(...body(rectPts(hx0 + 5, deck - 2, hx1 - hx0 - 10, 2.6), 'hair'))
  out.push(...body(rectPts(hx0 + 8, wallTop, hx1 - hx0 - 16, deck - 2 - wallTop), 'line'))
  // Carved wall: a dark door and a string of small panels.
  const doorX = hx0 + (hx1 - hx0) * 0.62
  out.push(fill(rectPts(doorX, wallTop + 4, 5.4, deck - 2 - wallTop - 4)))
  for (let px = hx0 + 14; px < doorX - 4; px += 9)
    out.push(...body(rectPts(px, wallTop + 4, 5, 6), 'hair'))
  out.push(hline('bold', hx0 + 4, hx1 - 4, wallTop))
  out.push(...roof(hx0 + 6, hx1 + 8, base - 70, 6, 22, 2.8))
  // Ground line with grass.
  out.push(hline('bold', x + 2, x + w - 1, base + 0.6))
  return out
}
