// CR: the steam plume over Arenal. Overlapping round puffs that grow as they climb and drift to the
// right; each puff is a lit shape with a hair outline and a little shading arc on its lower right.
import { type Pt, type SvgNode, body, stroke } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

const circle = (cx: number, cy: number, r: number, n = 18): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    cx + r * Math.cos((i / n) * Math.PI * 2),
    cy + r * 0.82 * Math.sin((i / n) * Math.PI * 2),
  ])

/** The box is the plume: it starts at the bottom left and climbs to the top right. */
export const plume: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(3, Math.round(num(p, 'puffs', 6)))
  const out: SvgNode[] = []
  const r0 = num(p, 'r0', 4)
  const r1 = num(p, 'r1', 9)
  // Paint the highest (largest) puff first so the lower ones overlap it.
  for (let i = count - 1; i >= 0; i--) {
    const t = i / (count - 1)
    const r = r0 + (r1 - r0) * t
    const cx = x + r + (w - 2 * r) * Math.pow(t, 1.2)
    const cy = y + h - r - (h - 2 * r) * t
    out.push(...body(circle(cx, cy, r), 'hair'))
    const arc: Pt[] = Array.from({ length: 6 }, (_, k) => {
      const a = (-0.1 + (0.55 * k) / 5) * Math.PI
      return [cx + r * 0.7 * Math.cos(a), cy + r * 0.58 * Math.sin(a)]
    })
    out.push(stroke('fine', arc))
  }
  return out
}
