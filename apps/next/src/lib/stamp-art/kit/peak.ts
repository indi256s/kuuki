// Peak module: the Matterhorn seen from the north-east (Zermatt). Fixed shapes scaled into the
// box (tip at the top, foot at the bottom): a crooked summit that hooks east (left) with a notch
// on its short summit ridge, the Hörnli ridge falling from the tip as a lit edge, the shaded north
// face to its right (fall-line hairs, white snow ledges, rock bands) and the lit east face to its
// left (strata ticks), a shoulder on the right skyline and a white glacier at the foot.
import { mulberry32 } from '../hash'
import { clipStrokeOutside, pointInPoly } from '../geom'
import { type Pt, type StrokeNode, type SvgNode, occlude, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

// Silhouette, left foot to right foot over the tip.
const SIL: Pt[] = [
  [0.0, 1.0],
  [0.1, 0.9],
  [0.18, 0.8],
  [0.24, 0.68],
  [0.3, 0.56],
  [0.35, 0.44],
  [0.39, 0.32],
  [0.42, 0.2],
  [0.44, 0.1],
  [0.455, 0.03],
  [0.47, 0.0],
  [0.485, 0.025],
  [0.5, 0.05],
  [0.525, 0.075],
  [0.54, 0.06],
  [0.56, 0.12],
  [0.6, 0.21],
  [0.64, 0.3],
  [0.68, 0.36],
  [0.715, 0.35],
  [0.74, 0.4],
  [0.79, 0.52],
  [0.85, 0.66],
  [0.92, 0.82],
  [1.0, 1.0],
]
// Hörnli ridge: from the tip down to the foot on the left, lit edge between east and north face.
const RIDGE: Pt[] = [
  [0.48, 0.04],
  [0.485, 0.16],
  [0.47, 0.3],
  [0.45, 0.44],
  [0.41, 0.58],
  [0.37, 0.7],
  [0.32, 0.82],
  [0.27, 0.92],
  [0.24, 1.0],
]

export const peak: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 31)))
  const glacier = num(p, 'glacier', 0.1)
  const gap = num(p, 'gap', 3)
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const sil = SIL.map(at)
  const ridge = RIDGE.map(at)
  const base = y + h
  const tipIdx = SIL.findIndex(([, fy]) => fy === 0)
  const out: SvgNode[] = [occlude(sil)]

  // North face polygon: ridge down to the foot, then the right skyline back up to the tip.
  const northPoly: Pt[] = [...ridge, ...sil.slice(tipIdx + 1).reverse()]
  const ridgeAt = (fy: number) => {
    for (let i = 0; i + 1 < RIDGE.length; i++) {
      const [ax, ay] = RIDGE[i],
        [bx2, by] = RIDGE[i + 1]
      if (ay <= fy && fy <= by) return x + w * (ax + ((fy - ay) / (by - ay || 1)) * (bx2 - ax))
    }
    return x + w * RIDGE[RIDGE.length - 1][0]
  }
  const tip = at([0.485, 0.04])
  const hatch: StrokeNode[] = []
  const rightFoot = x + w
  const ridgeFoot = ridge[ridge.length - 1][0]
  let lineNo = 0
  for (
    let bx = ridgeFoot + (rightFoot - ridgeFoot) * num(p, 'litShare', 0.3);
    bx < rightFoot;
    bx += gap, lineNo++
  ) {
    // Fall line from the tip fanning out to the base, sampled and kept inside the face. Every
    // third line runs the whole way, the others start lower so the summit stays open.
    const pts: Pt[] = []
    const t0 = [0.03, 0.38, 0.64][lineNo % 3]
    for (let t = t0; t <= 1.001; t += 0.03) {
      const px = tip[0] + (bx - tip[0]) * Math.pow(t, 1.1)
      const py = tip[1] + (base - tip[1]) * t
      if (pointInPoly([px, py], northPoly) && px > ridgeAt((py - y) / h) + 3.2) pts.push([px, py])
    }
    if (pts.length > 1) hatch.push(stroke('hair', pts))
  }
  // East face: strata ticks, short fine dashes leaning down to the right, sparse.
  const eastLeft = (fy: number) => {
    for (let i = 0; i < tipIdx; i++) {
      const [ax, ay] = SIL[i],
        [bx2, by] = SIL[i + 1]
      if (ay >= fy && fy >= by) return x + w * (ax + ((fy - ay) / (by - ay || 1)) * (bx2 - ax))
    }
    return x
  }
  for (let fy = 0.22; fy < 0.9; fy += 0.055 + rand() * 0.02) {
    const a = eastLeft(fy) + 2.5 + rand() * 2
    const b = ridgeAt(fy) - 2
    if (b - a > 4)
      hatch.push(
        stroke('fine', [
          [a, y + h * fy],
          [Math.min(b, a + 8 + rand() * 10), y + h * fy + 1.2],
        ]),
      )
  }
  // Snow ledges on the north face (paper lenses) and the glacier at the foot (paper band).
  const snow: Pt[][] = []
  for (const [fy, f0, f1, th] of [
    [0.2, 0.0, 0.7, 2.6],
    [0.33, 0.1, 0.8, 3.4],
    [0.46, 0.0, 0.85, 3.8],
    [0.6, 0.15, 0.9, 4],
    [0.72, 0.05, 0.8, 3.6],
  ] as const) {
    const yy = y + h * fy
    // Ledge spans a share of the face width at that height.
    const xl = ridgeAt(fy) + 2
    let xr = xl
    for (let i = tipIdx; i + 1 < SIL.length; i++) {
      const [ax, ay] = SIL[i],
        [bx2, by] = SIL[i + 1]
      if (ay <= fy && fy <= by) xr = x + w * (ax + ((fy - ay) / (by - ay || 1)) * (bx2 - ax))
    }
    const a = xl + (xr - xl) * f0 + 1,
      b = xl + (xr - xl) * f1 - 1
    if (b - a > 4)
      snow.push([
        ...quad([a, yy], [(a + b) / 2, yy - th], [b, yy - 0.5], 6),
        ...quad([b, yy - 0.5], [(a + b) / 2, yy + th * 0.4], [a, yy], 6).slice(1),
      ])
  }
  const glY = base - h * glacier
  const gl: Pt[] = [[x, base]]
  for (let px = x + 1; px <= x + w - 1; px += 4)
    gl.push([px, glY + Math.sin(px * 0.3) * 1.6 + (rand() - 0.5) * 1.6])
  gl.push([x + w, base])
  snow.push(gl)
  let acc: StrokeNode[] = hatch
  for (const poly of snow) acc = acc.flatMap((n) => clipStrokeOutside(n, poly))
  out.push(...acc)
  for (const poly of snow.slice(0, -1)) out.push(stroke('fine', poly, true))
  out.push(stroke('hair', gl.slice(1, -1)))
  out.push(stroke('line', ridge))
  out.push(stroke('line', sil))
  return out
}
