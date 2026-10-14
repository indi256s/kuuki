// Rock-hill module: a craggy limestone outcrop seen from the side (Acropolis, Monte Titano, the
// Rock of Gibraltar, the rock of Monaco). The top edge is a `profile` of [x, y] fractions of the
// box (left to right); the foot is the bottom of the box. The lit side is bare paper with strata
// ticks, the shaded side (right of `shadeFrom`) is hair hatching along the fall line, and `walls`
// lists [x0, x1] fractions where the face is a masonry retaining wall (lit, with courses).
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import { type Pt, type StrokeNode, type SvgNode, occlude, stroke } from '../grid'
import { type KitModule, bool, num, nums, pairs } from './util'

const DEFAULT_PROFILE: Pt[] = [
  [0, 1],
  [0.06, 0.4],
  [0.12, 0.06],
  [0.88, 0],
  [0.94, 0.4],
  [1, 1],
]

/** y of a polyline sorted by x ascending, at x. */
function yAt(line: Pt[], x: number): number {
  if (x <= line[0][0]) return line[0][1]
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (x >= a[0] && x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}

export const rockHill: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const crag = num(p, 'crag', 1)
  const base = y + h
  const coarse = pairs(p, 'profile', DEFAULT_PROFILE).map(([fx, fy]): Pt => [
    x + w * fx,
    y + h * fy,
  ])
  // Craggy edge: subdivide every ~6 units with a small deterministic wobble.
  const top: Pt[] = [coarse[0]]
  for (let i = 1; i < coarse.length; i++) {
    const a = coarse[i - 1],
      b = coarse[i]
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      top.push([
        a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 1.6 * crag,
        a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 2.2 * crag,
      ])
    }
    top.push(b)
  }
  const poly: Pt[] = [...top, [top[top.length - 1][0], base], [top[0][0], base]]
  const out: SvgNode[] = [occlude(poly)]
  const edgeY = (px: number) => {
    // Edge may fold back on steep sides: use the topmost crossing.
    let best = base
    for (let i = 0; i + 1 < top.length; i++) {
      const a = top[i],
        b = top[i + 1]
      if ((a[0] <= px && px <= b[0]) || (b[0] <= px && px <= a[0])) {
        const yy =
          a[0] === b[0]
            ? Math.min(a[1], b[1])
            : a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
        if (yy < best) best = yy
      }
    }
    return best
  }
  const shadeFrom = x + w * num(p, 'shadeFrom', 0.6)
  const shadeTo = x + w * num(p, 'shadeTo', 1.01)
  const shadeGap = num(p, 'shadeGap', 2.6)
  const hatch: StrokeNode[] = []
  // Shaded side: fall-line hairs, leaning outward a little toward the foot.
  const lean = num(p, 'lean', 0.12)
  for (let px = shadeFrom; px < Math.min(shadeTo, x + w - 0.5); px += shadeGap) {
    const ty = edgeY(px) + 2
    const bx = px + (px - shadeFrom) * lean * 0.1
    if (base - ty > 3)
      hatch.push(
        stroke('hair', [
          [px, ty],
          [bx, base],
        ]),
      )
  }
  // Lit side: strata ticks.
  const strata = num(p, 'strata', 5.5)
  for (let yy = y + 5; yy < base - 2; yy += strata + rand() * 2) {
    let px = x + 2 + rand() * 8
    while (px < x + w - 3) {
      if (px > shadeFrom - 3 && px < shadeTo) {
        px = shadeTo + 2
        continue
      }
      const len = 5 + rand() * 12
      if (yy > edgeY(px + len / 2) + 4)
        hatch.push(
          stroke('fine', [
            [px, yy],
            [px + len, yy + rand() * 1.4],
          ]),
        )
      px += len + 6 + rand() * 12
    }
  }
  // Retaining walls: lit bands below the edge with courses and staggered joints.
  const wallH = num(p, 'wallH', 12)
  const courses = Math.max(2, Math.round(num(p, 'courses', 4)))
  const wallList = nums(p, 'walls', [])
  const wallPolys: Pt[][] = []
  const wallDraw: SvgNode[] = []
  for (let i = 0; i + 1 < wallList.length; i += 2) {
    const x0 = x + w * wallList[i],
      x1 = x + w * wallList[i + 1]
    const upper: Pt[] = []
    for (let px = x0; px <= x1 + 0.01; px += 3) upper.push([px, edgeY(px) + 0.5])
    const lower: Pt[] = [...upper].reverse().map(([px, py]): Pt => [px, Math.min(base, py + wallH)])
    const wp = [...upper, ...lower]
    wallPolys.push(wp)
    for (let c = 1; c < courses; c++) {
      const line: Pt[] = upper.map(([px, py]): Pt => [px, py + (wallH * c) / courses])
      wallDraw.push(stroke('hair', line))
      for (let px = x0 + 3 + (c % 2) * 4; px < x1 - 1; px += 8) {
        const py = edgeY(px)
        wallDraw.push(
          stroke('fine', [
            [px, py + (wallH * c) / courses],
            [px, py + (wallH * (c + 1)) / courses],
          ]),
        )
      }
    }
    wallDraw.push(stroke('line', [upper[0], lower[lower.length - 1]]))
    wallDraw.push(stroke('line', [upper[upper.length - 1], lower[0]]))
    wallDraw.push(stroke('line', lower))
  }
  let acc: StrokeNode[] = hatch
  for (const wp of wallPolys) acc = acc.flatMap((n) => clipStrokeOutside(n, wp))
  out.push(...acc, ...wallDraw)
  if (bool(p, 'outline', true)) out.push(stroke('line', top))
  return out
}
