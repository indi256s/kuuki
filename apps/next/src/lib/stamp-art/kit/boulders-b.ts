// Smooth granite boulders heaped on a beach (Anse Source d'Argent): each boulder is a rounded
// dome with a flat footing, shaded by arcs that hug its lower-right edge. `boulders` lists
// [x fraction, width fraction, height fraction, seed] from back to front; the box bottom is the sand.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hline, occlude, stroke } from '../grid'
import { type KitModule, nums } from './util'

function dome(cx: number, base: number, a: number, b: number, seed: number): Pt[] {
  const rand = mulberry32(seed)
  const k1 = rand() * 6,
    k2 = rand() * 6
  const skew = (rand() - 0.5) * 0.7
  const pts: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * Math.PI
    const wob = 1 + 0.09 * Math.sin(3 * th + k1) + 0.04 * Math.sin(5 * th + k2)
    pts.push([
      cx + a * Math.cos(th) * wob + skew * a * Math.sin(th),
      base - b * Math.sin(th) ** 0.82 * (1 + 0.04 * Math.sin(2 * th + k2)),
    ])
  }
  return pts
}

export const bouldersB: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const spec = nums(p, 'boulders', [0.05, 0.45, 1, 3, 0.3, 0.4, 0.62, 8, 0.7, 0.24, 0.3, 5])
  const out: SvgNode[] = []
  for (let i = 0; i + 3 < spec.length; i += 4) {
    const [fx, fw, fh, seed] = [spec[i], spec[i + 1], spec[i + 2], spec[i + 3]]
    const a = (w * fw) / 2,
      b = h * fh
    const cx = x + w * fx + a
    const pts = dome(cx, base - 0.5, a, b, seed)
    const body: Pt[] = [...pts, [cx - a, base]]
    out.push(occlude(body, { halo: 1.8 }))
    // Contour shading: shifted inner domes, drawn on the right-hand side only.
    for (let k = 1; k <= 6; k++) {
      const f = 1 - k * 0.075
      const arc = dome(cx - a * 0.11 * k, base - 0.5, a * f, b * f * 0.98, seed + 1)
      const run = arc.filter((_, j) => j >= 0 && j <= 26 - k * 2)
      if (run.length > 2) out.push(stroke('fine', run))
    }
    // A crack on the lit side and a shadow wedge at the footing.
    const crackX = cx - a * 0.25
    out.push(
      stroke('fine', [
        [crackX, base - b * 0.82],
        [crackX - 1.4, base - b * 0.6],
        [crackX + 0.8, base - b * 0.42],
        [crackX - 0.6, base - b * 0.22],
      ]),
    )
    out.push(
      stroke('line', pts),
      stroke('bold', [
        [cx - a, base],
        [cx + a, base],
      ]),
    )
    out.push(
      fill([
        [cx + a * 0.55, base - 0.2],
        [cx + a * 1.04, base - 0.2],
        [cx + a * 0.9, base - 3.4],
      ]),
    )
  }
  out.push(hline('hair', x + 2, x + w * 0.2, base + 2.6))
  return out
}
