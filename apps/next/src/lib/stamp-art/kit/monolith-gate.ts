// Monolithic gateway of a ruined temple court (Gate of the Sun type). The box is the whole front:
// a stepped base (`base`), the gate block on top with a recessed doorway, a carved frieze of small
// panels with a taller central niche, a hairline crack and a shaded right edge.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const monolithGate: KitModule = ([x, y, w, h], p) => {
  const baseH = h * num(p, 'base', 0.18)
  const gx = x + w * 0.16
  const gw = w * 0.68
  const gy = y
  const gh = h - baseH
  const out: SvgNode[] = []
  // Base: two courses of stone, the lower one wider.
  out.push(...body(rectPts(x, y + h - baseH * 0.5, w, baseH * 0.5), 'hair'))
  out.push(...body(rectPts(x + w * 0.07, y + h - baseH, w * 0.86, baseH * 0.5), 'hair'))
  out.push(hline('bold', x, x + w, y + h))
  // Gate block with a slightly broken top-right corner.
  const block: Pt[] = [
    [gx, y + h - baseH],
    [gx, gy],
    [gx + gw * 0.9, gy],
    [gx + gw, gy + gh * 0.07],
    [gx + gw, y + h - baseH],
  ]
  out.push(...body(block, 'line'))
  out.push(
    ...toneFill(rectPts(gx + gw * 0.84, gy + gh * 0.07, gw * 0.16, gh * 0.93 - 0), 'T4', {
      gap: 1.8,
      inset: 0.3,
    }),
  )
  out.push(hline('bold', gx, gx + gw, gy + 0.5))
  // Doorway: dark, with stepped notches at the top corners.
  const dw = gw * 0.3
  const dx = gx + (gw - dw) / 2
  const dTop = gy + gh * 0.5
  const door: Pt[] = [
    [dx, y + h - baseH],
    [dx, dTop + 3],
    [dx + 2, dTop + 3],
    [dx + 2, dTop],
    [dx + dw - 2, dTop],
    [dx + dw - 2, dTop + 3],
    [dx + dw, dTop + 3],
    [dx + dw, y + h - baseH],
  ]
  out.push(fill(door))
  // Frieze: rows of small framed panels either side of a central niche.
  const niche = rectPts(dx + dw * 0.18, gy + gh * 0.1, dw * 0.64, gh * 0.3)
  out.push(...body(niche, 'hair'))
  out.push(fill(rectPts(dx + dw * 0.4, gy + gh * 0.17, dw * 0.2, gh * 0.18)))
  const panel = Math.min(5, gw * 0.07)
  for (const side of [0, 1]) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const px = side === 0 ? gx + 4 + c * (panel + 2.4) : gx + gw - 4 - panel - c * (panel + 2.4)
        if (side === 1 && px + panel > gx + gw * 0.84) continue
        const py = gy + gh * 0.1 + r * (panel + 2.4)
        for (let k = 0; k < 3; k++)
          out.push(hline('fine', px, px + panel, py + 0.6 + k * (panel / 3)))
      }
    }
  }
  // Crack down the right side of the lintel.
  out.push(
    stroke('hair', [
      [dx + dw * 0.9, gy + 1],
      [dx + dw * 0.97, gy + gh * 0.2],
      [dx + dw * 0.92, gy + gh * 0.34],
      [dx + dw, dTop],
    ]),
  )
  out.push(vline('fine', gx + gw * 0.5, gy, gy))
  return out
}
