// MV: a small high-wing floatplane on twin floats on flat water, with a short jetty and a mooring
// post at the right. The box is plane plus jetty; its bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import type { KitModule } from '../kit'

export const seaplane: KitModule = ([x, y, w, h]) => {
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const poly = (pts: Pt[]) => pts.map(at)
  const out: SvgNode[] = []
  const water = y + h * 0.9
  // Far float, then struts, near float.
  const float: Pt[] = poly([
    [0.06, 0.88],
    [0.09, 0.8],
    [0.56, 0.8],
    [0.66, 0.74],
    [0.69, 0.78],
    [0.6, 0.88],
  ])
  for (const fx of [0.26, 0.5]) {
    out.push(stroke('line', [at([fx, 0.58]), at([fx - 0.02, 0.8])]))
    out.push(stroke('line', [at([fx + 0.05, 0.58]), at([fx + 0.03, 0.8])]))
  }
  out.push(...body(float, 'line'))
  out.push(...toneFill(float, 'T4', { angle: 0, gap: [1.8, 1.8], weight: 'hair', inset: 0.3 }))
  // Fuselage.
  const fus: Pt[] = poly([
    [0.7, 0.62],
    [0.69, 0.5],
    [0.62, 0.44],
    [0.4, 0.43],
    [0.14, 0.47],
    [0.03, 0.44],
    [0.03, 0.5],
    [0.14, 0.58],
    [0.4, 0.66],
    [0.62, 0.67],
  ])
  out.push(...body(fus, 'line'))
  for (const fx of [0.46, 0.53, 0.6]) out.push(fill(rectPts(...at([fx, 0.5]), 0.05 * w, 0.07 * h)))
  // Tail fin and stabiliser.
  out.push(
    ...body(
      poly([
        [0.05, 0.47],
        [0.015, 0.22],
        [0.09, 0.22],
        [0.18, 0.46],
      ]),
      'line',
    ),
  )
  out.push(
    ...body(
      poly([
        [0.0, 0.49],
        [0.2, 0.47],
        [0.2, 0.52],
        [0.0, 0.52],
      ]),
      'hair',
    ),
  )
  // High wing with struts, drawn as a slab seen from below.
  for (const fx of [0.38, 0.62]) out.push(stroke('line', [at([fx, 0.44]), at([fx + 0.06, 0.3])]))
  out.push(
    ...body(
      poly([
        [0.28, 0.3],
        [0.8, 0.3],
        [0.9, 0.2],
        [0.38, 0.2],
      ]),
      'line',
    ),
  )
  out.push(
    ...toneFill(
      poly([
        [0.55, 0.3],
        [0.8, 0.3],
        [0.9, 0.2],
        [0.65, 0.2],
      ]),
      'T4',
      { gap: [1.8, 1.8], inset: 0.2, weight: 'hair' },
    ),
  )
  // Propeller disc.
  out.push(
    fill([
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i): Pt =>
        at([
          0.705 + 0.01 * Math.cos((i / 8) * Math.PI * 2),
          0.54 + 0.17 * Math.sin((i / 8) * Math.PI * 2),
        ]),
      ),
    ]),
  )
  // Jetty at the right: planks on posts, a mooring post.
  const dy = y + h * 0.75
  out.push(...body(rectPts(x + w * 0.76, dy, w * 0.24, 2.2), 'line'))
  for (let px = x + w * 0.78; px < x + w * 0.99; px += 6)
    out.push(
      stroke('hair', [
        [px, dy + 2.2],
        [px, water],
      ]),
    )
  out.push(
    stroke('bold', [
      [x + w * 0.985, dy],
      [x + w * 0.985, dy - 7],
    ]),
  )
  out.push(hline('hair', x, x + w, water))
  return out
}
