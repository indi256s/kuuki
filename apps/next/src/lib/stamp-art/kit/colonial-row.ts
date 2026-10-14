// A row of low colonial town houses (Granada type): arcaded ground floors, shuttered upper windows,
// flat parapets, a few raised gables. The box is the whole row; its bottom is the street line.
// Alternate houses carry a mid-tone T4 wash so the row reads as separate colours.
import { mulberry32 } from '../hash'
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
import { type KitModule, num } from './util'

function arch(cx: number, base: number, half: number, rise: number): Pt[] {
  const pts: Pt[] = [[cx - half, base]]
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (Math.PI * i) / 8
    pts.push([cx + Math.cos(a) * half, base - rise - Math.sin(a) * half])
  }
  pts.push([cx + half, base])
  return pts
}

export const colonialRow: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const out: SvgNode[] = []
  let px = x
  let i = 0
  while (px < x + w - 4) {
    const hw = Math.min(x + w - px, num(p, 'minW', 26) + rand() * 9)
    const hh = h * (0.68 + rand() * 0.32)
    const top = base - hh
    const gable = i % 3 === 1
    const poly: Pt[] = gable
      ? [
          [px, base],
          [px, top + 2],
          [px + hw * 0.3, top + 2],
          [px + hw * 0.5, top - 3],
          [px + hw * 0.7, top + 2],
          [px + hw, top + 2],
          [px + hw, base],
        ]
      : [
          [px, base],
          [px, top],
          [px + hw, top],
          [px + hw, base],
        ]
    out.push(...body(poly, 'line'))
    if (i % 2 === 1)
      out.push(
        ...toneFill(rectPts(px, top + 3, hw, hh - 3), 'T4', {
          gap: 4.2,
          weight: 'fine',
          inset: 0.5,
        }),
      )
    else
      out.push(
        ...toneFill(rectPts(px + hw * 0.82, top + 3, hw * 0.18, hh - 3), 'T4', {
          gap: 2.4,
          inset: 0.4,
        }),
      )
    out.push(hline('bold', px, px + hw, top + 1.4))
    // Arcade: arches across the ground floor.
    const n = Math.max(2, Math.round(hw / 11))
    const slot = hw / n
    const rise = Math.min(8, hh * 0.3)
    for (let k = 0; k < n; k++) {
      const a = arch(px + slot * (k + 0.5), base, Math.min(4.4, slot * 0.32), rise)
      out.push(occlude(a), fill(a))
    }
    // Upper windows: one row of shuttered rectangles.
    const wy = top + 5
    for (let k = 0; k < n; k++) {
      const wx = px + slot * (k + 0.5) - 1
      if (wy + 7 < base - rise - 3)
        out.push(
          ...body(rectPts(wx - 0.8, wy, 3.6, 7), 'hair'),
          fill(rectPts(wx - 0.2, wy + 0.6, 2.4, 5.8)),
        )
    }
    if (gable)
      out.push(
        stroke('hair', [
          [px + hw * 0.5, top - 3],
          [px + hw * 0.5, top - 5],
        ]),
      )
    px += hw + 0.6
    i++
  }
  return out
}
