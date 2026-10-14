// Misty forest ridges (lane A, `-a` until consolidated): three rounded ridges stacked front to
// back, the highest peak behind. Each ridge hides the one behind it, carries fall-line hatching
// on its upper flank and leaves a band of paper mist at its foot. The box bottom is the foot of
// the front ridge.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const ridgesA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const peakX = num(p, 'peakX', 0.42)
  const out: SvgNode[] = []
  const layers = 3
  const n = 40
  for (let k = 0; k < layers; k++) {
    const front = k / (layers - 1)
    const baseLine = y + h * (0.52 + 0.28 * front)
    const amp = h * (0.52 - 0.2 * front)
    const c1 = k === 0 ? peakX : 0.2 + 0.5 * rand()
    const c2 = k === 0 ? 0.82 : 1 - c1 * 0.8
    const ridge: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const f = i / n
      const g1 = Math.exp(-Math.pow((f - c1) / (0.2 + 0.05 * k), 2))
      const g2 = Math.exp(-Math.pow((f - c2) / 0.16, 2)) * 0.6
      const ripple = Math.sin(f * 17 + k * 2) * 0.03
      ridge.push([
        x + w * f,
        baseLine - amp * (Math.max(g1, g2) + ripple) * (0.4 + 0.6 * (1 - front * 0.4)),
      ])
    }
    const poly: Pt[] = [...ridge, [x + w, y + h], [x, y + h]]
    out.push(occlude(poly), stroke('hair', ridge))
    const depth = h * (0.16 + 0.05 * front)
    const band: Pt[] = [
      ...ridge,
      ...[...ridge].reverse().map(([px, py]): Pt => [px, Math.min(y + h, py + depth)]),
    ]
    out.push(...toneFill(band, k === 0 ? 'T2' : 'T4', { gap: k === 0 ? [3.2, 3.2] : [3.8, 3.8] }))
  }
  return out
}
