// An old olive tree: a gnarled twin trunk (T4 with paper highlights) splitting low, under a wide
// low crown drawn as a hatched mass with no contour. The crown is lit paper with a leaf-tick top,
// hatching thickens towards its underside, and a T4 band closes the underside. The box is the
// whole tree: the crown takes the top 56% of the height, the trunk base sits on the box bottom.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { type Blob, crownPoly, hatchMass } from './mass-b'
import { type KitModule, num } from './util'

export const oliveB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const crownH = h * num(p, 'crown', 0.56)
  const crownBase = y + crownH
  const cx = x + w / 2
  const out: SvgNode[] = []

  // Crown: five wide overlapping lobes, flat underneath.
  const blobs: Blob[] = [
    [x + w * 0.2, crownBase - crownH * 0.34, w * 0.2, crownH * 0.4],
    [x + w * 0.38, crownBase - crownH * 0.52, w * 0.22, crownH * 0.52],
    [x + w * 0.58, crownBase - crownH * 0.56, w * 0.23, crownH * 0.56],
    [x + w * 0.78, crownBase - crownH * 0.42, w * 0.2, crownH * 0.44],
    [x + w * 0.5, crownBase - crownH * 0.3, w * 0.46, crownH * 0.34],
  ]
  const crown = crownPoly(blobs, x + w * 0.02, x + w * 0.98, crownBase)
  const under = crown.map(([px, py], i) =>
    i === 0 || i === crown.length - 1 ? ([px, py + 2] as Pt) : ([px, py] as Pt),
  )

  // Twin trunk, drawn first so the crown overlaps the tops of the limbs.
  const wob = (k: number) => (rand() - 0.5) * k
  const limb = (side: -1 | 1): { l: Pt[]; r: Pt[] } => {
    const l: Pt[] = [],
      r: Pt[] = []
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const yy = base - (base - crownBase + 6) * t
      const c = cx + side * (3 + 13 * t ** 1.3) + Math.sin(t * 5 + side) * 1.6
      const half = 5.6 - 2.3 * t + (t < 0.18 ? 3 * (0.18 - t) * 5 : 0)
      l.push([c - half + wob(0.8), yy])
      r.push([c + half + wob(0.8), yy])
    }
    return { l, r }
  }
  const A = limb(-1),
    B = limb(1)
  out.push(occlude(under, { halo: 1.4 }))
  for (const t of [A, B]) {
    const poly: Pt[] = [...t.l, ...t.r.slice().reverse()]
    out.push(occlude(poly, { halo: 0.8 }))
    // Shaded right two thirds, a paper highlight left; one gnarl crack on the lit part.
    const shade: Pt[] = [
      ...t.l.map(([px, py], i) => [px + (t.r[i][0] - px) * 0.38, py] as Pt),
      ...t.r.slice().reverse(),
    ]
    out.push(...toneFill(shade, 'T4', { angle: 86, gap: 1.8, weight: 'fine', inset: 0.2 }))
    out.push(stroke('line', t.l), stroke('line', t.r))
    out.push(stroke('fine', [t.l[3], [t.l[3][0] + 2.2, t.l[4][1] + 1], [t.l[4][0] + 2, t.l[5][1]]]))
  }
  // Root flare and fork: the two limbs meet in a shared base.
  out.push(
    stroke('line', [
      [cx - 17, base],
      [cx - 8, base - 5],
      [cx - 1, base - 11],
    ]),
    stroke('line', [
      [cx + 17, base],
      [cx + 8, base - 5],
      [cx + 1, base - 11],
    ]),
  )

  // Crown mass: hatching kept only where the shade field is high (lit upper left stays paper).
  out.push(occlude(under, { halo: 1.6 }))
  out.push(
    ...hatchMass(under, rand, {
      angle: -64,
      gap: 2.1,
      weight: 'fine',
      thr: 0.5,
      wx: 0.45,
      wy: 0.7,
    }),
  )
  // Leaf ticks along the top edge.
  for (let i = 3; i < crown.length - 3; i += 2) {
    const [px, py] = crown[i]
    const nx = px - cx
    out.push(
      stroke('fine', [
        [px, py + 0.4],
        [px + Math.sign(nx || 1) * 1.4 + wob(0.6), py - 2.4 - rand() * 1.4],
      ]),
    )
  }
  // T4 underside: a ragged dense band under the crown.
  const band: Pt[] = [
    ...Array.from({ length: 18 }, (_, i): Pt => [
      x + w * 0.06 + (w * 0.88 * i) / 17,
      crownBase - 5 + wob(2.5),
    ]),
    ...Array.from({ length: 18 }, (_, i): Pt => [
      x + w * 0.94 - (w * 0.88 * i) / 17,
      crownBase + 1.5 + wob(1.2),
    ]),
  ]
  out.push(...toneFill(band, 'T4', { angle: 80, gap: 1.8, weight: 'fine', inset: 0.2 }))
  return out
}
