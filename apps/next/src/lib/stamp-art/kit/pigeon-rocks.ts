// Pigeon Rocks (Raouche): two limestone sea stacks of unequal height standing side by side in the
// sea, the taller one (left) pierced at its foot by a round-topped arch. Shaded right flanks along
// the fall line, bedding ticks on the lit face, a few eroded pits and foam at the foot. The box
// bottom is the waterline.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

/** Top profile of a stack as [x, y] fractions of its own box, left to right. */
const PROFILE: Pt[] = [
  [0, 1],
  [0.01, 0.72],
  [0.05, 0.5],
  [0.15, 0.2],
  [0.3, 0.05],
  [0.52, 0],
  [0.72, 0.05],
  [0.9, 0.18],
  [0.98, 0.42],
  [1, 0.74],
  [1, 1],
]

export const pigeonRocks: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const base = y + h
  const out: SvgNode[] = []

  const stack = (x0: number, x1: number, top: number, arch: boolean, shadeAt: number) => {
    const sw = x1 - x0
    const sh = base - top
    const prof = PROFILE.map(([a, b], i): Pt => [
      x0 + sw * a,
      top + sh * b + (i > 1 && i < PROFILE.length - 2 ? (rand() - 0.5) * 1.6 : 0),
    ])
    // Fill in the crown with a few ragged points.
    const crown: Pt[] = []
    for (let i = 0; i + 1 < prof.length - 1; i++) {
      crown.push(prof[i])
      if (i > 1 && i < prof.length - 3) {
        const m: Pt = [(prof[i][0] + prof[i + 1][0]) / 2, (prof[i][1] + prof[i + 1][1]) / 2]
        crown.push([m[0], m[1] + (rand() - 0.5) * 2.2])
      }
    }
    crown.push(prof[prof.length - 2])
    const edge: Pt[] = [...crown.slice(1)] // from left shoulder to right foot (without base corner)
    const left: Pt = [x0, base]
    const right: Pt = [x1, base]
    let poly: Pt[]
    let hole: Pt[] = []
    if (arch) {
      const ac = x0 + sw * 0.34
      const aw = sw * 0.17
      const ay = top + sh * 0.56
      hole = [
        ...quad([ac + aw, base], [ac + aw, ay], [ac, ay], 10),
        ...quad([ac, ay], [ac - aw, ay], [ac - aw, base], 10).slice(1),
      ]
      poly = [left, ...edge, right, ...hole]
    } else poly = [left, ...edge, right]
    out.push(occlude(poly, { halo: 2 }))
    out.push(stroke('line', [left, ...edge, right]))
    if (hole.length) out.push(stroke('line', hole))
    // Shaded right flank.
    const xs = x0 + sw * shadeAt
    const shade: Pt[] = [[xs, top + sh * 0.02]]
    for (const q of edge) if (q[0] > xs) shade.push(q)
    shade.push(right, [xs + sw * 0.04, base])
    out.push(...toneFill(shade, 'T4', { angle: 88, gap: 2.4, weight: 'hair', inset: 0.5 }))
    // Bedding ticks on the lit face.
    for (let k = 1; k < 8; k++) {
      const yy = top + sh * (0.12 + 0.11 * k)
      for (let sx = x0 + 3 + rand() * 5; sx < xs - 8; sx += 11 + rand() * 9) {
        const inArch = arch && yy > top + sh * 0.5 && sx > x0 + sw * 0.15 && sx < x0 + sw * 0.55
        if (!inArch) out.push(hline('hair', sx, sx + 4 + rand() * 5, yy + (rand() - 0.5)))
      }
    }
    // Eroded pits.
    for (let k = 0; k < 3; k++) {
      const px = x0 + sw * (0.2 + rand() * 0.4)
      const py = top + sh * (0.15 + rand() * 0.28)
      out.push(fill(rectPts(px, py, 2.6 + rand() * 2, 1.8 + rand() * 1.2)))
    }
  }

  stack(x + w * 0.02, x + w * 0.58, y + h * 0.02, true, 0.58)
  stack(x + w * 0.62, x + w * 0.9, y + h * 0.3, false, 0.48)
  // Foam at the foot.
  for (const [a, b, yy] of [
    [0.06, 0.16, 1.4],
    [0.46, 0.66, 1.6],
    [0.8, 0.94, 1.4],
    [0.2, 0.34, 3.4],
    [0.7, 0.88, 3.4],
  ] as const)
    out.push(hline('hair', x + w * a, x + w * b, base + yy))
  return out
}
