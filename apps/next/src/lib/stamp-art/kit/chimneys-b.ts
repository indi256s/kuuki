// Lake Abbe travertine chimneys: slender rounded columns of uneven height on a flat plain, each
// with a lit left side, a fluted shaded right side, a few banding lines and a rubble foot; thin
// steam wisps curl from the tallest tops. The box bottom is the plain.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num, nums } from './util'

export const chimneysB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  // [centre, width, height] fractions, drawn back to front by listed order.
  const spec = nums(
    p,
    'chimneys',
    [
      0.12, 0.1, 0.5, 0.88, 0.11, 0.56, 0.3, 0.13, 0.78, 0.7, 0.12, 0.7, 0.5, 0.16, 0.88, 0.2, 0.1,
      0.36, 0.8, 0.09, 0.42,
    ],
  )
  const out: SvgNode[] = []
  for (let i = 0; i + 2 < spec.length; i += 3) {
    const cx = x + spec[i] * w
    const cw = spec[i + 1] * w
    const top = base - spec[i + 2] * h
    const left: Pt[] = [],
      right: Pt[] = []
    const N = 10
    for (let k = 0; k <= N; k++) {
      const t = k / N
      const half = (cw / 2) * (0.62 + 0.38 * t ** 1.6) + (k % 2 ? 0.6 : -0.3) + rand() * 0.5
      const yy = top + 3 + (base - 2 - top - 3) * t
      left.push([cx - half, yy])
      right.push([cx + half, yy])
    }
    const crown = quad(left[0], [cx, top - 2], right[0], 8)
    const body: Pt[] = [
      ...left.slice().reverse(),
      ...crown.slice(1),
      ...right.slice(1),
      [cx + cw * 0.9, base],
      [cx - cw * 0.9, base],
    ]
    out.push(occlude(body))
    out.push(stroke('line', [...left.slice().reverse(), ...crown.slice(1), ...right.slice(1)]))
    const shade: Pt[] = [
      [cx + cw * 0.04, top + 2],
      ...right,
      [cx + cw * 0.5, base - 2],
      [cx + cw * 0.05, base - 2],
    ]
    out.push(...toneFill(shade, 'T4', { angle: 90, gap: 1.7, weight: 'fine', inset: 0.5 }))
    for (let by = top + 8; by < base - 6; by += 7 + rand() * 4)
      out.push(
        stroke('fine', [
          [cx - cw * 0.45, by],
          [cx - cw * 0.05, by + 1.2],
        ]),
      )
    // Rubble foot.
    out.push(hline('hair', cx - cw * 0.95, cx + cw * 0.95, base - 1))
    if (spec[i + 2] > 0.7 && cw > 8) {
      const wisp: Pt[] = Array.from({ length: 7 }, (_, k) => [
        cx + Math.sin(k * 1.1) * 3 + k * 0.5,
        top - 2 - k * 1,
      ])
      out.push(stroke('hair', wisp))
    }
  }
  out.push(hline('bold', x, x + w, base))
  return out
}
