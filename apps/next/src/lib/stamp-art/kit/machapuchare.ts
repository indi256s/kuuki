// Machapuchare (Nepal): the fishtail peak. A steep pyramid whose summit splits into two horns with
// a notch between them, a lit south-west face with sparse strokes and snow, a shaded north-east face
// in fall-line hatching broken by snow ledges, and terraced foothills with a dark ridge at the foot.
// The box is the whole view (tip at the top); its bottom is the ground.
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import {
  type Pt,
  type StrokeNode,
  type SvgNode,
  body,
  hline,
  quad,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

const SIL: Pt[] = [
  [0.0, 0.92],
  [0.12, 0.8],
  [0.22, 0.66],
  [0.31, 0.5],
  [0.38, 0.33],
  [0.43, 0.19],
  [0.455, 0.1],
  [0.465, 0.04],
  [0.485, 0.14],
  [0.5, 0.22],
  [0.52, 0.1],
  [0.54, 0.0],
  [0.565, 0.1],
  [0.6, 0.22],
  [0.66, 0.38],
  [0.74, 0.56],
  [0.84, 0.74],
  [1.0, 0.92],
]
// Ridge from the right horn down to the foot, dividing the lit and shaded faces.
const RIDGE: Pt[] = [
  [0.535, 0.01],
  [0.525, 0.2],
  [0.505, 0.4],
  [0.47, 0.6],
  [0.43, 0.78],
  [0.4, 0.92],
]

export const machapuchare: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 14)))
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const base = y + h
  const sil = SIL.map(at)
  const ridge = RIDGE.map(at)
  const out: SvgNode[] = [...body([...sil, [x + w, base], [x, base]], 'line').slice(0, 1)]
  const hornIdx = SIL.findIndex(([, fy]) => fy === 0)
  // Shaded face: ridge down to the foot, right skyline back up.
  const shade: Pt[] = [...ridge, [x + w, y + h * 0.92], ...sil.slice(hornIdx + 1).reverse()]
  let hatch: StrokeNode[] = toneFill(shade, 'T4', {
    angle: 76,
    gap: [3.3, 3.3],
    inset: 0.3,
  }) as StrokeNode[]
  // Snow ledges on the shaded face (paper lenses).
  const snow: Pt[][] = []
  for (const [fy, f0, f1, th] of [
    [0.16, 0.0, 0.85, 3.2],
    [0.3, 0.1, 0.9, 3.8],
    [0.45, 0.0, 0.8, 4],
    [0.6, 0.2, 0.9, 3.6],
  ] as const) {
    const yy = y + h * fy
    const xl =
      x + w * (RIDGE[0][0] + (RIDGE[RIDGE.length - 1][0] - RIDGE[0][0]) * ((fy - 0.01) / 0.91)) + 2
    let xr = xl + 4
    for (let i = hornIdx; i + 1 < SIL.length; i++) {
      const [ax, ay] = SIL[i],
        [bx2, by] = SIL[i + 1]
      if (ay <= fy && fy <= by) xr = x + w * (ax + ((fy - ay) / (by - ay || 1)) * (bx2 - ax))
    }
    const a = xl + (xr - xl) * f0 + 1
    const b = xl + (xr - xl) * f1 - 1
    if (b - a > 4)
      snow.push([
        ...quad([a, yy], [(a + b) / 2, yy - th], [b, yy - 0.5], 6),
        ...quad([b, yy - 0.5], [(a + b) / 2, yy + th * 0.4], [a, yy], 6).slice(1),
      ])
  }
  for (const poly of snow) hatch = hatch.flatMap((n) => clipStrokeOutside(n, poly))
  out.push(...hatch)
  for (const poly of snow) out.push(stroke('fine', poly, true))
  // Lit face: sparse strata ticks low down, white above.
  for (let fy = 0.5; fy < 0.88; fy += 0.05 + rand() * 0.02) {
    let left = 0.3
    for (let i = 0; i < hornIdx; i++) {
      const [ax, ay] = SIL[i],
        [bx2, by] = SIL[i + 1]
      if (ay >= fy && fy >= by) left = ax + ((fy - ay) / (by - ay || 1)) * (bx2 - ax)
    }
    const a = x + w * left + 3
    const b = Math.min(a + 6 + rand() * 9, at([0.5 - (fy - 0.5) * 0.3, 0])[0])
    if (b - a > 3)
      out.push(
        stroke('fine', [
          [a, y + h * fy],
          [b, y + h * fy + 1],
        ]),
      )
  }
  // Lit face: fall-line ribs from the left horn, broken, below the snowfield.
  const horn = at([0.465, 0.05])
  for (let k = 0; k < 7; k++) {
    const bx = x + w * (0.09 + k * 0.05)
    const pts: Pt[] = []
    const t0 = 0.34 + (k % 3) * 0.12
    for (let t = t0; t <= 1; t += 0.04) {
      const px = horn[0] + (bx - horn[0]) * Math.pow(t, 1.15)
      const py = horn[1] + (y + h * 0.9 - horn[1]) * t
      if (px > x + w * 0.0) pts.push([px, py])
    }
    if (pts.length > 2) out.push(stroke('fine', pts))
  }
  out.push(stroke('line', ridge))
  out.push(stroke('line', sil))
  // Foothills: a rolling dark ridge with terrace lines across the foot.
  const foot: Pt[] = []
  for (let q = x; q <= x + w + 0.01; q += 4)
    foot.push([
      q,
      y + h * 0.9 + Math.sin(q * 0.17) * 1.6 + (q < x + w / 2 ? (x + w / 2 - q) * 0.03 : 0),
    ])
  const band: Pt[] = [...foot, [x + w, base], [x, base]]
  out.push(...body(band, 'hair'))
  out.push(...toneFill(band, 'T4', { gap: [3, 3], inset: 0.3 }))
  out.push(hline('bold', x, x + w, base))
  return out
}
