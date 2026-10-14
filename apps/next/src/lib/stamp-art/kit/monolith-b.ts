// A monolith: one steep-sided rock with a rounded shoulder and a near-flat crest (Zuma Rock).
// `profile` is [x fraction, y fraction] left to right over the box; the box bottom is the foot.
// The shaded right face takes long vertical streaks, the lit left face a few thin ones.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke } from '../grid'
import { type KitModule, num, pairs } from './util'

const PROFILE: Pt[] = [
  [0, 1],
  [0.06, 0.9],
  [0.12, 0.62],
  [0.2, 0.34],
  [0.3, 0.16],
  [0.42, 0.07],
  [0.56, 0.04],
  [0.7, 0.08],
  [0.82, 0.24],
  [0.9, 0.55],
  [0.95, 0.82],
  [1, 1],
]

export const monolithB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 23)))
  const base = y + h
  const prof = pairs(p, 'profile', PROFILE)
  const top: Pt[] = []
  for (let i = 0; i + 1 < prof.length; i++) {
    const a = prof[i],
      b = prof[i + 1]
    const n = Math.max(1, Math.round(Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h) / 5))
    for (let k = 0; k < n; k++) {
      const t = k / n
      top.push([
        x + w * (a[0] + (b[0] - a[0]) * t) + (k ? (rand() - 0.5) * 0.9 : 0),
        y + h * (a[1] + (b[1] - a[1]) * t),
      ])
    }
  }
  top.push([x + w * prof[prof.length - 1][0], y + h * prof[prof.length - 1][1]])
  const topAt = (px: number) => {
    let best = base
    for (let i = 0; i + 1 < top.length; i++) {
      const a = top[i],
        b = top[i + 1]
      if (a[0] <= px && px <= b[0] && b[0] > a[0])
        best = Math.min(best, a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1]))
    }
    return best
  }
  const out: SvgNode[] = [occlude([...top, [x + w, base], [x, base]])]
  const split = x + w * num(p, 'shade', 0.58)
  // Shaded face: dense streaks of staggered length from near the crest down to the foot.
  for (let px = split; px < x + w - 1.5; px += 2.1) {
    const t0 = topAt(px) + 3 + rand() * 6
    const end = base - rand() * 3
    if (end - t0 > 4)
      out.push(
        stroke('hair', [
          [px, t0],
          [px + (rand() - 0.5) * 0.8, end],
        ]),
      )
  }
  // Lit face: sparse thin streaks.
  for (let px = x + 6; px < split - 2; px += 7 + rand() * 4) {
    const t0 = topAt(px) + 5 + rand() * 12
    out.push(
      stroke('fine', [
        [px, t0],
        [px + (rand() - 0.5) * 1.2, Math.min(base - 2, t0 + 14 + rand() * 24)],
      ]),
    )
  }
  out.push(stroke('line', top))
  return out
}
