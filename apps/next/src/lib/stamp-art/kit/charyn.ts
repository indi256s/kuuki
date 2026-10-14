// Valley of Castles: layered sandstone turrets enclosing a dry canyon floor.
import { type Pt, type SvgNode, body, hline, stroke, toneFill } from '../grid'
import type { KitModule } from './util'

export const charyn: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h,
    cx = x + w * 0.52
  const floor: Pt[] = [
    [cx - 3, y + h * 0.43],
    [cx + 3, y + h * 0.43],
    [cx + w * 0.21, base],
    [cx - w * 0.21, base],
  ]
  out.push(...body(floor, 'hair'), ...toneFill(floor, 'T1', { gap: 5 }))
  for (const side of [-1, 1]) {
    // Distant walls first; near towers grow wider and taller towards the frame edges.
    for (const [distance, width, height] of [
      [0.13, 0.12, 0.44],
      [0.25, 0.18, 0.68],
      [0.39, 0.24, 0.91],
    ]) {
      const px = cx + side * w * distance,
        bw = w * width,
        foot = base - h * (0.38 - distance * 0.7),
        top = foot - h * height
      const edge: Pt[] = [
        [px - bw * 0.5, foot],
        [px - bw * 0.42, top + 9],
        [px - bw * 0.31, top + 7],
        [px - bw * 0.28, top + 2],
        [px - bw * 0.1, top],
        [px + bw * 0.09, top + 3],
        [px + bw * 0.12, top + 8],
        [px + bw * 0.34, top + 9],
        [px + bw * 0.47, foot],
      ]
      out.push(...body(edge, 'hair'))
      const shade: Pt[] = [
        [px + bw * 0.1, top + 4],
        [px + bw * 0.12, top + 8],
        [px + bw * 0.34, top + 9],
        [px + bw * 0.47, foot],
        [px + bw * 0.08, foot],
      ]
      out.push(...toneFill(shade, 'T4', { gap: 2.4 }))
      for (let i = 1; i <= 3; i++) {
        const yy = top + ((foot - top) * i) / 4
        out.push(
          stroke('hair', [
            [px - bw * 0.38, yy],
            [px - bw * 0.12, yy - 1],
            [px + bw * 0.08, yy + 1],
          ]),
        )
      }
    }
  }
  out.push(hline('hair', cx - w * 0.2, cx + w * 0.2, base))
  return out
}
