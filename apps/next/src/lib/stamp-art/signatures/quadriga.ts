// DE: the quadriga on the Brandenburg Gate, a solid T5 fan. Four horse heads notch the top, three
// leg gaps notch the bottom, and a staff with a wreath rises from the centre. No cross.
import { type Pt, type SvgNode, fill, stroke } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

/**
 * The box is the fan: its width at the top and its height; the bottom (the chariot) is `foot` of the
 * width. The staff rises `staff` times the fan height from the chariot floor, ending in a ring.
 */
export const quadriga: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const bottom = y + h
  const foot = w * num(p, 'foot', 0.56)
  const heads = 4
  const pitch = w / heads
  const out: SvgNode[] = []
  // Top edge, left to right: four horse heads on an arch (outer ones lower), a notch between each.
  const rise = [0.3, 0, 0, 0.3]
  const top: Pt[] = [[x, y + h * 0.58]]
  for (let i = 0; i < heads; i++) {
    const hx = x + pitch * (i + 0.5)
    const hy = y + h * rise[i]
    top.push(
      [hx - pitch * 0.38, hy + h * 0.42],
      [hx - pitch * 0.3, hy + 1.6],
      [hx - pitch * 0.12, hy],
      [hx + pitch * 0.12, hy],
      [hx + pitch * 0.3, hy + 1.6],
      [hx + pitch * 0.38, hy + h * 0.42],
    )
  }
  top.push([x + w, y + h * 0.58])
  // Bottom edge, right to left, with three leg gaps.
  const gaps = 3
  const bottomEdge: Pt[] = [[cx + foot / 2, bottom]]
  for (let g = gaps - 1; g >= 0; g--) {
    const gx = cx - foot / 2 + (foot * (g + 1)) / (gaps + 1)
    bottomEdge.push(
      [gx + 0.8, bottom],
      [gx + 0.8, bottom - h * 0.36],
      [gx - 0.8, bottom - h * 0.36],
      [gx - 0.8, bottom],
    )
  }
  bottomEdge.push([cx - foot / 2, bottom])
  out.push(fill([...top, ...bottomEdge]))
  // Staff and wreath above the central notch.
  const staffTop = bottom - h * num(p, 'staff', 1.3)
  const r = Math.min(2.8, w * 0.1)
  out.push(
    stroke('line', [
      [cx, y + h * 0.45],
      [cx, staffTop + r * 2],
    ]),
  )
  out.push(
    stroke(
      'hair',
      Array.from(
        { length: 14 },
        (_, i) =>
          [
            cx + r * Math.cos((i * Math.PI * 2) / 14),
            staffTop + r + r * Math.sin((i * Math.PI * 2) / 14),
          ] as Pt,
      ),
      true,
    ),
  )
  return out
}
