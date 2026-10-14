// Ziggurat of Ur: three battered mud-brick terraces with a small shrine on top. The lowest wall is
// dark (fine vertical hatching) so the three lit stairs read against it: one straight flight and
// two that climb the facade from the corners and converge on the central landing and its gate.
// The box is the base width by the whole height; the bottom is the ground.
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
  vline,
} from '../grid'
import { type KitModule, num } from './util'

export const ziggurat: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const base = y + h
  const tw = [1, num(p, 'tier2', 0.64), num(p, 'tier3', 0.4)]
  const th = [0.44, 0.27, 0.21]
  const out: SvgNode[] = []
  let yb = base
  const tops: number[] = []
  for (let i = 0; i < 3; i++) {
    const wb = w * tw[i]
    const wt = wb * 0.93
    const yt = yb - h * th[i]
    const poly: Pt[] = [
      [cx - wb / 2, yb],
      [cx - wt / 2, yt],
      [cx + wt / 2, yt],
      [cx + wb / 2, yb],
    ]
    out.push(...body(poly, 'line'))
    if (i === 0) {
      out.push(...toneFill(poly, 'T4', { gap: 3.4, weight: 'fine', inset: 0.6 }))
    } else {
      const sh: Pt[] = [
        [cx + wb * 0.14, yb],
        [cx + wt * 0.14, yt],
        [cx + wt / 2, yt],
        [cx + wb / 2, yb],
      ]
      out.push(...toneFill(sh, 'T4', { gap: 3, weight: 'fine', inset: 0.5 }))
      // Buttress ridges on the lit part.
      const n = Math.max(2, Math.round((wb * 0.6) / 9))
      for (let k = 1; k < n; k++) {
        const t = k / n
        out.push(
          stroke('fine', [
            [cx - wb / 2 + wb * 0.64 * t + wb * 0.01, yb - 1],
            [cx - wt / 2 + wt * 0.64 * t + wt * 0.01, yt + 1],
          ]),
        )
      }
    }
    out.push(
      stroke('bold', [
        [cx - wt / 2 - 1.2, yt],
        [cx + wt / 2 + 1.2, yt],
      ]),
    )
    tops.push(yt)
    yb = yt
  }
  const y1 = tops[0]
  // Central flight and the gate above its landing.
  const central: Pt[] = [
    [cx - 0.075 * w, base],
    [cx + 0.075 * w, base],
    [cx + 0.045 * w, y1],
    [cx - 0.045 * w, y1],
  ]
  out.push(occlude(central), stroke('line', central, true))
  const treads = Math.round(num(p, 'treads', 9))
  for (let i = 1; i < treads; i++) {
    const t = i / treads
    const yy = base - (base - y1) * t
    const hw = 0.075 * w + (0.045 * w - 0.075 * w) * t
    out.push(hline('fine', cx - hw + 1.2, cx + hw - 1.2, yy))
  }
  // Side flights, mirrored.
  for (const s of [-1, 1]) {
    const A: Pt = [cx + s * 0.455 * w, base]
    const B: Pt = [cx + s * 0.335 * w, base]
    const C: Pt = [cx + s * 0.05 * w, y1 + 4]
    const D: Pt = [cx + s * 0.05 * w, y1]
    const flight: Pt[] = [A, B, C, D]
    out.push(occlude(flight), stroke('line', flight, true))
    for (let i = 1; i < treads; i++) {
      const t = i / treads
      const up: Pt = [A[0] + (D[0] - A[0]) * t, A[1] + (D[1] - A[1]) * t]
      const lo: Pt = [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t]
      out.push(stroke('fine', [up, lo]))
    }
  }
  // Gate on the second terrace, shrine on the top.
  const h2 = h * th[1]
  out.push(fill(rectPts(cx - 0.04 * w, y1 - h2 * 0.5, 0.08 * w, h2 * 0.5)))
  const topY = tops[2]
  const sw = w * 0.17
  out.push(...body(rectPts(cx - sw / 2, topY - h * 0.08, sw, h * 0.08), 'line'))
  out.push(fill(rectPts(cx - sw * 0.17, topY - h * 0.055, sw * 0.34, h * 0.055)))
  out.push(vline('hair', cx + sw * 0.34, topY - h * 0.08, topY))
  return out
}
