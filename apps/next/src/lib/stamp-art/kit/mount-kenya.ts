// Mount Kenya: two jagged rock horns (Batian right and tall, Nelion left and lower) with a deep
// notch between them, a toothed rim, glacier patches left bare, fall-line gullies and a shaded
// right face. Fixed silhouette scaled into the box; the box bottom is the foot of the slopes.
import { mulberry32 } from '../hash'
import { pointInPoly } from '../geom'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

const SIL: Pt[] = [
  [0, 1],
  [0.1, 0.9],
  [0.2, 0.76],
  [0.27, 0.62],
  [0.31, 0.5],
  [0.34, 0.44],
  [0.355, 0.34],
  [0.375, 0.3],
  [0.385, 0.2],
  [0.405, 0.12],
  [0.415, 0.2],
  [0.43, 0.17],
  [0.445, 0.34],
  [0.47, 0.42],
  [0.485, 0.3],
  [0.5, 0.2],
  [0.515, 0.1],
  [0.535, 0.0],
  [0.55, 0.1],
  [0.565, 0.08],
  [0.58, 0.22],
  [0.6, 0.26],
  [0.62, 0.22],
  [0.645, 0.36],
  [0.7, 0.46],
  [0.76, 0.58],
  [0.83, 0.72],
  [0.92, 0.88],
  [1, 1],
]

export const mountKenya: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = y + h
  const pt = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const sil = SIL.map(pt)
  const poly: Pt[] = [...sil, [x + w, base], [x, base]]
  const out: SvgNode[] = [occlude(poly)]
  // Shaded faces: right of each horn's summit ridge, down the fall line.
  const shadeR: Pt[] = [
    pt([0.535, 0.0]),
    ...sil.slice(sil.findIndex((s) => s[0] > x + w * 0.54)),
    pt([1, 1]),
    pt([0.6, 1]),
    pt([0.57, 0.5]),
  ]
  out.push(...toneFill(shadeR, 'T4', { angle: 80, gap: 2.4, weight: 'fine', inset: 0.6 }))
  const shadeL: Pt[] = [
    pt([0.405, 0.12]),
    pt([0.43, 0.17]),
    pt([0.445, 0.34]),
    pt([0.47, 0.42]),
    pt([0.42, 0.55]),
    pt([0.4, 0.4]),
  ]
  out.push(...toneFill(shadeL, 'T4', { angle: 80, gap: 1.9, weight: 'fine', inset: 0.4 }))
  // Gullies fanning from the horns, hair, kept off the silhouette.
  const tips: Pt[] = [pt([0.405, 0.12]), pt([0.535, 0.0]), pt([0.63, 0.3])]
  for (const [i, tip] of tips.entries()) {
    const count = i === 1 ? 7 : 4
    for (let k = 0; k < count; k++) {
      const a = (-0.7 + (1.4 * (k + rand() * 0.5)) / count) * (i === 1 ? 0.8 : 0.6)
      const len = h * (0.35 + rand() * 0.35)
      const pts: Pt[] = []
      for (let s = 0; s <= 5; s++) {
        const f = s / 5
        pts.push([tip[0] + Math.sin(a) * len * f + (rand() - 0.5) * 0.9, tip[1] + 6 + len * f])
      }
      if (pts.every((q) => pointInPoly([q[0], q[1] - 1.5], poly))) out.push(stroke('hair', pts))
    }
  }
  out.push(stroke('line', sil))
  // Bare glacier patches (outlined only) below the notch and under Batian.
  out.push(
    stroke('hair', [pt([0.44, 0.42]), pt([0.455, 0.52]), pt([0.5, 0.58]), pt([0.53, 0.5])]),
    stroke('hair', [pt([0.34, 0.5]), pt([0.37, 0.56]), pt([0.4, 0.52])]),
  )
  // Ridge line from Batian down to the foot (lit edge).
  out.push(
    stroke('hair', [
      pt([0.535, 0.0]),
      pt([0.525, 0.3]),
      pt([0.55, 0.52]),
      pt([0.5, 0.8]),
      pt([0.46, 1]),
    ]),
  )
  return out
}
