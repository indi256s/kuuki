// Dhow: a long low hull with a raised poop and rudder at the stern (left), a high raked stem at the
// bow (right), one slanting mast carrying a big lateen sail on a long yard (low forward, high
// aft) with stitched cloth seams, and stays. The box bottom is the waterline. `detail: false`
// draws a small distant boat (no seams, rudder or stays).
import {
  type Pt,
  type SvgNode,
  body,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, bool, num } from './util'

export const dhow: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const detail = bool(p, 'detail', true)
  const k = h / 72
  const out: SvgNode[] = []
  const px = (t: number) => x + w * t
  // Hull outline.
  const S: Pt = [px(0.1), base - 24 * k]
  const B: Pt = [px(0.98), base - 36 * k]
  const top = quad(S, [px(0.5), base - 5 * k], B, 28)
  const Kp: Pt = [px(0.88), base - 1 * k]
  const stem = quad(B, [px(0.94), base - 12 * k], Kp, 10)
  const Z: Pt = [px(0.15), base - 12 * k]
  const keel = quad(Kp, [px(0.5), base + 2.2 * k], Z, 24)
  const hull: Pt[] = [...top, ...stem.slice(1), ...keel.slice(1)]
  // Sail, drawn first so the hull overlaps its foot.
  const mx = px(num(p, 'mast', 0.48))
  const deckY = base - 15 * k
  const peak: Pt = [px(0.27), y + 5]
  const tack: Pt = [px(0.74), base - 27 * k]
  const clew: Pt = [px(0.25), base - 30 * k]
  const leech = quad(peak, [px(0.22), (peak[1] + clew[1]) / 2], clew, 12)
  const foot = quad(clew, [px(0.45), clew[1] + 1.5 * k], tack, 16)
  const sail: Pt[] = [...leech, ...foot.slice(1)]
  out.push(occlude(sail, { halo: 1.2 }))
  if (detail) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8
      const a: Pt = [tack[0] + (peak[0] - tack[0]) * t, tack[1] + (peak[1] - tack[1]) * t]
      const e: Pt = [clew[0] + (peak[0] - clew[0]) * t, clew[1] + (peak[1] - clew[1]) * t]
      out.push(stroke('fine', quad(a, [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2 + 2.2 * k], e, 10)))
    }
  }
  out.push(stroke('line', sail, true))
  // Yard along the luff, mast and stays.
  out.push(stroke('bold', [tack, peak]))
  const mastTop: Pt = [px(0.5), y + h * 0.3]
  out.push(stroke('bold', [[mx, deckY], mastTop]))
  if (detail) {
    out.push(stroke('fine', [mastTop, [B[0], B[1]]]), stroke('fine', [mastTop, [S[0] + 2, S[1]]]))
  }
  // Hull: dark planking below a lit strake, bold gunwale.
  out.push(occlude(hull, { halo: 1.4 }))
  const band: Pt[] = top.map(([a, b]): Pt => [a, b + 4 * k])
  const lower: Pt[] = [...band, ...stem.slice(1), ...keel.slice(1)]
  out.push(...toneFill(lower, 'T4', { angle: 90, gap: 3, weight: 'hair', inset: 0.5 }))
  out.push(stroke('line', hull, true), stroke('bold', top))
  // Poop and rudder.
  const poop: Pt[] = [
    [px(0.1), S[1] + 0.5],
    [px(0.1), base - 32 * k],
    [px(0.29), base - 30 * k],
    [px(0.31), base - 19.5 * k],
  ]
  out.push(...body(poop, 'line'))
  if (detail) {
    out.push(...body(rectPts(Z[0] - 2.8, S[1] + 2 * k, 2.8, 20 * k), 'hair'))
  }
  // A few waterline ripples under the hull.
  const wl = [0.18, 0.42, 0.7]
  for (const t of wl) out.push(hline('hair', px(t), px(t) + w * 0.12, base + 1.2 * k))
  return out
}
