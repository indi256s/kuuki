// Gate of the Sun: one broad stone, a carved lintel and one recessed doorway.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import type { KitModule } from './util'

export const monolithGate: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const block: Pt[] = [
    [x, base],
    [x, y],
    [x + w * 0.92, y],
    [x + w, y + 3],
    [x + w, base],
  ]
  const out: SvgNode[] = [...body(block)]
  out.push(...toneFill(rectPts(x + w * 0.87, y + 4, w * 0.13, h - 4), 'T4'))
  const dw = w * 0.24
  out.push(fill(rectPts(x + (w - dw) / 2, y + h * 0.45, dw, h * 0.55)))
  const fy = y + h * 0.12
  const fh = h * 0.26
  out.push(hline('hair', x + 3, x + w - 3, fy + fh))
  for (const side of [0, 1]) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const px = x + w * (side ? 0.61 : 0.05) + c * w * 0.08
        out.push(...toneFill(rectPts(px, fy + (r * fh) / 2, w * 0.05, fh * 0.32), 'T4', { gap: 2 }))
      }
    }
  }
  out.push(...toneFill(rectPts(x + w * 0.45, fy - 2, w * 0.1, fh + 2), 'T4'))
  out.push(
    stroke('hair', [
      [x + w * 0.73, y],
      [x + w * 0.7, y + h * 0.15],
      [x + w * 0.76, y + h * 0.26],
      [x + w * 0.72, y + h * 0.44],
    ]),
  )
  out.push(hline('bold', x - 2, x + w + 2, base))
  return out
}
