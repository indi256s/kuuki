// Kampong Ayer (Brunei): timber houses with hip roofs on tall posts above the river, a long
// boardwalk with a rail and posts linking them, a back row of smaller houses and a water taxi in
// front. Posts have cross braces; roofs are hatched along the slope with a solid ridge. The box is
// the whole village; its bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

function house(cx: number, base: number, s: number, rand: () => number): SvgNode[] {
  const out: SvgNode[] = []
  const postH = 15 * s
  const wallH = 10 * s
  const roofH = 8.4 * s
  const wallW = 22 * s
  const deck = base - postH
  const wallTop = deck - wallH
  for (let i = 0; i < 5; i++) {
    const px = cx - wallW / 2 + 1 + ((wallW - 2) * i) / 4
    out.push(
      stroke('hair', [
        [px, deck],
        [px + (rand() - 0.5) * 0.6, base],
      ]),
    )
  }
  out.push(
    stroke('fine', [
      [cx - wallW / 2 + 1, deck + postH * 0.3],
      [cx + wallW / 2 - 1, deck + postH * 0.62],
    ]),
  )
  out.push(
    stroke('fine', [
      [cx + wallW / 2 - 1, deck + postH * 0.3],
      [cx - wallW / 2 + 1, deck + postH * 0.62],
    ]),
  )
  out.push(...body(rectPts(cx - wallW / 2 - 1.5, deck - 1.6, wallW + 3, 1.8), 'hair'))
  out.push(...body(rectPts(cx - wallW / 2, wallTop, wallW, wallH - 1.6), 'line'))
  out.push(fill(rectPts(cx - 1.6 * s, wallTop + 3 * s, 3.2 * s, wallH - 1.6 - 3 * s)))
  out.push(fill(rectPts(cx - wallW / 2 + 2 * s, wallTop + 3 * s, 3 * s, 2.8 * s)))
  out.push(fill(rectPts(cx + wallW / 2 - 5 * s, wallTop + 3 * s, 3 * s, 2.8 * s)))
  const rw = wallW + 8 * s
  const roof: Pt[] = [
    [cx - rw / 2, wallTop + 1],
    [cx - rw * 0.3, wallTop - roofH],
    [cx + rw * 0.3, wallTop - roofH],
    [cx + rw / 2, wallTop + 1],
  ]
  out.push(...body(roof, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + rw * 0.05, wallTop - roofH + 0.6],
        [cx + rw * 0.3, wallTop - roofH + 0.6],
        [cx + rw / 2 - 0.5, wallTop + 0.4],
        [cx + rw * 0.05, wallTop + 0.4],
      ],
      'T4',
      { angle: 90, gap: [3, 3], inset: 0.3 },
    ),
  )
  out.push(hline('bold', cx - rw / 2 - 1, cx + rw / 2 + 1, wallTop + 1))
  out.push(hline('line', cx - rw * 0.3, cx + rw * 0.3, wallTop - roofH))
  return out
}

export const kampongAyer: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const out: SvgNode[] = []
  // Back row: smaller, further up the river.
  out.push(...house(x + w * 0.5, base - h * 0.16, 1.05, rand))
  // Boardwalk across the front of the back row.
  const walk = base - h * 0.52
  out.push(...body(rectPts(x, walk, w, 2), 'hair'))
  out.push(hline('hair', x, x + w, walk - 5))
  for (let px = x + 3; px < x + w; px += 9) {
    out.push(
      stroke('fine', [
        [px, walk - 5],
        [px, walk],
      ]),
    )
    out.push(
      stroke('hair', [
        [px, walk + 2],
        [px, base - h * 0.16],
      ]),
    )
  }
  // Front row.
  for (const fx of [0.2, 0.8]) out.push(...house(x + w * fx, base, 1.55, rand))
  out.push(hline('bold', x, x + w, base))
  return out
}
