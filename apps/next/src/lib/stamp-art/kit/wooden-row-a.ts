// Row of tall white timber houses with steep front gables (Paramaribo). The box is the whole row,
// bottom at the ground. `n` houses of varied height share the width. Each has a dark steep gable
// roof with an attic louvre, two storeys of shuttered windows (dark shutters flanking lit panes)
// and a veranda on slim posts across the foot.
import { type Pt, type SvgNode, body, fill, hatch, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const woodenRowA: KitModule = ([x, y, w, h], p) => {
  const n = Math.max(2, Math.round(num(p, 'n', 3)))
  const base = y + h
  const heights = [0.9, 1, 0.82, 0.92]
  const out: SvgNode[] = []
  const gap = 3
  const hw = (w - gap * (n - 1)) / n
  // Draw the shorter houses first so the taller ones overlap their eaves.
  for (let i = 0; i < n; i++) {
    const hx = x + i * (hw + gap)
    const hh = h * heights[i % heights.length]
    const top = base - hh
    const roofH = hh * 0.38
    const eave = top + roofH
    const veH = hh * 0.2
    const wallB = base - 2
    // Walls.
    out.push(...body(rectPts(hx + 1.5, eave, hw - 3, wallB - eave), 'line'))
    // Steep gable roof, dark with vertical hair hatching, bold eave and a small attic louvre.
    const roof: Pt[] = [
      [hx - 1.5, eave + 0.5],
      [hx + hw / 2, top],
      [hx + hw + 1.5, eave + 0.5],
    ]
    out.push(...body(roof, 'line'))
    out.push(...toneFill(roof, 'T4', { gap: 4, inset: 0.6, weight: 'fine' }))
    out.push(hline('bold', hx - 1.5, hx + hw + 1.5, eave + 0.5))
    out.push(...body(rectPts(hx + hw / 2 - 2.4, eave - roofH * 0.4, 4.8, roofH * 0.3), 'hair'))
    // Windows: two per storey, each a shutter pair.
    const storeys = [eave + (wallB - veH - eave) * 0.12, eave + (wallB - veH - eave) * 0.56]
    const sh = (wallB - veH - eave) * 0.34
    for (const sy of storeys)
      for (const fx of [0.2, 0.62]) {
        const wx = hx + hw * fx
        const ww = hw * 0.18
        out.push(...body(rectPts(wx, sy, ww, sh), 'hair'))
        out.push(
          ...toneFill(rectPts(wx - ww * 0.42, sy, ww * 0.38, sh), 'T4', {
            gap: 2.8,
            inset: 0.1,
            weight: 'fine',
          }),
        )
        out.push(
          ...toneFill(rectPts(wx + ww * 1.04, sy, ww * 0.38, sh), 'T4', {
            gap: 2.8,
            inset: 0.1,
            weight: 'fine',
          }),
        )
      }
    // Veranda: roofline, slim posts, dark floor strip.
    const vy = wallB - veH
    out.push(...body(rectPts(hx - 0.5, vy, hw + 1, 2.2), 'line'))
    const posts = 4
    for (let k = 0; k <= posts; k++)
      out.push(
        stroke('line', [
          [hx + 1 + ((hw - 2) * k) / posts, vy + 2.2],
          [hx + 1 + ((hw - 2) * k) / posts, wallB],
        ]),
      )
    out.push(...hatch(rectPts(hx + 1.5, vy + 2.2, hw - 3, veH - 2.2 - 1), 'v', 7, 'fine', 0.3))
    out.push(fill(rectPts(hx + hw / 2 - 2.2, wallB - veH * 0.7, 4.4, veH * 0.7)))
    out.push(hline('hair', hx, hx + hw, wallB))
  }
  out.push(hline('bold', x - 2, x + w + 2, base))
  return out
}
