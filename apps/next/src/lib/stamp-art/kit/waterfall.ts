// A cascade down a rock face: a lit rock mass with fine vertical streaks and a crest line, and a
// meandering ribbon of white water that widens downward, broken by bowed ledges with a shadow
// under each lip, dark rocks standing in it, and a pool of ripple lines at the foot. The box
// bottom is the foot of the falls.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const waterfall: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const base = y + h
  const poolH = h * 0.12
  const fallH = h - poolH
  const sway = num(p, 'sway', 0.1) * w
  const cxAt = (t: number) => x + w * num(p, 'axis', 0.5) + sway * Math.sin(t * 2.4 + 0.4)
  const halfAt = (t: number) => num(p, 'topHalf', 7) + num(p, 'spread', 22) * t
  const out: SvgNode[] = []
  const crest: Pt[] = []
  for (let i = 0; i <= 16; i++)
    crest.push([x + (w * i) / 16, y + h * (0.1 + 0.07 * Math.sin(i * 1.3)) + (rand() - 0.5) * 2])
  const rock: Pt[] = [...crest, [x + w, base], [x, base]]
  out.push(occlude(rock))
  out.push(
    ...toneFill(rock, 'T4', {
      gap: [num(p, 'rockGap', 3.1), num(p, 'rockGap', 3.1)],
      weight: 'fine',
    }),
  )
  out.push(stroke('line', crest))
  // Ledges across the rock, short and uneven.
  for (let k = 1; k < 7; k++) {
    const ly = y + h * 0.1 + (fallH * k) / 7
    for (let sx = x + rand() * 8; sx < x + w - 6; sx += 20 + rand() * 10)
      out.push(hline('hair', sx, sx + 12 + rand() * 10, ly + (rand() - 0.5) * 2))
  }
  // Water ribbon.
  const top = y + h * 0.1
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const yy = top + (base - poolH - top) * t
    left.push([cxAt(t) - halfAt(t), yy])
    right.push([cxAt(t) + halfAt(t), yy])
  }
  const ribbon: Pt[] = [...left, ...right.reverse()]
  out.push(occlude(ribbon, { halo: 1 }))
  out.push(stroke('line', left), stroke('line', ribbon.slice(15)))
  const steps = Math.max(2, Math.round(num(p, 'steps', 4)))
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps
    const y0 = top + (base - poolH - top) * t0
    const y1 = top + (base - poolH - top) * t1
    for (let sx = cxAt(t0) - halfAt(t0) + 2.5; sx < cxAt(t0) + halfAt(t0) - 1; sx += 2.6) {
      const f = (sx - cxAt(t0)) / halfAt(t0)
      const len = (y1 - y0) * (0.4 + rand() * 0.35)
      out.push(
        stroke('fine', [
          [sx, y0 + 1.6],
          [cxAt(t1) + f * halfAt(t1), y0 + 1.6 + len],
        ]),
      )
    }
    if (i < steps - 1) {
      const lip: Pt[] = []
      for (let k = 0; k <= 10; k++)
        lip.push([
          cxAt(t1) - halfAt(t1) + ((2 * halfAt(t1)) / 10) * k,
          y1 + 2.2 * Math.sin((Math.PI * k) / 10) + (rand() - 0.5),
        ])
      out.push(stroke('line', lip))
      for (let sx = cxAt(t1) - halfAt(t1) + 3; sx < cxAt(t1) + halfAt(t1) - 3; sx += 3.6)
        out.push(hline('hair', sx, sx + 2.4, y1 + 3.6 + rand()))
    }
  }
  // Dark rocks in the pool and ripples.
  for (let k = 0; k < 4; k++) {
    const rx = cxAt(1) - halfAt(1) * 0.9 + rand() * halfAt(1) * 1.8
    const rw = 4 + rand() * 4
    const ry = base - poolH + 1
    out.push(
      fill([
        [rx - rw / 2, ry + 3],
        [rx - rw / 4, ry - 1.4],
        [rx + rw / 4, ry - 1.6],
        [rx + rw / 2, ry + 3],
      ]),
    )
  }
  for (let k = 0; k < 3; k++) {
    const yy = base - poolH + 5 + k * 2.4
    for (let sx = x + 2 + rand() * 6; sx < x + w - 4; sx += 8 + rand() * 8)
      out.push(hline('hair', sx, sx + 4 + rand() * 7, yy))
  }
  return out
}
