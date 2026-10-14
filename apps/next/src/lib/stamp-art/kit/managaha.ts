// MP: Managaha, a small round islet inside a wide reef ring. The box is the ring's outer ellipse
// seen low over the water: broken surf on the crest, a band of shallows hatched with fine ripples,
// and a pale lagoon floor left open for the islet (a separate island layer) to sit in. Water
// hatching stops outside the crest through the occluder.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hatchPoly, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 64,
  from = 0,
  to = 1,
): Pt[] => {
  const steps = Math.max(2, Math.round(n * (to - from)))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (from + ((to - from) * i) / steps) * Math.PI * 2
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

export const managaha: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2
  const ry = h / 2
  const out: SvgNode[] = []
  out.push(occlude(ellipse(cx, cy, rx, ry), { halo: 3 }))
  // Reef crest: bold broken surf arcs, with a second thin line just inside.
  const arcs = 14
  for (let i = 0; i < arcs; i++) {
    const t0 = i / arcs + rand() * 0.01
    out.push(stroke('line', ellipse(cx, cy, rx, ry, 64, t0, t0 + 0.78 / arcs)))
    out.push(
      stroke('hair', ellipse(cx, cy, rx * 0.93, ry * 0.9, 64, t0 + 0.2 / arcs, t0 + 0.9 / arcs)),
    )
  }
  // Shallows: a ring band of fine horizontal ripples between the crest and the lagoon floor.
  const outer = ellipse(cx, cy, rx * 0.86, ry * 0.84, 64)
  const inner = ellipse(cx, cy, rx * 0.66, ry * 0.62, 64).reverse()
  const band: Pt[] = [...outer, outer[0], inner[0], ...inner]
  out.push(...hatchPoly(band, { angle: 0, gap: 2.6, weight: 'fine', inset: 0.4 }))
  // Inner crest edge of the shallows.
  for (let i = 0; i < 9; i++) {
    const t0 = i / 9 + rand() * 0.02
    out.push(stroke('hair', ellipse(cx, cy, rx * 0.66, ry * 0.62, 64, t0, t0 + 0.07)))
  }
  return out
}
