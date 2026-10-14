// Outrigger canoe on flat water (lane A, `-a` until consolidated): a slender dark hull with upswept
// ends, a float (ama) lying in front of it on two curved booms (iako), and an optional crab-claw
// sail on a short mast. The box holds the whole craft; its bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, bool, num } from './util'

export const outriggerA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  const hullTop = base - h * 0.34
  const x0 = x + w * 0.04,
    x1 = x + w * 0.96
  // Hull: lit gunwale curve over a hatched flank.
  const rim = quad([x0, hullTop - 5], [(x0 + x1) / 2, hullTop + 3.4], [x1, hullTop - 7], 18)
  const keel = quad(
    [x1 - 1.4, hullTop - 7 + 7],
    [(x0 + x1) / 2, base - 5],
    [x0 + 1.4, hullTop - 5 + 7],
    18,
  )
  const hull: Pt[] = [...rim, ...keel]
  const sail = bool(p, 'sail', true)
  if (sail) {
    // Crab-claw sail: two curved spars forming a V, lit sail between them.
    const mx = x + w * 0.56
    const my = rim[Math.round(rim.length * 0.56)][1]
    const tip: Pt = [mx - w * 0.24, y + 1]
    const clew: Pt = [mx + w * 0.22, my - h * 0.06]
    const lower: Pt[] = quad([mx - w * 0.04, my - 1], [mx + w * 0.06, (my + y) / 2 + 6], tip, 12)
    const upper: Pt[] = quad(clew, [mx + w * 0.1, (my + y) / 2], tip, 12)
    const claw: Pt[] = [...lower, ...upper.slice().reverse()]
    out.push(occlude(claw, { halo: 1.2 }), stroke('hair', claw, true))
    out.push(stroke('line', lower), stroke('line', upper))
    for (const f of [0.3, 0.5, 0.7]) {
      const a = lower[Math.round(f * (lower.length - 1))]
      const b = upper[Math.round((1 - f) * (upper.length - 1))]
      out.push(stroke('fine', [a, b]))
    }
    out.push(...toneFill(hull, 'T4', { gap: 2.4 }).slice(0, 0))
  }
  out.push(occlude(hull, { halo: 1.2 }))
  out.push(...toneFill(hull, 'T4', { angle: 90, gap: 3, weight: 'hair', inset: 0.3 }))
  out.push(stroke('line', hull, true), stroke('bold', rim))
  // Booms and float, in front of the hull and a little below it.
  const amaY = base - 2.2
  const ax0 = x + w * 0.14,
    ax1 = x + w * 0.8
  for (const f of [0.32, 0.66]) {
    const bx = x0 + (x1 - x0) * f
    const by = rim[Math.round(f * (rim.length - 1))][1] + 2
    out.push(
      stroke('line', quad([bx, by], [bx - 3, (by + amaY) / 2 - 1], [bx - 5 + f * 6, amaY - 1], 8)),
    )
  }
  const ama: Pt[] = [
    ...quad([ax0, amaY - 1.6], [(ax0 + ax1) / 2, amaY - 3.6], [ax1, amaY - 1.6], 12),
    ...quad([ax1, amaY - 1.6], [(ax0 + ax1) / 2, amaY + 3.4], [ax0, amaY - 1.6], 12).slice(1),
  ]
  out.push(...body(ama, 'line'), fill(ama))
  out.push(
    hline('fine', x + w * 0.04, x + w * 0.2, base + 4.2),
    hline('fine', x + w * 0.5, x + w * 0.9, base + 5),
  )
  return out
}
