// Sandstone pinnacles (lane C): a row of tall weathered rock needles of uneven height with lit
// left faces, shaded right faces and bedding lines, plus an optional low wall between them
// (Belogradchik, BG). `spires` rows are [centre, width, height] as fractions of the box.
import { type Pt, type SvgNode, body, hatchPoly, hline, rectPts, stroke } from '../grid'
import { mulberry32 } from '../hash'
import { type KitModule, bool, num } from './util'

const SPIRES: [number, number, number][] = [
  [0.1, 0.13, 0.6],
  [0.26, 0.15, 0.92],
  [0.43, 0.12, 0.7],
  [0.6, 0.14, 1],
  [0.76, 0.12, 0.78],
  [0.91, 0.13, 0.58],
]

export const pinnacles: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const raw = p.spires
  const spires = Array.isArray(raw) ? (raw as [number, number, number][]) : SPIRES
  const out: SvgNode[] = []
  const base = y + h
  // back-to-front by height so tall needles stand behind short ones
  const order = [...spires].sort((a, b) => b[2] - a[2])
  for (const [cx, sw, sh] of order) {
    const bw = w * sw
    const px = x + w * cx
    const top = base - h * sh
    const lean = (rand() - 0.5) * 8
    const left: Pt[] = []
    const right: Pt[] = []
    const rows = 12
    for (let i = 0; i <= rows; i++) {
      const t = i / rows
      const ty = top + (base - top) * t
      // ragged taper: slender at the crown, spreading to a broad foot
      const prof = 0.34 + 0.66 * Math.pow(t, 0.85)
      const half = (bw / 2) * prof * (0.82 + rand() * 0.36)
      const sway = lean * (1 - t) + (rand() - 0.5) * 1.6
      left.push([px + sway - half, ty])
      right.push([px + sway + half * (0.9 + rand() * 0.2), ty])
    }
    const pts: Pt[] = [...left, ...right.slice().reverse()]
    out.push(...body(pts, 'line'))
    const mid = (a: Pt, b: Pt): Pt => [a[0] * 0.42 + b[0] * 0.58, a[1]]
    const shade: Pt[] = [...right.map((r, i) => mid(left[i], r)), ...right.slice().reverse()]
    out.push(...hatchPoly(shade, { angle: 90, gap: 2.2, weight: 'hair' }))
    for (let i = 2; i < rows; i += 3)
      out.push(
        stroke('hair', [
          [left[i][0] + 0.8, left[i][1]],
          [left[i][0] + (right[i][0] - left[i][0]) * 0.5, left[i][1] + 0.9],
        ]),
      )
  }
  if (bool(p, 'wall', true)) {
    const wy = base - h * 0.16
    const x0 = x + w * num(p, 'wallFrom', 0.34)
    const x1 = x + w * num(p, 'wallTo', 0.66)
    out.push(...body(rectPts(x0, wy, x1 - x0, base - wy), 'line'))
    for (let mx = x0; mx < x1 - 3; mx += 5) out.push(...body(rectPts(mx, wy - 2.2, 3, 2.2), 'hair'))
    out.push(hline('hair', x0, x1, wy + 4))
  }
  return out
}
