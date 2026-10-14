// Peak module: an asymmetric alpine horn (Matterhorn). Silhouette and the Hörnli ridge are fixed
// shapes scaled into the box (tip at the top, foot at the bottom). The east face (left of the
// ridge) is lit paper with strata ledges; the north face (right) is shaded with hair lines along
// the fall line, broken by white snow fields. A white glacier band sits at the foot.
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import { type Pt, type StrokeNode, type SvgNode, occlude, stroke } from '../grid'
import { type KitModule, num, xAtY } from './util'

// Silhouette (fractions of the box), left foot to right foot over a crooked tip.
const SIL: Pt[] = [
  [0.0, 1.0],
  [0.1, 0.84],
  [0.19, 0.72],
  [0.25, 0.62],
  [0.31, 0.55],
  [0.36, 0.44],
  [0.41, 0.3],
  [0.45, 0.17],
  [0.48, 0.08],
  [0.5, 0.02],
  [0.53, 0.0],
  [0.55, 0.04],
  [0.575, 0.03],
  [0.59, 0.08],
  [0.62, 0.16],
  [0.65, 0.26],
  [0.68, 0.34],
  [0.7, 0.4],
  [0.73, 0.4],
  [0.76, 0.5],
  [0.8, 0.63],
  [0.87, 0.78],
  [0.94, 0.9],
  [1.0, 1.0],
]
// Hörnli ridge: from the tip down to the foot, splitting lit east face and shaded north face.
const RIDGE: Pt[] = [
  [0.55, 0.05],
  [0.56, 0.16],
  [0.57, 0.28],
  [0.59, 0.4],
  [0.6, 0.52],
  [0.62, 0.64],
  [0.65, 0.78],
  [0.7, 0.9],
  [0.75, 1.0],
]

export const peak: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 31)))
  const crook = num(p, 'crook', 1)
  const glacier = num(p, 'glacier', 0.14)
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  // Crookedness scales the tip's lean away from the axis.
  const sil = SIL.map(([fx, fy]): Pt => at([fx + (fy < 0.12 ? (crook - 1) * 0.01 : 0), fy]))
  const ridge = RIDGE.map(at)
  const base = y + h
  const out: SvgNode[] = [occlude(sil)]
  const L = sil.slice(0, SIL.findIndex(([, fy]) => fy === 0) + 1)
  const R = sil.slice(SIL.findIndex(([, fy]) => fy === 0))
  const leftEdge = (yy: number) => xAtY(L.slice().reverse(), yy)
  const rightEdge = (yy: number) => xAtY(R, yy)
  const ridgeX = (yy: number) => xAtY(ridge, yy)

  // Snow fields and glacier: polygons that stay paper.
  const snow: Pt[][] = []
  const glY = base - h * glacier
  const gl: Pt[] = [[x, base]]
  for (let px = x + 1; px <= x + w - 1; px += 4)
    gl.push([px, glY + Math.sin(px * 0.35) * 2 + (rand() - 0.5) * 2.5])
  gl.push([x + w, base])
  snow.push(gl)
  const field = (cx: number, cy: number, rw: number, rh: number): Pt[] =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2
      const k = 0.75 + rand() * 0.35
      return [cx + Math.cos(a) * rw * k, cy + Math.sin(a) * rh * k] as Pt
    })
  // North face fields hug the ridge; east face fields sit in the lit ledges.
  for (const [fy, off, rw, rh] of [
    [0.2, 0.045, 3, 6],
    [0.36, 0.07, 4.4, 7],
    [0.5, 0.1, 5, 8],
    [0.64, 0.12, 5.5, 6],
  ] as const) {
    const yy = y + h * fy
    snow.push(field(ridgeX(yy) + w * off, yy, rw, rh))
  }

  const hatch: StrokeNode[] = []
  // North face: hair lines along the fall line, right of the ridge.
  const gx0 = x + w * 0.5
  for (let px = gx0; px < x + w; px += 2) {
    // Fall line: lean follows the right edge's local slope, converging upward toward the tip.
    const tipX = x + w * 0.55
    const pts: Pt[] = []
    for (let t = 0.04; t <= 1.0; t += 0.04) {
      const yy = y + h * t
      const lx = tipX + (px - tipX) * Math.min(1, t * 1.15)
      if (lx > ridgeX(yy) - 0.5 && lx < rightEdge(yy) - 1.2) pts.push([lx, yy])
    }
    if (pts.length < 2) continue
    hatch.push(stroke('hair', pts))
  }
  // East face: strata ledges, short fine dashes leaning slightly down to the right.
  for (let yy = y + h * 0.1; yy < glY; yy += 5 + rand() * 1.5) {
    const a = leftEdge(yy) + 3 + rand() * 4
    const b = Math.min(ridgeX(yy) - 3, a + 10 + rand() * 18)
    if (b - a > 3)
      hatch.push(
        stroke('fine', [
          [a, yy],
          [b, yy + 1.3],
        ]),
      )
    const a2 = a + (b - a) * 0.6 + 6
    const b2 = Math.min(ridgeX(yy) - 3, a2 + 8 + rand() * 8)
    if (b2 - a2 > 3)
      hatch.push(
        stroke('fine', [
          [a2, yy + 2.3],
          [b2, yy + 3.2],
        ]),
      )
  }
  let acc: StrokeNode[] = hatch
  for (const poly of snow) acc = acc.flatMap((n) => clipStrokeOutside(n, poly))
  out.push(...acc)
  // Snow edges.
  for (const poly of snow.slice(1)) out.push(stroke('fine', poly, true))
  out.push(stroke('hair', gl.slice(1, -1)))
  out.push(stroke('hair', ridge))
  out.push(stroke('line', sil))
  return out
}
