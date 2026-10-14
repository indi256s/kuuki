// A single giant ceiba: buttress roots flaring from a pale straight trunk, a wide flat umbrella
// crown drawn as a hatched mass (no contour, T4 underside), and a band of rainforest behind in a
// lighter hatch. The box is the whole tree, the base sits on the box bottom.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type Blob, canopyNodes, crownPoly, hatchMass } from './mass-b'
import { type KitModule, num } from './util'

export const ceibaB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.46)
  const wob = (k: number) => (rand() - 0.5) * k
  const out: SvgNode[] = []
  const crownBase = y + h * 0.36
  const crownH = h * 0.3

  // Rainforest behind: a lit, lacy band of masses.
  out.push(...canopyNodes(x, x + w, base, h * 0.3, rand, { crowns: Math.round(w / 12), thr: 0.42 }))

  // Trunk and buttresses.
  const trunkHalf = (t: number) => 7 + 1.6 * t // 0 at the crown, 1 at the flare
  const flareTop = base - h * 0.34
  const L: Pt[] = [],
    R: Pt[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const yy = crownBase - 2 + (flareTop - crownBase + 2) * t
    L.push([cx - trunkHalf(t) + wob(0.6), yy])
    R.push([cx + trunkHalf(t) + wob(0.6), yy])
  }
  const flareL = quad(L[8], [cx - 9, base - h * 0.12], [cx - 34, base], 10)
  const flareR = quad(R[8], [cx + 9, base - h * 0.12], [cx + 34, base], 10)
  const trunk: Pt[] = [
    ...L,
    ...flareL.slice(1),
    ...flareR.slice().reverse(),
    ...R.slice().reverse(),
  ]
  out.push(occlude(trunk, { halo: 2.2 }))
  out.push(stroke('line', [...L, ...flareL.slice(1)]), stroke('line', [...R, ...flareR.slice(1)]))
  // Shaded right half of the trunk, T4 vertical hatching.
  const shade: Pt[] = [
    [cx + 0.5, crownBase],
    ...R,
    ...flareR.slice(1),
    [cx + 2, base],
    [cx + 3.5, base - h * 0.14],
    [cx + 0.5, flareTop],
  ]
  out.push(...toneFill(shade, 'T4', { angle: 86, gap: 1.9, weight: 'fine', inset: 0.3 }))
  // Two inner buttress planks: a lit plank on the left, a dark gap beside it.
  const plankL: Pt[] = [
    [cx - 3.5, flareTop + 3],
    ...quad([cx - 3.5, flareTop + 3], [cx - 6, base - h * 0.08], [cx - 12, base], 8).slice(1),
    [cx - 2, base],
  ]
  out.push(stroke('hair', plankL.slice(0, -1)))
  out.push(
    ...toneFill([plankL[0], ...plankL.slice(1, -1), [cx - 2, base], [cx - 2, flareTop + 3]], 'T4', {
      angle: 84,
      gap: 2.2,
      weight: 'fine',
      inset: 0.3,
    }),
  )
  const plankR: Pt[] = quad([cx + 7, flareTop + 3], [cx + 14, base - h * 0.08], [cx + 20, base], 8)
  out.push(stroke('hair', plankR))
  // Bark: short horizontal ticks on the lit side.
  for (let k = 0; k < 9; k++) {
    const yy = crownBase + 6 + k * ((flareTop - crownBase - 6) / 9) + wob(2)
    const xx = cx - trunkHalf(0.5) + 1 + rand() * 3
    out.push(
      stroke('fine', [
        [xx, yy],
        [xx + 2 + rand() * 2.5, yy + wob(0.8)],
      ]),
    )
  }

  // Flat umbrella crown.
  const blobs: Blob[] = [
    [x + w * 0.16, crownBase - crownH * 0.1, w * 0.17, crownH * 0.62],
    [x + w * 0.33, crownBase - crownH * 0.26, w * 0.2, crownH * 0.78],
    [cx, crownBase - crownH * 0.36, w * 0.2, crownH * 0.9],
    [x + w * 0.67, crownBase - crownH * 0.28, w * 0.2, crownH * 0.76],
    [x + w * 0.85, crownBase - crownH * 0.1, w * 0.16, crownH * 0.6],
  ]
  const crown = crownPoly(blobs, x + w * 0.03, x + w * 0.97, crownBase)
  const rag: Pt[] = crown.map(([px, py], i) =>
    i === 0 || i === crown.length - 1 ? ([px, py + 2.5] as Pt) : ([px, py] as Pt),
  )
  out.push(occlude(rag, { halo: 1.8 }))
  out.push(
    ...hatchMass(rag, rand, { angle: -62, gap: 2.0, weight: 'fine', thr: 0.3, wx: 0.4, wy: 0.7 }),
  )
  // T4 underside band, ragged.
  const n = 20
  const band: Pt[] = [
    ...Array.from({ length: n }, (_, i): Pt => [
      x + w * 0.06 + (w * 0.88 * i) / (n - 1),
      crownBase - 4.5 + wob(2.2),
    ]),
    ...Array.from({ length: n }, (_, i): Pt => [
      x + w * 0.94 - (w * 0.88 * i) / (n - 1),
      crownBase + 2 + wob(1.2),
    ]),
  ]
  out.push(...toneFill(band, 'T4', { angle: 82, gap: 1.9, weight: 'fine', inset: 0.2 }))
  return out
}
