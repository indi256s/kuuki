// Kalandula Falls: a very wide, low curtain of water over a long straight ledge, split into
// parallel streams of uneven width by dark rock piers. A tree band crowns the ledge; mist
// puffs and a rippled pool sit at the foot. The box bottom is the front of the pool.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const kalandula: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const ledge = y + h * 0.2
  const foot = y + h * 0.78
  const n = Math.max(3, Math.round(num(p, 'streams', 7)))
  const out: SvgNode[] = []
  // Rock face under the ledge, hatched dark.
  const face: Pt[] = [
    [x, ledge],
    [x + w, ledge],
    [x + w, foot],
    [x, foot],
  ]
  out.push(occlude(face), ...toneFill(face, 'T4', { gap: num(p, 'rockGap', 2.3), weight: 'hair' }))
  // Tree band above the ledge: bumpy solid crowns.
  const crowns: Pt[] = [[x, ledge + 1]]
  for (let cx = x; cx <= x + w; cx += 4) {
    const top = y + h * 0.12 + rand() * h * 0.04
    crowns.push([cx, top + 2], [cx + 2, top], [cx + 4, top + 2])
  }
  crowns.push([x + w, ledge + 1])
  out.push(occlude(crowns), fill(crowns))
  // Streams: pale ribbons that widen toward the foot.
  const slot = w / n
  const streams: { c: number; hw: number }[] = []
  for (let i = 0; i < n; i++) {
    const c = x + slot * (i + 0.5) + (rand() - 0.5) * slot * 0.3
    const hw = Math.min(slot * 0.45, slot * (0.33 + 0.1 * rand()) * (i % 3 === 1 ? 0.85 : 1.05))
    streams.push({ c, hw })
    const lft: Pt[] = [],
      rgt: Pt[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      const yy = ledge + (foot - ledge) * t
      const sway = Math.sin(t * 3 + i) * 0.8
      const half = hw * (0.85 + 0.35 * t)
      lft.push([c - half + sway, yy])
      rgt.push([c + half + sway, yy])
    }
    const ribbon: Pt[] = [...lft, ...rgt.reverse()]
    out.push(occlude(ribbon, { halo: 0.6 }))
    out.push(stroke('fine', ribbon.slice(0, 9)), stroke('fine', ribbon.slice(9)))
    for (let sx = c - hw * 0.7; sx < c + hw * 0.7; sx += 3.2) {
      const t0 = rand() * 0.3
      out.push(
        stroke('fine', [
          [sx, ledge + (foot - ledge) * t0],
          [sx + 0.4, ledge + (foot - ledge) * (t0 + 0.35 + rand() * 0.35)],
        ]),
      )
    }
  }
  out.push(hline('bold', x, x + w, ledge))
  // Pool: horizontal ripples, then mist domes at each stream foot.
  const pool: Pt[] = [
    [x, foot],
    [x + w, foot],
    [x + w, base],
    [x, base],
  ]
  out.push(occlude(pool), ...toneFill(pool, 'T3', { gap: [3.2, 2.4], weight: 'hair' }))
  out.push(hline('line', x, x + w, foot))
  for (const s of streams) {
    const r = Math.min(Math.max(s.hw * 1.8, slot * 0.42), s.c - x - 1, x + w - s.c - 1)
    const dome = quad([s.c - r, foot + 1], [s.c, foot - r * 0.9], [s.c + r, foot + 1], 10)
    out.push(occlude([...dome, [s.c + r, foot + 3], [s.c - r, foot + 3]], { halo: 0.8 }))
    out.push(stroke('hair', dome))
    out.push(
      hline('fine', s.c - r * 0.5, s.c + r * 0.5, foot - r * 0.3),
      hline('fine', s.c - r * 0.3, s.c + r * 0.3, foot - r * 0.6),
    )
  }
  return out
}
