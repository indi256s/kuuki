import { type Pt, type SvgNode, fill } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

export const kalaeFinial: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const half = (num(p, 'arms', 70) / 2) * (Math.PI / 180)
  const base = num(p, 'base', 4.4)
  const tip = num(p, 'tip', 3)
  const out: SvgNode[] = []
  for (const s of [-1, 1]) {
    const dx = s * Math.sin(half),
      dy = -Math.cos(half)
    const len = h / Math.cos(half)
    const nx = -dy,
      ny = dx
    const a: Pt = [cx, y + h]
    const b: Pt = [cx + dx * len, y + h + dy * len]
    out.push(
      fill([
        [a[0] + (nx * base) / 2, a[1] + (ny * base) / 2],
        [b[0] + (nx * tip) / 2, b[1] + (ny * tip) / 2],
        [b[0] - (nx * tip) / 2, b[1] - (ny * tip) / 2],
        [a[0] - (nx * base) / 2, a[1] - (ny * base) / 2],
      ]),
    )
  }
  return out
}
