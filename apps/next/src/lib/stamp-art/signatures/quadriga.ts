// DE: the quadriga on the Brandenburg Gate, seen from the front: a compact dark chariot block wider
// than tall, four horse necks rising from it as separate notches (the outer pair leaning outward),
// the goddess as a narrow vertical between the inner horses, and a staff ending in a small wreath
// ring above. Solid T5 except the staff and ring. No cross, no eagle.
import { type Pt, type SvgNode, fill, stroke } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

/**
 * The box is the group: its width and the height of the horses above the plinth. The staff rises
 * `staff` times that height from the chariot floor and ends in a ring.
 */
export const quadriga: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const bottom = y + h
  const blockTop = bottom - h * 0.42
  const out: SvgNode[] = []
  // Chariot block with three leg gaps cut into its foot.
  const half = w * 0.43
  const foot: Pt[] = []
  const gaps = [-0.27, 0, 0.27]
  for (let i = gaps.length - 1; i >= 0; i--) {
    const gx = cx + gaps[i] * w
    foot.push(
      [gx + 0.8, bottom],
      [gx + 0.8, bottom - h * 0.3],
      [gx - 0.8, bottom - h * 0.3],
      [gx - 0.8, bottom],
    )
  }
  out.push(
    fill([
      [cx - half, bottom],
      [cx - half, blockTop + 1.5],
      [cx - half + 2, blockTop],
      [cx + half - 2, blockTop],
      [cx + half, blockTop + 1.5],
      [cx + half, bottom],
      ...foot,
    ]),
  )
  // Four horse necks: distinct, the outer two leaning outward and a little lower.
  const neckW = w * 0.065
  for (const [o, outer] of [
    [-0.37, true],
    [-0.165, false],
    [0.165, false],
    [0.37, true],
  ] as const) {
    const base = cx + o * w
    const lean = outer ? Math.sign(o) * w * 0.08 : 0
    const top = y + (outer ? h * 0.12 : 0)
    out.push(
      fill([
        [base - neckW, blockTop + 1],
        [base - neckW * 0.7 + lean, top + 1.6],
        [base - neckW * 0.5 + lean, top],
        [base + neckW * 0.9 + lean, top],
        [base + neckW + lean, top + 1.8],
        [base + neckW, blockTop + 1],
      ]),
    )
  }
  // Goddess: a narrow vertical between the inner horses, the staff above her.
  const gw = num(p, 'figure', 2.2)
  const shoulder = bottom - h * 0.92
  out.push(
    fill([
      [cx - gw / 2, blockTop + 1],
      [cx - gw / 2, shoulder],
      [cx + gw / 2, shoulder],
      [cx + gw / 2, blockTop + 1],
    ]),
  )
  const staffTop = bottom - h * num(p, 'staff', 1.3)
  const r = Math.min(2.4, w * 0.08)
  out.push(
    stroke('line', [
      [cx, shoulder],
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
