// Palm module: a leaning trunk with ring ticks and a crown of arched, drooping fronds. Each frond is
// a spine on a ballistic arc (up and out, then falling) with leaflet ticks hanging off it; the
// crown core is a small solid. The box is the tree (ground at its bottom); `lean` shifts the crown
// sideways as a fraction of the width. Fronds clear the hatching behind them, so the crown reads as
// a lit shape of dark ticks, never a solid bat wing.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

const GRAVITY = 0.56

export const palm: KitModule = ([x, y, w, h], p) => {
  const lean = num(p, 'lean', 0.15)
  const count = Math.max(6, Math.min(9, Math.round(num(p, 'fronds', 7))))
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const trunkW = num(p, 'trunkW', Math.max(2.4, w * 0.07))
  const frondLen = w * num(p, 'frond', 0.62)
  const baseX = x + w / 2 - w * lean * 0.5
  const crown: Pt = [x + w / 2 + w * lean * 0.5, y + frondLen * 0.42]
  const out: SvgNode[] = []
  // Trunk: a bowed ribbon, tapering to the crown, ring ticks across it.
  const mid: Pt = [baseX + (crown[0] - baseX) * 0.3, y + h * 0.55]
  const spine = quad([baseX, y + h], mid, crown, 14)
  const left: Pt[] = spine.map(([px, py], i) => [px - (trunkW / 2) * (1 - (i / 14) * 0.4), py])
  const right: Pt[] = spine.map(([px, py], i) => [px + (trunkW / 2) * (1 - (i / 14) * 0.4), py])
  out.push(...body([...left, ...right.slice().reverse()], 'hair'))
  for (let i = 2; i < 14; i += 2) {
    const [lx, ly] = left[i]
    const [rx] = right[i]
    out.push(
      stroke('fine', [
        [lx, ly],
        [rx, ly + 0.6],
      ]),
    )
  }
  // Fronds: left horizontal-and-below, over the top, right horizontal-and-below.
  const tickWeight = 'hair'
  const spineWeight = 'line'
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const a = Math.PI * (0.88 + 1.24 * t) + (rand() - 0.5) * 0.14
    const vx = Math.cos(a)
    const vy = Math.sin(a)
    const len = frondLen * (0.7 + 0.2 * Math.abs(vx)) * (0.92 + rand() * 0.16)
    const at = (s: number): Pt => [
      crown[0] + len * vx * s,
      crown[1] + len * (vy * s + GRAVITY * s * s),
    ]
    const n = 10
    const spineLine: Pt[] = Array.from({ length: n + 1 }, (_, k) => at(k / n))
    out.push(stroke(spineWeight, spineLine))
    // Leaflets hang from the spine, longest at mid-frond, shortening to the tip.
    const step = Math.max(2.4, len / 6.5)
    const tips: Pt[] = []
    const roots: Pt[] = []
    const ticks: SvgNode[] = []
    for (let d = step * 0.9; d < len * 0.97; d += step) {
      const s = d / len
      const [px, py] = at(s)
      const tx = vx
      const ty = vy + 2 * GRAVITY * s
      const tl = Math.hypot(tx, ty) || 1
      const dx = (tx / tl) * 0.3
      const dy = 0.9
      const dl = Math.hypot(dx, dy)
      const leaf = len * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.7)
      const end: Pt = [px + (dx / dl) * leaf, py + (dy / dl) * leaf]
      tips.push(end)
      roots.push([px, py])
      ticks.push(stroke(tickWeight, [[px, py], end]))
    }
    // The crown clears the hatching behind it in short chunks: foliage is texture, not a lit mass.
    for (let k = 0; k + 1 < tips.length; k++) {
      const [x0, y0] = roots[k]
      const [x1, y1] = roots[k + 1]
      out.push(occlude([[x0, y0 - 1.2], [x1, y1 - 1.2], tips[k + 1], tips[k]]))
    }
    out.push(...ticks)
  }
  // Core: where the fronds meet.
  const r = Math.max(1.4, frondLen * 0.07)
  out.push(
    fill([
      [crown[0] - r, crown[1]],
      [crown[0] - r * 0.5, crown[1] - r * 0.9],
      [crown[0] + r * 0.5, crown[1] - r * 0.9],
      [crown[0] + r, crown[1]],
      [crown[0] + r * 0.5, crown[1] + r * 0.9],
      [crown[0] - r * 0.5, crown[1] + r * 0.9],
    ]),
  )
  return out
}
