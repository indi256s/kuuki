// Nauru: Topside's coral-limestone pinnacle field, mined and left behind. Two rows of jagged,
// sharp-tipped needles: the back row is a dense hatched mass, the front row carries a lit left face,
// a shaded right face cut by dark fissures, and a rubble band at the foot. The box is the field;
// its bottom is the ground.
import { type Pt, type SvgNode, body, fill, hline, stroke, toneFill, vline } from '../grid'
import { mulberry32 } from '../hash'
import { type KitModule, num } from './util'

type Spire = [number, number, number] // centre fraction, base half-width fraction, height fraction

const row = (n: number, hb: number, lo: number, hi: number, shift: number): Spire[] =>
  Array.from({ length: n }, (_, i) => {
    const hf = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(i * 2.3 + shift) * Math.cos(i * 0.9 + shift))
    return [0.05 + (0.9 * i) / (n - 1), hb * (0.85 + (0.3 * ((i * 7) % 5)) / 4), hf]
  })
const BACK = row(10, 0.05, 0.45, 0.72, 0.4)
const FRONT = row(9, 0.056, 0.58, 1, 1.9)

export const topside: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const out: SvgNode[] = []
  const draw = (spires: Spire[], dark: boolean) => {
    for (const [cf, hb, hf] of spires) {
      const cx = x + w * cf
      const half = w * hb
      const top = base - h * hf
      const apex: Pt = [cx + (rand() - 0.5) * 3, top]
      const rows = 9
      const left: Pt[] = [apex]
      const right: Pt[] = [apex]
      for (let i = 1; i <= rows; i++) {
        const t = i / rows
        const yy = top + (base - top) * t
        // jagged flank: sharp at the tip, rough ledges lower down
        const prof = Math.pow(t, 0.72)
        const jl = (rand() - 0.4) * 3.4 * t
        const jr = (rand() - 0.4) * 3.4 * t
        left.push([apex[0] - half * prof - jl, yy])
        right.push([apex[0] + half * prof * (0.9 + rand() * 0.2) + jr, yy])
      }
      const pts: Pt[] = [...left, ...right.slice(1).reverse()]
      out.push(...body(pts, dark ? 'hair' : 'line'))
      const ridge = (i: number): Pt => [left[i][0] * 0.42 + right[i][0] * 0.58, left[i][1]]
      const shade: Pt[] = [
        apex,
        ...right.slice(1),
        ...Array.from({ length: rows }, (_, i) => ridge(rows - i)),
      ]
      // shaded right face: vertical hatching along the fall line
      out.push(...toneFill(shade, 'T4', { gap: 2.6, inset: 0.2 }))
      if (dark) out.push(...toneFill(pts, 'T2', { gap: 2.6, weight: 'hair', inset: 0.5 }))
      else {
        // dark fissures down the lit face
        for (const f of [0.3, 0.6]) {
          const a = Math.round(rows * f)
          const sx = left[a][0] + (right[a][0] - left[a][0]) * (0.2 + rand() * 0.25)
          out.push(
            stroke('hair', [
              [sx, left[a][1]],
              [sx + (rand() - 0.5) * 2, left[a][1] + h * 0.1],
            ]),
          )
        }
      }
    }
  }
  draw(BACK, true)
  draw(FRONT, false)
  // rubble foot: broken dark blocks across the base
  const foot: Pt[] = [[x, base]]
  for (let fx = x; fx <= x + w; fx += 4) foot.push([fx, base - 2 - rand() * 4])
  foot.push([x + w, base])
  out.push(...body(foot, 'hair'), fill(foot))
  out.push(hline('bold', x, x + w, base))
  void vline
  return out
}
