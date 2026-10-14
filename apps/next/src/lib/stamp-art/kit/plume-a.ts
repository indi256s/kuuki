// Ash plume (lane A, `-a` until consolidated): a column of stacked round puffs that rises from
// the bottom-left of the box and leans right as it widens. Every puff hides the one behind it and
// carries a crescent of fine hatching on its right (shaded) side. The box bottom is the vent.
import { type Pt, type SvgNode, hatch, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

const circle = (cx: number, cy: number, r: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92] as Pt
  })

export const plumeA: KitModule = ([x, y, w, h], p) => {
  const puffs = Math.max(3, Math.round(num(p, 'puffs', 6)))
  const lean = num(p, 'lean', 0.7)
  const out: SvgNode[] = []
  // Draw from the top (back, biggest) down to the vent (front, smallest).
  for (let i = puffs - 1; i >= 0; i--) {
    const f = i / (puffs - 1)
    const r = Math.min(w, h) * (0.16 + 0.3 * f)
    const cx = x + r + (w - 2 * r) * lean * Math.pow(f, 1.4) + (i % 2 ? -1.2 : 1.2)
    const cy = y + h - r - (h - 2 * r) * Math.pow(f, 0.9)
    const ring = circle(cx, cy, r)
    out.push(occlude(ring), stroke('hair', ring, true))
    const shade: Pt[] = ring
      .filter((q) => q[0] >= cx + r * 0.2)
      .concat([[cx + r * 0.2, cy + r * 0.8]])
    const crescent: Pt[] = [...ring.filter((q) => q[0] > cx + r * 0.25 && q[1] > cy - r * 0.8)]
    if (crescent.length > 3 && shade.length > 3) out.push(...hatch(crescent, 'v', 2.6, 'fine', 0.4))
  }
  return out
}
