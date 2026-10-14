// Atauro Island (Timor-Leste): a low volcanic island seen from the sea. A steep wall on the left
// rises to a high lumpy crest, a lower second hump follows and the right flank falls away in a long
// slope. The lit faces carry sparse diagonal strokes and gullies along the fall line, each summit
// throws a shaded right flank. A dark forest belt and a surf line sit at the foot; a smaller far
// island shows on the right. The box is the island; its bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num, pairs } from './util'

const RIDGE: Pt[] = [
  [0, 1],
  [0.03, 0.86],
  [0.08, 0.7],
  [0.15, 0.56],
  [0.22, 0.42],
  [0.28, 0.3],
  [0.33, 0.24],
  [0.38, 0.3],
  [0.44, 0.34],
  [0.5, 0.4],
  [0.56, 0.36],
  [0.62, 0.3],
  [0.68, 0.4],
  [0.75, 0.5],
  [0.82, 0.58],
  [0.9, 0.72],
  [0.96, 0.86],
  [1, 1],
]

export const atauro: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 14)))
  const base = y + h
  const foot = y + h * num(p, 'forest', 0.93)
  const ridge = pairs(p, 'ridge', RIDGE).map(([fx, fy]): Pt => [x + w * fx, y + h * fy])
  const out: SvgNode[] = []
  // Far island: a low dark hump behind the right foot.
  const far: Pt[] = []
  for (let px = x + w * 0.7; px <= x + w - 2; px += 3) {
    const t = Math.min(1, (px - (x + w * 0.7)) / (w * 0.32))
    far.push([px, base - 1 - h * 0.2 * Math.sin(t * Math.PI * 0.6) ** 1.4])
  }
  const farPoly: Pt[] = [[x + w * 0.7, base - 1], ...far, [x + w - 2, base - 1]]
  out.push(
    occlude(farPoly),
    ...toneFill(farPoly, 'T2', { angle: 58, gap: [2.4, 2.4] }),
    stroke('hair', far),
  )
  // Main skyline with slight kinks between the vertices.
  const sky: Pt[] = []
  for (let i = 0; i + 1 < ridge.length; i++) {
    const a = ridge[i]
    const b = ridge[i + 1]
    sky.push(a, [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2 + (i > 1 && i < 15 ? (rand() - 0.5) * 1.8 : 0),
    ])
  }
  sky.push(ridge[ridge.length - 1])
  out.push(occlude([...sky, [x + w, foot + 3], [x, foot + 3]]))
  // Lit face: sparse diagonal strokes over the whole island.
  const whole: Pt[] = [...sky, [x + w, foot], [x, foot]]
  out.push(...toneFill(whole, 'T2', { angle: 76, gap: [7, 7], weight: 'fine' }))
  // Shaded right flank under each summit: from the peak to the next valley.
  for (let i = 1; i + 1 < ridge.length; i++) {
    if (!(ridge[i][1] < ridge[i - 1][1] && ridge[i][1] < ridge[i + 1][1])) continue
    const pk = ridge[i]
    const pk0 = pk[0]
    const valleyX = (k: number) => ridge[k][0]
    let j = i + 1
    while (j + 1 < ridge.length && ridge[j + 1][1] > ridge[j][1] && valleyX(j) < pk0 + w * 0.15) j++
    const valley = ridge[j]
    const flank: Pt[] = [
      ...sky.filter((q) => q[0] >= pk[0] && q[0] <= valley[0]),
      [valley[0], foot],
      [pk[0] + (valley[0] - pk[0]) * 0.18, foot],
    ]
    out.push(occlude(flank))
    out.push(...toneFill(flank, 'T4', { angle: 90, gap: [2.8, 2.8], weight: 'hair', inset: 0.4 }))
    out.push(
      stroke('hair', [
        [pk[0], pk[1] + 1.4],
        [pk[0] + (valley[0] - pk[0]) * 0.18, foot - 2],
      ]),
    )
  }
  // Gullies down the lit face, along the fall line.
  for (let gx = x + w * 0.08; gx < x + w * 0.9; gx += 8 + rand() * 6) {
    const gy = sky.find((q) => q[0] >= gx)?.[1] ?? foot
    if (foot - gy < 14) continue
    out.push(
      stroke('hair', [
        [gx, gy + 3 + rand() * 3],
        [gx + (rand() - 0.5) * 2.6, (gy + foot) / 2],
        [gx + (rand() - 0.5) * 3.6, foot - 5],
      ]),
    )
  }
  out.push(stroke('line', sky))
  // Forest belt, then the surf line on the reef.
  const crown: Pt[] = []
  for (let px = x; px <= x + w + 0.1; px += 3.6) crown.push([px, foot - 1.4 + (rand() - 0.5) * 3.6])
  const belt: Pt[] = [...crown, [x + w - 5, base - 2.4], [x + 5, base - 2.4]]
  out.push(
    occlude(belt),
    ...toneFill(belt, 'T4', { angle: 82, gap: [2.4, 2.4], weight: 'fine' }),
    stroke('line', crown),
  )
  out.push(hline('hair', x, x + w, base - 2.4))
  for (let sx = x + 2; sx < x + w - 6; sx += 8 + rand() * 6)
    out.push(hline('fine', sx, sx + 5 + rand() * 4, base + 0.8))
  // A lateen-sailed fishing boat in the foreground water, lit sail against the dark sea.
  if (p.boat !== false) {
    const bx = x + w * 0.1
    const by = base + 9
    out.push(
      ...body(
        [
          [bx, by],
          [bx + 17, by],
          [bx + 14, by + 3.4],
          [bx + 3, by + 3.4],
        ],
        'line',
      ),
    )
    out.push(
      fill([
        [bx + 1, by + 0.6],
        [bx + 16, by + 0.6],
        [bx + 13.6, by + 2.8],
        [bx + 3.4, by + 2.8],
      ]),
    )
    out.push(
      ...body(
        [
          [bx + 8.4, by - 0.6],
          [bx + 8.4, by - 15],
          [bx + 19, by - 0.6],
        ],
        'line',
      ),
    )
  }
  return out
}
