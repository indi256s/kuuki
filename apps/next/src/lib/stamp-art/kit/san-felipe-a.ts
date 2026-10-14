// Cartagena: Castillo San Felipe de Barajas. Three battered rampart tiers climb a hill, each with
// its own salient (shifted tier to tier so the stack zig-zags), T4 shaded faces, lit parapet tops,
// sentry boxes on the salient corners and a squat reducto tower at the summit. Low and wide.
// The box is hill plus fort; its bottom is the foot of the hill.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { garitaA, tier } from './fort-a'
import type { KitModule } from './util'

export const sanFelipeA: KitModule = ([x, y, w, h]) => {
  const X = (u: number) => x + w * u
  const base = y + h
  const out: SvgNode[] = []
  // Hill: climbs from the left foot to a summit on the right; the tiers step up it.
  const hill: Pt[] = [
    [x, base],
    [x, base - 4],
    [X(0.03), base - 9],
    [X(0.2), base - 27],
    [X(0.38), base - 43],
    [X(0.7), base - 56],
    [X(0.97), base - 46],
    [x + w, base - 36],
    [x + w, base],
  ]
  out.push(occlude(hill), ...toneFill(hill, 'T2', { angle: -62, gap: 3.0 }))
  out.push(stroke('line', hill.slice(1, -1)))
  const spec = [
    { x0: X(0.03), x1: X(0.68), yb: base - 8, h: 17, salient: 0.4 },
    { x0: X(0.2), x1: X(0.84), yb: base - 26, h: 15, salient: 0.62 },
    { x0: X(0.38), x1: X(0.97), yb: base - 42, h: 13, salient: 0.46 },
  ]
  const tops: number[] = []
  spec.forEach((s, i) => {
    const t = tier({ x0: s.x0, x1: s.x1, yb: s.yb, yt: s.yb - s.h, salient: s.salient })
    out.push(...t.nodes)
    out.push(...garitaA(t.saX, t.saTop + 2.2, 1))
    if (i < 2) out.push(...garitaA(s.x0 + 3.6, s.yb - s.h + 4.5, 0.8))
    tops.push(s.yb - s.h)
  })
  // Reducto: the squat tower on the top tier, lit left, shaded right, with a dark slit.
  const tx0 = X(0.66),
    tx1 = X(0.82),
    tb = tops[2] - 1.5,
    tt = y + 2
  const reducto: Pt[] = [
    [tx0, tb],
    [tx0 + 1.5, tt],
    [tx1 - 1.5, tt],
    [tx1, tb],
  ]
  out.push(...body(reducto, 'line'))
  out.push(
    ...toneFill(rectPts((tx0 + tx1) / 2 + 1, tt + 1, (tx1 - tx0) / 2 - 2, tb - tt - 1), 'T4', {
      gap: 2.2,
    }),
  )
  out.push(fill(rectPts(tx0 + 2.6, tt + 4, 2, 4)))
  out.push(hline('bold', tx0 - 1, tx1 + 1, tt))
  return out
}
