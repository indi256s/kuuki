// Strombolian vent: an irregular tonal ash column and ballistic arcs ending in small bombs.
// The box bottom is the vent; the column shares the contour-free plume drawing.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, stroke } from '../grid'
import { type KitModule, num } from './util'
import { plumeA } from './plume-a'

const ellipse = (cx: number, cy: number, r: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9] as Pt
  })

export const eruptionA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const sway = num(p, 'sway', 0.18)
  const colH = h * num(p, 'column', 0.82)
  const vx = x + w / 2
  const base = y + h
  const out: SvgNode[] = []
  // Bombs first, behind the column: each is a parabola from the vent with a dot at its end.
  const arcs = Math.round(num(p, 'arcs', 6))
  for (let i = 0; i < arcs; i++) {
    const side = i % 2 ? 1 : -1
    const reach =
      (0.22 + 0.26 * ((i >> 1) / Math.max(1, (arcs >> 1) - 1))) * w * (0.9 + rand() * 0.2)
    const peak = h * (0.5 - 0.22 * (i >> 1) + rand() * 0.06)
    const pts: Pt[] = []
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      pts.push([vx + side * reach * t, base - 1 - peak * 4 * t * (1 - t) - h * 0.04 * t])
    }
    out.push(stroke('hair', pts))
    const [ex, ey] = pts[12]
    out.push(fill(ellipse(ex, ey, 1.8, 8)))
  }
  out.push(
    ...plumeA([x + w * 0.2, base - colH, w * 0.6, colH], { lean: sway, seed: num(p, 'seed', 7) }),
  )
  return out
}
