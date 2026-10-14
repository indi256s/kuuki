// Cappadocia fairy chimneys: a cluster of tall tuff cones whose skirts flare into the slope, some
// capped with a dark boulder hat, others bare points. Each cone is lit on the left, shaded on the
// right in fine vertical hatching, with a few erosion grooves and one or two cave doors. The box
// bottom is the slope; the tallest cone takes the box height.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

type Cone = { x: number; w: number; h: number; cap: boolean; door: boolean }

const CONES: Cone[] = [
  { x: 0.17, w: 0.3, h: 0.46, cap: false, door: false },
  { x: 0.84, w: 0.26, h: 0.42, cap: true, door: false },
  { x: 0.28, w: 0.44, h: 0.76, cap: true, door: true },
  { x: 0.74, w: 0.4, h: 0.64, cap: true, door: false },
  { x: 0.52, w: 0.46, h: 1, cap: true, door: true },
]

function cone(c: Cone, x: number, base: number, w: number, h: number, rand: () => number) {
  const xc = x + w * c.x
  const wb = w * c.w
  const hh = h * c.h
  const top = base - hh
  const wt = wb * (c.cap ? 0.3 : 0.07)
  const capH = c.cap ? Math.max(4.5, hh * 0.085) : 0
  const bodyTop = top + capH * 0.8
  const left: Pt[] = quad(
    [xc - wb / 2, base],
    [xc - wb * 0.2, base - hh * 0.42],
    [xc - wt / 2, bodyTop],
    12,
  )
  const right: Pt[] = quad(
    [xc + wt / 2, bodyTop],
    [xc + wb * 0.2, base - hh * 0.42],
    [xc + wb / 2, base],
    12,
  )
  const poly: Pt[] = [...left, ...right]
  const out: SvgNode[] = body(poly, 'line')
  // Shaded right flank.
  const widthAt = (yy: number) => {
    const t = (base - yy) / (base - bodyTop)
    return wb * (1 - t) + wt * t
  }
  const shade: Pt[] = []
  for (let k = 0; k <= 10; k++) {
    const yy = base - ((base - bodyTop) * k) / 10
    shade.push([xc + widthAt(yy) * 0.2, yy])
  }
  const edge: Pt[] = right
    .slice()
    .reverse()
    .map(([px, py]) => [px, py] as Pt)
  out.push(
    ...toneFill([...shade, ...edge.slice(0, 0), ...right], 'T4', {
      gap: 2.6,
      weight: 'fine',
      inset: 0.5,
    }),
  )
  // Erosion grooves on the lit side.
  for (const g of [-0.28, -0.1]) {
    const gy1 = base - 3
    const gy0 = bodyTop + (base - bodyTop) * (0.3 + rand() * 0.2)
    out.push(
      stroke('fine', [
        [xc + wb * g, gy1],
        [xc + wb * g * 0.45, (gy0 + gy1) / 2],
        [xc + wb * g * 0.2, gy0],
      ]),
    )
  }
  if (c.door) {
    const dy = base - hh * 0.38
    out.push(
      fill([
        [xc - 2.2, dy],
        [xc - 2.2, dy - 3],
        [xc, dy - 5],
        [xc + 2.2, dy - 3],
        [xc + 2.2, dy],
      ]),
    )
  }
  if (c.cap) {
    // Boulder hat: wider than the neck, dark.
    const hw = Math.max(wt * 1.5, wb * 0.5)
    const hat: Pt[] = [
      ...quad([xc - hw / 2, top + capH], [xc - hw / 2 - 1, top - 1], [xc, top - 1.5], 10),
      ...quad([xc, top - 1.5], [xc + hw / 2 + 1, top - 1], [xc + hw / 2, top + capH], 10),
    ]
    out.push(...body(hat, 'line'))
    out.push(...toneFill(hat, 'T4', { gap: 1.6, weight: 'hair', inset: 0.3 }))
    out.push(hline('bold', xc - hw / 2, xc + hw / 2, top + capH))
  }
  return out
}

export const fairyChimney: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const out: SvgNode[] = []
  for (const c of CONES) out.push(...cone(c, x, base, w, h, rand))
  // Foot of the slope: a tufa skirt that ties the cones together.
  const skirt: Pt[] = [
    [x + 4, base + 3],
    [x + 4, base - 3],
  ]
  for (let t = 0; t <= 1.001; t += 0.05)
    skirt.push([x + 4 + (w - 10) * t, base - 2 + Math.sin(t * 17) * 1.6])
  skirt.push([x + w - 6, base + 3])
  out.push(occlude(skirt), ...toneFill(skirt, 'T4', { gap: 2.4, weight: 'hair', inset: 0.4 }))
  out.push(stroke('bold', skirt.slice(2, -1)))
  return out
}
