// Ash column with an irregular lit edge; tone defines the billows without circle outlines.
import { mulberry32 } from '../hash'
import { type Pt, occlude } from '../grid'
import { hatchMass } from './mass-b'
import { type KitModule, num } from './util'

export const plumeA: KitModule = ([x, y, w, h], p) => {
  const lean = num(p, 'lean', 0.35)
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const cy = y + h * t
    const cx = x + w * (0.5 + lean * 0.32 * (1 - t))
    const half = w * (0.06 + 0.34 * (1 - t)) * (1 + 0.16 * Math.sin(i * 1.9))
    left.push([cx - half, cy])
    right.push([cx + half, cy + Math.sin(i * 2.1) * 0.8])
  }
  const poly: Pt[] = [...left, ...right.reverse()]
  return [
    occlude(poly, { halo: 1.6 }),
    ...hatchMass(poly, mulberry32(Math.round(num(p, 'seed', 5))), {
      angle: -62,
      gap: 2.1,
      weight: 'fine',
      thr: 0.32,
      wx: 0.6,
      wy: 0.2,
    }),
  ]
}
