// Mesa module: a long flat-topped table mountain (Table Mountain). The skyline comes from `ridge`
// ([x, y] fractions of the box, y from the box top). Below it a sheer cliff band is hatched in
// vertical runs (paper on the lit left, denser on the shaded right); under the cliff a talus
// skirt falls to the foot along fan-shaped fall lines. An optional cloud wipes a scalloped band
// off the cliff top (the tablecloth).
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import { type Pt, type StrokeNode, type SvgNode, occlude, quad, stroke } from '../grid'
import { type KitModule, num, nums, pairs } from './util'

/** y on a polyline sorted by x ascending. */
function yAtX(line: Pt[], x: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= x && x <= b[0])
      return b[0] === a[0] ? a[1] : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return x < line[0][0] ? line[0][1] : line[line.length - 1][1]
}

export const mesa: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const base = y + h
  const coarse = pairs(p, 'ridge', [
    [0.04, 0.5],
    [0.12, 0.1],
    [0.5, 0.0],
    [0.94, 0.12],
  ]).map(([xf, yf]): Pt => [x + w * xf, y + h * yf])
  // Skyline: the coarse points with a few deterministic kinks along the long runs.
  const sky: Pt[] = [coarse[0]]
  for (let i = 1; i < coarse.length; i++) {
    const a = coarse[i - 1],
      b = coarse[i]
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      sky.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 0.9])
    }
    sky.push(b)
  }
  const x0 = sky[0][0],
    x1 = sky[sky.length - 1][0]
  const skirt = num(p, 'skirt', 0.07) * w
  const cbf = y + h * num(p, 'cliff', 0.6)
  const cb = (px: number) => cbf + Math.sin(px * 0.21) * 1.2 + Math.sin(px * 0.07 + 1) * 1.6
  const lightEnd = x + w * num(p, 'lit', 0.3)

  // Silhouette: skyline, down the right end, talus foot, back up the left end.
  const rightFoot: Pt[] = [
    [x1 + 1, Math.max(cb(x1), sky[sky.length - 1][1] + 4)],
    [x1 + skirt, base],
  ]
  const leftFoot: Pt[] = [
    [x0 - skirt, base],
    [x0 - 1, Math.max(cb(x0), sky[0][1] + 4)],
  ]
  const silhouette: Pt[] = [...leftFoot, ...sky, ...rightFoot]
  const out: SvgNode[] = [occlude(silhouette)]

  // Cloud polygon (tablecloth): a paper band under the skyline with a scalloped lower edge.
  const cloud = nums(p, 'cloud', [])
  let cloudPoly: Pt[] | null = null
  let cloudEdge: Pt[] = []
  if (cloud.length === 3) {
    const [c0, c1, depth] = cloud
    const ca = x + w * c0,
      cbx = x + w * c1
    const top: Pt[] = []
    for (let px = ca; px <= cbx; px += 2) top.push([px, yAtX(sky, px) - 0.4])
    cloudEdge = []
    const n = Math.max(3, Math.round((cbx - ca) / 9))
    for (let i = 0; i < n; i++) {
      const sx = ca + ((cbx - ca) * i) / n
      const ex = ca + ((cbx - ca) * (i + 1)) / n
      const sy = yAtX(sky, sx) + depth + (rand() - 0.5) * 2
      const ey = yAtX(sky, ex) + depth + (rand() - 0.5) * 2
      const bulge = 3 + rand() * 2.5
      const seg = quad([sx, sy], [(sx + ex) / 2, (sy + ey) / 2 + bulge], [ex, ey], 6)
      cloudEdge.push(...(i ? seg.slice(1) : seg))
    }
    cloudPoly = [...top, ...cloudEdge.slice().reverse()]
  }

  // Cliff: vertical runs from just under the skyline down toward the cliff base, ragged at the
  // lower end so the face reads as buttresses and gullies rather than a wall of bars.
  const hatch: StrokeNode[] = []
  let k = 0
  for (let px = x0 + 1; px < x1 - 0.5; px += 2.4, k++) {
    const top = yAtX(sky, px) + 3 + rand() * 4
    const bot = cb(px)
    if (bot - top < 3) continue
    const shaded = px > lightEnd
    const len = bot - top
    if (!shaded) {
      if (k % 3 === 0)
        hatch.push(
          stroke('fine', [
            [px, top + 2],
            [px, top + len * (0.35 + rand() * 0.4)],
          ]),
        )
    } else if (k % 4 === 3) {
      hatch.push(
        stroke('fine', [
          [px, top + len * 0.15],
          [px, top + len * (0.45 + rand() * 0.3)],
        ]),
      )
    } else {
      hatch.push(
        stroke('hair', [
          [px, top],
          [px, bot - (rand() < 0.35 ? rand() * len * 0.45 : rand() * 2)],
        ]),
      )
    }
  }
  // Talus: fall lines from the cliff base to the foot, a lighter tone than the cliff, with the
  // lines starting at staggered heights.
  const cxm = (x0 + x1) / 2
  k = 0
  for (let px = x0 - skirt * 0.9; px < x1 + skirt * 0.9; px += 2.8, k++) {
    const t0 = Math.min(Math.max(px, x0), x1)
    const shaded = px > lightEnd
    if (!shaded && k % 2 === 0) continue
    const startY = cb(t0) + 2 + rand() * (base - cb(t0)) * 0.55
    const spread = (px - cxm) * 0.04
    hatch.push(
      stroke(shaded ? 'hair' : 'fine', [
        [px + spread * 0.4, startY],
        [px + spread, base],
      ]),
    )
  }
  let acc: StrokeNode[] = hatch
  if (cloudPoly) {
    const cp = cloudPoly
    acc = acc.flatMap((n) => clipStrokeOutside(n, cp))
  }
  // Keep every stroke inside the silhouette on the talus ends.
  out.push(...acc)
  if (cloudEdge.length) out.push(stroke('hair', cloudEdge))
  out.push(stroke('line', [...leftFoot.slice(1), ...sky, rightFoot[0]]))
  // Cliff base: a hair line where the sheer face meets the talus, only where there is a cliff.
  const baseLine: Pt[] = []
  for (let px = x0; px <= x1; px += 3) if (yAtX(sky, px) + 5 < cb(px)) baseLine.push([px, cb(px)])
  if (baseLine.length > 1) out.push(stroke('line', baseLine))
  return out
}
