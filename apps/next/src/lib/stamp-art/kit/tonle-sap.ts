// Tonle Sap floating-season village (Cambodia): front-gabled timber houses on very tall posts, the
// gable end faces us with a steep roof, a ladder climbs from the water to the deck and long boats
// with a raised prow lie below. Back houses are smaller and sit higher up the water. The box is the
// whole village; its bottom is the waterline.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatch,
  hline,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num } from './util'

function house(cx: number, base: number, s: number, rand: () => number, ladder: number): SvgNode[] {
  const out: SvgNode[] = []
  const postH = 20 * s
  const wallH = 11 * s
  const roofH = 13 * s
  const wallW = 27 * s
  const deck = base - postH
  const wallTop = deck - wallH
  // Posts with a lean and two crossing braces.
  const posts = 3
  for (let i = 0; i < posts; i++) {
    const px = cx - wallW / 2 + 1 + ((wallW - 2) * i) / (posts - 1)
    out.push(
      stroke('hair', [
        [px, deck],
        [px + (rand() - 0.5) * 0.8, base],
      ]),
    )
  }
  out.push(
    stroke('fine', [
      [cx - wallW / 2 + 1, deck + postH * 0.25],
      [cx + wallW / 2 - 1, deck + postH * 0.6],
    ]),
    stroke('fine', [
      [cx + wallW / 2 - 1, deck + postH * 0.25],
      [cx - wallW / 2 + 1, deck + postH * 0.6],
    ]),
  )
  // Ladder from the deck edge down to the water.
  if (ladder !== 0) {
    const lx = cx + (ladder * wallW) / 2
    const lx2 = lx + ladder * postH * 0.28
    out.push(
      stroke('hair', [
        [lx, deck],
        [lx2, base],
      ]),
      stroke('hair', [
        [lx + ladder * 2.4, deck],
        [lx2 + ladder * 2.4, base],
      ]),
    )
    for (let r = 1; r < 7; r++) {
      const t = r / 7
      const rx = lx + (lx2 - lx) * t
      out.push(hline('fine', rx, rx + ladder * 2.4, deck + postH * t))
    }
  }
  // Deck, wall with door and window, then the steep gable roof with eaves overhang.
  out.push(...body(rectPts(cx - wallW / 2 - 2, deck - 1.8, wallW + 4, 2.2), 'hair'))
  out.push(...body(rectPts(cx - wallW / 2, wallTop, wallW, wallH - 1.8), 'line'))
  out.push(fill(rectPts(cx - 1.8 * s, wallTop + 3.2 * s, 3.6 * s, wallH - 1.8 - 3.2 * s)))
  out.push(fill(rectPts(cx - wallW / 2 + 3 * s, wallTop + 3 * s, 4 * s, 3.4 * s)))
  out.push(fill(rectPts(cx + wallW / 2 - 7 * s, wallTop + 3 * s, 4 * s, 3.4 * s)))
  const rw = wallW + 7 * s
  const roof: Pt[] = [
    [cx - rw / 2, wallTop + 1],
    [cx, wallTop - roofH],
    [cx + rw / 2, wallTop + 1],
  ]
  out.push(...body(roof, 'line'))
  // Plank courses inside the gable end; the right half sits in shade.
  out.push(
    ...hatch(
      [
        [cx - rw / 2 + 2.4, wallTop],
        [cx, wallTop - roofH + 3.6],
        [cx + rw / 2 - 2.4, wallTop],
      ],
      'h',
      5.5,
      'fine',
      0.2,
    ),
  )
  out.push(
    ...toneFill(
      [
        [cx + rw * 0.2, wallTop - roofH * 0.38],
        [cx + rw / 2 - 1.6, wallTop + 0.2],
        [cx + rw * 0.2, wallTop + 0.2],
      ],
      'T4',
      { angle: 90, gap: [2.6, 2.6], inset: 0.2 },
    ),
  )
  out.push(hline('bold', cx - rw / 2 - 1, cx + rw / 2 + 1, wallTop + 1))
  // Crossed finials at the apex.
  out.push(
    stroke('hair', [
      [cx - 2.4, wallTop - roofH - 3.4],
      [cx, wallTop - roofH - 0.4],
      [cx + 2.4, wallTop - roofH - 3.4],
    ]),
  )
  return out
}

function boat(x0: number, wl: number, len: number): SvgNode[] {
  const hull: Pt[] = [
    [x0, wl - 6],
    [x0 + len * 0.1, wl - 1.6],
    [x0 + len * 0.9, wl - 1.6],
    [x0 + len, wl - 5],
    [x0 + len * 0.9, wl - 3],
    [x0 + len * 0.1, wl - 3.4],
  ]
  return [
    ...body(hull, 'line'),
    ...hatch(
      [
        [x0 + len * 0.1, wl - 3.2],
        [x0 + len * 0.9, wl - 3.2],
        [x0 + len * 0.9, wl - 1.8],
        [x0 + len * 0.1, wl - 1.8],
      ],
      'h',
      1.4,
      'fine',
    ),
    vline('hair', x0 + len * 0.5, wl - 3.4, wl - 9),
  ]
}

export const tonleSap: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const out: SvgNode[] = []
  // Back houses first, smaller and higher up the water.
  out.push(...house(x + w * 0.14, base - h * 0.06, 1.15, rand, 1))
  out.push(...house(x + w * 0.86, base - h * 0.08, 1.1, rand, -1))
  // Centre house in front, with its ladder on the left.
  out.push(...house(x + w * 0.5, base, 1.7, rand, -1))
  out.push(...boat(x + w * 0.62, base + 0.6, w * 0.34))
  out.push(...boat(x + w * 0.02, base + 0.6, w * 0.26))
  out.push(hline('hair', x + w * 0.1, x + w * 0.9, base + 3.6))
  return out
}
