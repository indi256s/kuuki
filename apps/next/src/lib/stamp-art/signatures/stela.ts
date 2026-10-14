// HN: a row of carved stelae (Copan Great Plaza). Tall narrow slabs with a bevelled top, a carved
// panel and a shaded right edge. The box is the whole row; its bottom is the ground.
import { type Pt, type SvgNode, body, hline, rectPts, stroke, toneFill } from '../grid'
import type { KitModule } from '../kit'
import { num, nums } from '../kit/util'

export const stela: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(1, Math.round(num(p, 'count', 2)))
  const heights = nums(p, 'heights', [1, 0.8])
  const slabW = num(p, 'slabW', 9)
  const pitch = count === 1 ? 0 : (w - slabW) / (count - 1)
  const out: SvgNode[] = []
  for (let i = 0; i < count; i++) {
    const sh = h * (heights[i % heights.length] ?? 1)
    const sx = x + pitch * i
    const top = y + h - sh
    const bevel = slabW * 0.22
    const slab: Pt[] = [
      [sx, y + h],
      [sx, top + bevel],
      [sx + bevel, top],
      [sx + slabW - bevel, top],
      [sx + slabW, top + bevel],
      [sx + slabW, y + h],
    ]
    out.push(...body(slab, 'line'))
    out.push(
      ...toneFill(rectPts(sx + slabW * 0.66, top + bevel, slabW * 0.34, sh - bevel), 'T4', {
        inset: 0.4,
      }),
    )
    // Carved panel: a framed field with two glyph blocks.
    out.push(
      stroke('hair', rectPts(sx + slabW * 0.18, top + sh * 0.18, slabW * 0.44, sh * 0.5), true),
    )
    for (const f of [0.34, 0.52]) {
      out.push(hline('fine', sx + slabW * 0.26, sx + slabW * 0.54, top + sh * f))
    }
  }
  out.push(hline('bold', x - 1, x + w + 1, y + h))
  return out
}
