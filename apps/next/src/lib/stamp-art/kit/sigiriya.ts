// Sigiriya (Sri Lanka): a sheer granite monolith with a flat summit carrying low ruined walls and
// a few trees. Fall-line hatching on a shaded right face, a lit left face with sparse strokes, a
// ledge halfway up with two solid lion paws flanking the stair mouth, a mirror wall along the left
// face, and a dense jungle band at the foot. The box is the whole view; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, occlude, rectPts, toneFill } from '../grid'
import { type KitModule, num } from './util'

const SIL: Pt[] = [
  [0.2, 0.86],
  [0.18, 0.66],
  [0.17, 0.46],
  [0.16, 0.27],
  [0.165, 0.13],
  [0.2, 0.05],
  [0.28, 0.03],
  [0.72, 0.03],
  [0.8, 0.05],
  [0.835, 0.13],
  [0.84, 0.27],
  [0.83, 0.46],
  [0.82, 0.66],
  [0.81, 0.86],
]

export const sigiriya: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const out: SvgNode[] = []
  const rock = SIL.map(at)
  out.push(...body(rock, 'line'))
  // Shaded right face along the fall line; the split wanders a little.
  const shade: Pt[] = [
    ...SIL.filter(([fx]) => fx > 0.55).map(at),
    at([0.56, 0.86]),
    at([0.52, 0.6]),
    at([0.55, 0.3]),
    at([0.52, 0.035]),
  ]
  out.push(...toneFill(shade, 'T4', { gap: [3.2, 3.2], inset: 0.3 }))
  // Lit left face: sparse fall-line strokes and a few dark cracks.
  const lit: Pt[] = [
    ...SIL.filter(([fx]) => fx < 0.45).map(at),
    at([0.45, 0.03]),
    at([0.5, 0.3]),
    at([0.47, 0.6]),
    at([0.5, 0.86]),
  ]
  out.push(
    ...toneFill(lit.slice(0, -4).concat(lit.slice(-4)), 'T4', {
      angle: 88,
      gap: [5, 5],
      weight: 'fine',
      inset: 1.5,
    }),
  )
  for (const [fx, f0, f1] of [
    [0.27, 0.2, 0.45],
    [0.36, 0.35, 0.7],
    [0.42, 0.12, 0.33],
  ] as const) {
    const cxl = x + w * fx
    out.push(
      fill([
        [cxl - 0.7, y + h * f0],
        [cxl + 0.7, y + h * f0],
        [cxl + 0.3, y + h * f1],
        [cxl - 0.3, y + h * f1],
      ]),
    )
  }
  // Summit: low ruined walls and two trees.
  const topY = y + h * 0.035
  out.push(hline('bold', x + w * 0.2, x + w * 0.8, topY))
  let px = x + w * 0.25
  while (px < x + w * 0.74) {
    const bw = 3 + rand() * 4
    const bh = 2 + rand() * 3.2
    out.push(...body(rectPts(px, topY - bh, bw, bh + 0.5), 'hair'))
    px += bw + 1.2 + rand() * 3.6
  }
  for (const fx of [0.32, 0.7]) {
    const t: Pt[] = []
    for (let a = 0; a <= 8; a++) {
      const th = Math.PI + (Math.PI * a) / 8
      t.push([x + w * fx + Math.cos(th) * 4.2, topY - 3 + Math.sin(th) * 4])
    }
    out.push(...body(t, 'hair'))
  }
  // Ledge, lion paws, stair mouth.
  const ledge = y + h * 0.55
  const lx0 = x + w * 0.38
  const lx1 = x + w * 0.64
  out.push(occlude(rectPts(lx0, ledge - 2, lx1 - lx0, 5.4)))
  out.push(hline('bold', lx0, lx1, ledge + 3))
  out.push(fill(rectPts(lx0 + 1, ledge + 0.2, 3.2, 2.8)))
  for (const fx of [0.435, 0.565]) {
    const q = x + w * fx
    out.push(
      fill([
        [q - 4.6, ledge + 3],
        [q - 4.2, ledge - 1.4],
        [q - 1.6, ledge - 3.4],
        [q + 1.6, ledge - 3.4],
        [q + 4.2, ledge - 1.4],
        [q + 4.6, ledge + 3],
      ]),
    )
  }
  out.push(fill(rectPts(x + w * 0.5 - 2.6, ledge - 3, 5.2, 6)))
  // Mirror wall: a parapet hugging the left face at ledge level.
  const mw0 = x + w * 0.2
  out.push(...body(rectPts(mw0, ledge + 0.4, lx0 - mw0, 3), 'hair'))
  out.push(hline('bold', mw0, lx0, ledge + 3.4))
  // Jungle band across the foot.
  const crown = (px2: number): number => {
    const mid = 0.5 - Math.abs((px2 - x) / w - 0.5)
    return y + h * (0.9 - Math.min(0.1, mid * 0.5) * 0.9)
  }
  const jungle: Pt[] = []
  for (let q = x; q <= x + w + 0.01; q += 4)
    jungle.push([q, crown(q) - Math.abs(Math.sin(q * 0.8)) * 2.4 + (rand() - 0.5)])
  const band: Pt[] = [...jungle, [x + w, base], [x, base]]
  out.push(...body(band, 'hair'))
  out.push(...toneFill(band, 'T4', { gap: [2.9, 2.9], inset: 0.3, weight: 'hair' }))
  out.push(hline('bold', x, x + w, base))
  return out
}
