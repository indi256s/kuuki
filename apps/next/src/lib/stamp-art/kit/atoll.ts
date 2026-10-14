// Atoll module: a reef ring seen from low over the water (the Great Blue Hole). The box is the
// ring's outer ellipse. From outside in: a broken surf line on the reef crest, a paper band of
// shallows with a few fine ripples, and the deep hole as a solid fill. Water hatching stops
// outside the crest through the occluder.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, nums, num } from './util'

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 48, from = 0, to = 1): Pt[] =>
  Array.from({ length: Math.round(n * (to - from)) + 1 }, (_, i) => {
    const a = (from + ((to - from) * i) / Math.round(n * (to - from))) * Math.PI * 2
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })

export const atoll: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2
  const ry = h / 2
  const holeFrac = num(p, 'hole', 0.55)
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const out: SvgNode[] = []
  const outer = ellipse(cx, cy, rx, ry)
  out.push(occlude(outer))
  // Reef crest: broken arcs of surf, heavier on the lit upper edge.
  const arcs = Math.max(6, Math.round(num(p, 'arcs', 16)))
  for (let i = 0; i < arcs; i++) {
    const t0 = i / arcs + rand() * 0.012
    const t1 = (i + 0.72) / arcs
    out.push(stroke(i % 3 === 0 ? 'line' : 'hair', ellipse(cx, cy, rx, ry, 64, t0, t1)))
  }
  // Inner crest edge (where the reef drops to the shallows).
  const shallowK = 0.78
  for (let i = 0; i < arcs; i++) {
    const t0 = (i + 0.3) / arcs
    const t1 = (i + 0.9) / arcs
    out.push(stroke('hair', ellipse(cx, cy, rx * shallowK, ry * shallowK, 64, t0, t1)))
  }
  // Shallows: ripples on the near and far sides of the band.
  for (const k of [0.88, 0.84]) {
    for (const [a, b] of [
      [0.02, 0.2],
      [0.3, 0.46],
      [0.54, 0.72],
      [0.8, 0.98],
    ]) {
      out.push(stroke('fine', ellipse(cx, cy, rx * k, ry * k, 48, a + rand() * 0.03, b)))
    }
  }
  // Deep hole.
  const hole = ellipse(cx, cy, rx * holeFrac, ry * holeFrac)
  out.push(occlude(hole), fill(hole))
  // Optional cay: [centre x, base y, width, height] in grid units, a low sand mound on the water.
  const cay = nums(p, 'cay', [])
  if (cay.length === 4) {
    const [kx, ky, kw, kh] = cay
    const crest = quad([kx - kw / 2, ky], [kx, ky - kh * 1.9], [kx + kw / 2, ky], 14)
    out.push(occlude(crest), stroke('line', crest))
    out.push(...toneFill([...crest, [kx - kw / 2, ky]], 'T3', { gap: 2.2, inset: 0.6 }))
    out.push(hline('bold', kx - kw / 2 - 2, kx + kw / 2 + 2, ky))
  }
  return out
}
