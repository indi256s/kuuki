// Mount Kinabalu (Malaysia): a broad granite massif. Bald, smooth shoulders sweep up on both sides
// to a jagged summit plateau crowned by rock horns (Donkey Ears, Low's Peak, St John's), over a dark
// forest belt. The lit left shoulder carries long glacial-polish streaks, each horn throws a shaded
// right face. The box is the massif; its bottom is the foot of the forest.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, cubic, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

// Summit plateau as [x, y] fractions of the box; y 0 is the top. Peaks are the local minima of y.
const CROWN: Pt[] = [
  [0.18, 0.38],
  [0.24, 0.3],
  [0.285, 0.12],
  [0.315, 0.28],
  [0.35, 0.06],
  [0.38, 0.26],
  [0.43, 0.2],
  [0.47, 0.3],
  [0.52, 0.0],
  [0.56, 0.22],
  [0.6, 0.18],
  [0.64, 0.07],
  [0.68, 0.28],
  [0.73, 0.24],
  [0.82, 0.38],
]

export const kinabalu: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const foot = y + h * num(p, 'forest', 0.9)
  const base = y + h
  const at = (f: Pt): Pt => [x + w * f[0], y + h * f[1]]
  const crown = CROWN.map(at)
  const leftFlank = cubic(
    [x, foot + 2],
    [x + w * 0.1, foot - h * 0.06],
    [x + w * 0.12, y + h * 0.6],
    crown[0],
    12,
  )
  const rightFlank = cubic(
    crown[crown.length - 1],
    [x + w * 0.88, y + h * 0.6],
    [x + w * 0.9, foot - h * 0.06],
    [x + w, foot + 2],
    12,
  )
  const sky: Pt[] = [...leftFlank, ...crown.slice(1), ...rightFlank.slice(1)]
  const out: SvgNode[] = []
  out.push(occlude([...sky, [x + w, foot + 3], [x, foot + 3]]))
  // Lit left shoulder: sparse streaks following the slope.
  const left: Pt[] = [...leftFlank, ...crown.slice(1, 6), [crown[5][0], foot], [x, foot]]
  out.push(...toneFill(left, 'T2', { angle: 72, gap: [4.2, 4.2], weight: 'fine' }))
  // Right shoulder: shaded, vertical along the fall line.
  const rightStart = crown.findIndex((q) => q[0] >= x + w * 0.45)
  const right: Pt[] = [
    ...crown.slice(rightStart),
    ...rightFlank.slice(1),
    [x + w, foot],
    [crown[rightStart][0], foot],
  ]
  out.push(...toneFill(right, 'T4', { angle: 90, gap: [3.6, 3.6], weight: 'hair', inset: 0.4 }))
  // Horn faces: shaded right side under every local summit of the crown.
  const plateauY = y + h * 0.4
  for (let i = 1; i + 1 < crown.length; i++) {
    if (!(crown[i][1] < crown[i - 1][1] && crown[i][1] < crown[i + 1][1])) continue
    const nx = crown[i + 1]
    const face: Pt[] = [crown[i], nx, [nx[0], plateauY], [crown[i][0] + 0.8, plateauY]]
    out.push(...toneFill(face, 'T4', { angle: 90, gap: [1.9, 1.9], weight: 'hair', inset: 0.3 }))
    out.push(
      stroke('hair', [
        [crown[i][0] + 0.6, crown[i][1] + 1.4],
        [crown[i][0] + 0.9, plateauY],
      ]),
    )
  }
  // Bare-rock streaks and gullies down the lit shoulder.
  for (let gx = x + w * 0.1; gx < x + w * 0.22; gx += 4.5 + rand() * 3) {
    const t = (gx - x) / (w * 0.22)
    const top = foot - (foot - crown[0][1]) * t ** 1.4 - 2
    out.push(
      stroke('line', [
        [gx, top + 3 + rand() * 4],
        [gx + 1 + rand() * 2, (top + foot) / 2],
        [gx + 2 + rand() * 3, foot - 4],
      ]),
    )
  }
  out.push(stroke('line', sky))
  // Forest belt.
  const crownLine: Pt[] = []
  for (let px = x; px <= x + w + 0.1; px += 3.8)
    crownLine.push([px, foot - 1.2 + (rand() - 0.5) * 3.4])
  const belt: Pt[] = [...crownLine, [x + w - 6, base], [x + 6, base]]
  out.push(occlude(belt), ...toneFill(belt, 'T4', { angle: 82, gap: [2.3, 2.3], weight: 'fine' }))
  out.push(stroke('line', crownLine), hline('hair', x + 4, x + w - 4, base - 0.5))
  return out
}
