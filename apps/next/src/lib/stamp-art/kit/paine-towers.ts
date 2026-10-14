// Torres del Paine: three sheer granite needles of unequal height standing on a dark scree slope.
// The box bottom is the foot of the needles; the scree slope fills the lower `slope` fraction. Each
// needle is a lit left face and a shaded right face with a few vertical cracks and a ragged top.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num, nums } from './util'

export const paineTowers: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const heights = nums(p, 'heights', [0.92, 1, 0.72])
  const slope = h * num(p, 'slope', 0.26)
  const n = heights.length
  const colW = w / (n + 0.4)
  const out: SvgNode[] = []
  const slopeTop = base - slope
  // Scree skirt first: a ridge line of rubble running across the needle feet.
  const skirt: Pt[] = [[x, base]]
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    skirt.push([
      x + w * t,
      slopeTop + 2 + Math.sin(t * 9 + 1) * 2.5 + (rand() - 0.5) * 2 - Math.sin(Math.PI * t) * 3,
    ])
  }
  skirt.push([x + w, base])
  const massif: Pt[] = [[x, base]]
  const peaksAt = nums(
    p,
    'massif',
    [0.0, 0.5, 0.12, 0.62, 0.3, 0.55, 0.5, 0.68, 0.7, 0.5, 0.86, 0.6, 1, 0.45],
  )
  for (let i = 0; i + 1 < peaksAt.length; i += 2) {
    massif.push([x + w * peaksAt[i], base - h * peaksAt[i + 1] * (0.9 + rand() * 0.1)])
    if (i + 3 < peaksAt.length)
      massif.push([
        x + (w * (peaksAt[i] + peaksAt[i + 2])) / 2,
        base - h * Math.min(peaksAt[i + 1], peaksAt[i + 3]) * 0.8,
      ])
  }
  massif.push([x + w, base])
  out.push(occlude(massif, { halo: 0.8 }), stroke('hair', massif.slice(1, -1)))
  out.push(...toneFill(massif, 'T2', { gap: 2.6, inset: 0.4 }))
  for (let i = 0; i < n; i++) {
    const tall = h * heights[i]
    const top = base - tall
    const xl = x + colW * (i + 0.2) + w * 0.01
    const half = colW * num(p, 'half', 0.21)
    const cx = xl + half
    const lean = (i - 1) * 0.6
    const poly: Pt[] = [
      [cx - half * 1.5, base],
      [cx - half * 1.05, top + tall * 0.6],
      [cx - half * 0.82, top + tall * 0.2],
      [cx - half * 0.5 + lean, top + 3.5],
      [cx - half * 0.12 + lean, top + (i % 2 ? 0.4 : 1.8)],
      [cx + half * 0.3 + lean, top],
      [cx + half * 0.68 + lean, top + 3.2],
      [cx + half * 0.92, top + tall * 0.22],
      [cx + half * 1.08, top + tall * 0.55],
      [cx + half * 1.5, base],
    ]
    out.push(occlude(poly), stroke('line', poly.slice(1, -1)))
    // Shaded right face with hair verticals along the fall line.
    const split = cx + half * 0.4
    const shade: Pt[] = [
      [split + lean * 0.3, top + 2],
      poly[6],
      poly[7],
      poly[8],
      [poly[9][0] - half * 0.3, base - slope * 0.5],
      [split, base - slope * 0.5],
    ]
    out.push(...toneFill(shade, 'T4', { gap: 2.7, weight: 'hair', inset: 0.6 }))
    out.push(
      stroke('hair', [
        [split + lean * 0.3, top + 2],
        [split + lean * 0.1, top + tall * 0.4],
        [split, base - slope * 0.5],
      ]),
    )
    // Lit-face cracks.
    for (let k = 0; k < 3; k++) {
      const fx = cx - half * (0.6 - k * 0.3)
      const t0 = top + 6 + rand() * tall * 0.3
      out.push(
        stroke('fine', [
          [fx, t0],
          [fx - 0.4, t0 + 8 + rand() * tall * 0.3],
        ]),
      )
    }
    out.push(hline('hair', cx - half * 0.45 + lean, cx + half * 0.3 + lean, top + 1.8))
  }
  // Dark scree skirt over the needle feet.
  out.push(occlude(skirt))
  out.push(stroke('line', skirt.slice(1, -1)))
  out.push(...toneFill(skirt, 'T4', { gap: 3, weight: 'hair', angle: 70 }))
  return out
}
