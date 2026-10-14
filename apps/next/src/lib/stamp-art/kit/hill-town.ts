// Albania: Berat. A hill carrying stacked rows of pale houses with close grids of tall windows,
// each row overlapping the one behind it. The box top is the hill crest (the citadel goes on top).
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke } from '../grid'
import { type KitModule, num, pairs } from './util'

export const hillTown: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const prof = pairs(p, 'profile', [
    [0, 1],
    [0.12, 0.55],
    [0.3, 0.1],
    [0.55, 0],
    [0.8, 0.35],
    [1, 1],
  ])
  const rows = Math.max(2, Math.round(num(p, 'rows', 5)))
  const hillTop: Pt[] = prof.map(([fx, fy]): Pt => [x + fx * w, y + fy * h])
  const crestX = hillTop.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
  const out: SvgNode[] = []
  const left = hillTop.filter((q) => q[0] <= crestX)
  const right = hillTop.filter((q) => q[0] >= crestX)
  const edgeX = (yy: number, side: 'l' | 'r'): number => {
    const seg = side === 'l' ? left : right
    const s = [...seg].sort((a, b) => a[1] - b[1])
    for (let i = 0; i + 1 < s.length; i++) {
      if (yy >= s[i][1] && yy <= s[i + 1][1]) {
        return s[i][0] + ((yy - s[i][1]) / (s[i + 1][1] - s[i][1] || 1)) * (s[i + 1][0] - s[i][0])
      }
    }
    return side === 'l' ? seg[0][0] : seg[seg.length - 1][0]
  }
  const poly: Pt[] = [...hillTop, [x + w, y + h], [x, y + h]]
  out.push(occlude(poly), stroke('line', hillTop))
  const rowH = (h * 0.92) / rows
  for (let r = 0; r < rows; r++) {
    const base = y + h * 0.18 + (r + 1) * rowH * 0.95
    const hh = rowH * (0.95 + (0.1 * r) / rows)
    let px = edgeX(base - hh * 0.5, 'l') + 1
    const end = edgeX(base - hh * 0.5, 'r') - 1
    while (px < end - 5) {
      const bw = Math.min(end - px, 8 + rand() * 5)
      const bh = hh * (0.7 + rand() * 0.3)
      const bx = px
      if (bw < 5) break
      out.push(...body(rectPts(bx, base - bh, bw, bh), 'hair'))
      const roof: Pt[] = [
        [bx - 0.8, base - bh],
        [bx + 1.5, base - bh - 1.9],
        [bx + bw - 1.5, base - bh - 1.9],
        [bx + bw + 0.8, base - bh],
      ]
      out.push(occlude(roof), fill(roof))
      const cols = Math.max(1, Math.floor((bw - 1) / 4.2))
      const pitch = bw / cols
      const lit = rand() > 0.3
      for (let c = 0; c < cols && lit; c++) {
        for (let k = 0; k < 1; k++) {
          const wy = base - bh + 1.6 + k * (bh / 2 - 0.4)
          if (wy + bh * 0.32 < base)
            out.push(fill(rectPts(bx + c * pitch + (pitch - 1.4) / 2, wy, 1.4, bh * 0.32)))
        }
      }
      px += bw + 0.6
    }
  }
  return out
}
