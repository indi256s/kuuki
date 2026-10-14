// Persepolis (Iran): a long ashlar terrace wall, a wide stair rising through it between relief
// parapets, and a row of tall slender columns on top, each crowned with a double bull capital.
// Some shafts are broken to jagged stumps. The box is the whole view; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const persepolis: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 21)))
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const top = base - h * num(p, 'terrace', 0.22)
  // Columns first, so the terrace wall hides their feet.
  const heights = [0.55, 1, 0.38, 0.72, 0.46]
  const n = heights.length
  const cw = 6
  for (let i = 0; i < n; i++) {
    const px = x + w * 0.11 + (w * 0.78 * i) / (n - 1)
    const full = top - (y + h * 0.1)
    const ch = full * heights[i]
    const ty = top - ch
    if (heights[i] === 1) {
      out.push(...body(rectPts(px - cw / 2, ty + 3, cw, ch - 3 + 0.5), 'hair'))
      out.push(
        stroke('fine', [
          [px + cw * 0.12, ty + 5],
          [px + cw * 0.12, top - 1],
        ]),
      )
      out.push(
        ...toneFill(rectPts(px + cw * 0.28, ty + 4, cw * 0.22 - 0.2, ch - 4), 'T4', {
          gap: [1.5, 1.5],
          inset: 0.1,
          weight: 'hair',
        }),
      )
      // Double bull capital.
      out.push(
        fill([
          [px - 8, ty + 5],
          [px - 8, ty - 0.4],
          [px - 5.4, ty - 4.2],
          [px - 2, ty - 1],
          [px + 2, ty - 1],
          [px + 5.4, ty - 4.2],
          [px + 8, ty - 0.4],
          [px + 8, ty + 5],
        ]),
      )
    } else {
      const jag: Pt[] = [
        [px - cw / 2, top],
        [px - cw / 2, ty + 1.4],
        [px - cw * 0.2, ty - 0.6],
        [px + cw * 0.1, ty + 1.8 + rand()],
        [px + cw / 2, ty],
        [px + cw / 2, top],
      ]
      out.push(...body(jag, 'hair'))
      out.push(
        ...toneFill(rectPts(px + cw * 0.28, ty + 3, cw * 0.22 - 0.2, ch - 3), 'T4', {
          gap: [1.5, 1.5],
          inset: 0.1,
          weight: 'hair',
        }),
      )
    }
  }
  // Terrace wall.
  out.push(...body(rectPts(x, top, w, base - top), 'line'))
  for (let cy = top + 5.4; cy < base - 1; cy += 5.4) out.push(hline('fine', x + 1, x + w - 1, cy))
  out.push(
    ...toneFill(rectPts(x + w * 0.82, top + 1, w * 0.18 - 0.5, base - top - 1), 'T4', {
      gap: [3, 3],
      inset: 0.3,
    }),
  )
  out.push(hline('bold', x - 1, x + w + 1, top))
  // Stair with relief parapets.
  const sx = cx - w * 0.1
  const stair: Pt[] = [
    [sx - w * 0.15, base],
    [sx - w * 0.08, top - 0.4],
    [sx + w * 0.08, top - 0.4],
    [sx + w * 0.15, base],
  ]
  out.push(...body(stair, 'line'))
  for (let cy = top + 3.6; cy < base - 0.5; cy += 3.6) {
    const f = (cy - top) / (base - top)
    out.push(hline('fine', sx - w * (0.08 + 0.07 * f) + 1.2, sx + w * (0.08 + 0.07 * f) - 1.2, cy))
  }
  for (const s of [-1, 1]) {
    const rail: Pt[] = [
      [sx + s * w * 0.15, base],
      [sx + s * w * 0.08, top - 0.4],
      [sx + s * w * 0.08, base],
    ]
    out.push(...body(rail, 'line'))
    out.push(...toneFill(rail, 'T4', { gap: [3.2, 3.2], inset: 0.4 }))
  }
  out.push(
    stroke('bold', [
      [x, base],
      [x + w, base],
    ]),
  )
  return out
}
