// Eruption (lane A, motif-specific): a strombolian vent. A narrow ash column rises from the bottom
// centre of the box and billows wider with height (stacked round puffs, each with a shaded crescent
// on the right), flanked by arcing lines of thrown bombs that end in small solid dots. The box
// bottom is the vent.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hatch, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

const ellipse = (cx: number, cy: number, r: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9] as Pt
  })

export const eruptionA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const puffs = Math.max(4, Math.round(num(p, 'puffs', 6)))
  const sway = num(p, 'sway', 0.18)
  const colH = h * num(p, 'column', 0.82)
  const vx = x + w / 2
  const base = y + h
  const rMax = w * num(p, 'bulb', 0.2)
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
  // Column, biggest puff (top) first so each lower puff overlaps the one above.
  for (let i = puffs - 1; i >= 0; i--) {
    const f = i / (puffs - 1)
    const r = rMax * (0.34 + 0.66 * Math.pow(f, 0.8))
    const cy = base - 2 - r - (colH - 2 * r) * Math.pow(f, 0.95)
    const cx = vx + w * sway * Math.pow(f, 1.5) + (i % 2 ? -0.9 : 0.9)
    const ring = ellipse(cx, cy, r)
    out.push(occlude(ring), stroke('hair', ring, true))
    const crescent = ring.filter((q) => q[0] > cx + r * 0.25 && q[1] > cy - r * 0.8)
    if (crescent.length > 3) out.push(...hatch(crescent, 'v', 2.4, 'hair', 0.4))
  }
  return out
}
