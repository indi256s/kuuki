// Dogon granaries: clay cylinders under pointed thatch caps, in a loose staggered cluster at the
// foot of a cliff. Entries are [x fraction, scale, row]; row 1 sits behind row 0. Box bottom is
// the ground.
import { mulberry32 } from '../hash'
import { type SvgNode, body, fill, hatch, rectPts, stroke } from '../grid'
import { type KitModule } from './util'
import { thatchCone } from './tata-somba'

export const granaries: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(7)
  const list = (Array.isArray(p.items) ? p.items : []) as [number, number, number][]
  const base = y + h
  const out: SvgNode[] = []
  const ordered = [...list].sort((a, b) => b[2] - a[2])
  for (const [f, s, row] of ordered) {
    const cx = x + w * f
    const gb = base - row * 5
    const bw = 10 * s
    const bh = 10 * s
    out.push(...body(rectPts(cx - bw / 2, gb - bh, bw, bh), 'line'))
    out.push(...hatch(rectPts(cx + bw * 0.1, gb - bh + 1, bw * 0.4, bh - 1), 'v', 2.4, 'hair', 0.6))
    out.push(fill(rectPts(cx - bw * 0.22, gb - bh * 0.62, bw * 0.28, bh * 0.28)))
    out.push(...thatchCone(cx, gb - bh, bw + 4 * s, 11 * s))
    out.push(
      stroke('hair', [
        [cx - bw / 2 - 1, gb + 0.4 + rand() * 0.2],
        [cx + bw / 2 + 1, gb + 0.4],
      ]),
    )
  }
  return out
}
