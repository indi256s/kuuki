// Table Mountain seen from Table Bay: Devil's Peak on the left, the dead-flat table with its sheer
// banded cliff in the middle, Lion's Head and Signal Hill falling to the sea on the right. The box
// is the whole range, its bottom the foot of the slopes. Cliff: horizontal strata in broken runs plus
// vertical gullies, the right third in shade. Slopes and talus: hatching along the fall line.
import { mulberry32 } from '../hash'
import { type Pt, type StrokeNode, type SvgNode, occlude, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

// Silhouette as [x fraction, y fraction from the top], left foot to right foot.
const SIL: Pt[] = [
  [0.0, 1.0],
  [0.015, 0.93],
  [0.04, 0.78],
  [0.065, 0.55],
  [0.08, 0.36],
  [0.092, 0.22],
  [0.103, 0.14],
  [0.115, 0.21],
  [0.127, 0.36],
  [0.14, 0.52],
  [0.155, 0.64],
  [0.175, 0.56],
  [0.19, 0.45],
  [0.197, 0.33],
  [0.206, 0.18],
  [0.216, 0.05],
  [0.232, 0.0],
  [0.785, 0.0],
  [0.798, 0.015],
  [0.806, 0.1],
  [0.814, 0.22],
  [0.823, 0.33],
  [0.832, 0.48],
  [0.848, 0.6],
  [0.862, 0.55],
  [0.876, 0.46],
  [0.89, 0.4],
  [0.902, 0.37],
  [0.914, 0.4],
  [0.928, 0.47],
  [0.95, 0.56],
  [0.97, 0.62],
  [0.985, 0.68],
  [1.0, 0.8],
  [1.0, 1.0],
]

function yAt(line: Pt[], px: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= px && px <= b[0])
      return b[0] === a[0] ? a[1] : a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}

export const tableMountain: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 23)))
  const base = y + h
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const coarse = SIL.map(at)
  // Skyline with small kinks on the peaks only; the table top stays dead flat.
  const sky: Pt[] = []
  for (let i = 0; i + 1 < coarse.length - 1; i++) {
    const a = coarse[i],
      b = coarse[i + 1]
    sky.push(a)
    const flat = a[1] === b[1]
    const steps = flat ? 1 : Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      sky.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 1.1])
    }
  }
  sky.push(coarse[coarse.length - 2])
  const silhouette: Pt[] = [...sky, coarse[coarse.length - 1], [x, base]]
  const out: SvgNode[] = [occlude(silhouette)]

  const tableL = x + w * 0.232,
    tableR = x + w * 0.785
  const topY = y
  const cliffDepth = num(p, 'cliff', 0.32) * h
  const cb = (px: number) =>
    topY + cliffDepth + Math.sin(px * 0.17) * 1.0 + Math.sin(px * 0.06) * 1.2
  const shadeFrom = x + w * num(p, 'shade', 0.62)
  const strokes: StrokeNode[] = []

  // Cliff: buttresses. Each has a lit left part (a few fine runs) and a shaded right part (vertical
  // hair lines); the shaded share grows toward the right end of the mountain.
  let bx = tableL + 1
  while (bx < tableR - 2) {
    const bw = 6 + rand() * 6
    const ex = Math.min(tableR - 0.5, bx + bw)
    const dark = 0.3 + 0.35 * ((bx - tableL) / (tableR - tableL))
    const split = ex - (ex - bx) * dark
    for (let px = split; px < ex; px += 2.2) {
      const bot = cb(px)
      strokes.push(
        stroke('hair', [
          [px, topY + 2.5 + rand() * 2],
          [px, bot - (rand() < 0.35 ? rand() * cliffDepth * 0.4 : 0)],
        ]),
      )
    }
    const len = (cb(bx) - topY - 3) * (0.35 + rand() * 0.5)
    strokes.push(
      stroke('fine', [
        [bx + 1.2, topY + 3.5],
        [bx + 1.2, topY + 3.5 + len],
      ]),
    )
    bx = ex + 1.6 + rand() * 1.4
  }
  // Strata: two broken fine bands across the face.
  for (const f of [0.38, 0.7]) {
    let cx = tableL + 1
    const yy = topY + cliffDepth * f
    while (cx < tableR - 3) {
      const ex = Math.min(tableR - 1, cx + 6 + rand() * 18)
      strokes.push(
        stroke('fine', [
          [cx, yy + (rand() - 0.5) * 0.8],
          [ex, yy + (rand() - 0.5) * 0.8],
        ]),
      )
      cx = ex + 4 + rand() * 6
    }
  }

  // Slopes under the cliff: fall lines fanning out from the cliff base to the foot.
  const axis = x + w * 0.51
  let k = 0
  for (let px = x + w * 0.17; px < x + w * 0.84; px += 2.4, k++) {
    const shaded = px > x + w * 0.5
    if (!shaded && k % 2 === 1) continue
    const sx = Math.min(tableR, Math.max(tableL, px))
    const start = cb(sx) + 1.5 + rand() * (base - cb(sx)) * 0.5
    const spread = (px - axis) * 0.07
    strokes.push(
      stroke(shaded ? 'hair' : 'fine', [
        [px + spread * 0.3, start],
        [px + spread, base],
      ]),
    )
  }

  // Peaks and ridges: fall lines from the skyline to the foot, dense on the shaded (right) side.
  const peakAxis = (axisFrac: number, from: number, to: number) => {
    const ax = x + w * axisFrac
    let n = 0
    for (let px = x + w * from; px < x + w * to; px += 2.1, n++) {
      const shaded = px > ax
      if (!shaded && n % 3 !== 0) continue
      const top = yAt(sky, px) + 2.5 + (shaded ? 0 : rand() * 4)
      const spread = (px - ax) * 0.16
      const bot = Math.min(base, top + (base - top) * (0.65 + rand() * 0.35))
      if (bot - top < 3) continue
      strokes.push(
        stroke(shaded ? 'hair' : 'fine', [
          [px, top],
          [px + spread, bot],
        ]),
      )
    }
  }
  peakAxis(0.103, 0.005, 0.2)
  peakAxis(0.902, 0.84, 0.995)

  out.push(...strokes)
  // Tablecloth: a scalloped cloud spilling over the right lip, erasing sky and cliff under it.
  if (p.cloud !== false) {
    const c0 = x + w * num(p, 'cloudFrom', 0.52),
      c1 = tableR + 1
    const n = 5
    const upper: Pt[] = []
    const lower: Pt[] = []
    for (let i = 0; i < n; i++) {
      const a = c0 + ((c1 - c0) * i) / n,
        b = c0 + ((c1 - c0) * (i + 1)) / n
      const seg = quad(
        [a, topY - 0.5],
        [(a + b) / 2, topY - 0.5 - 4.5 - rand() * 2],
        [b, topY - 0.5],
        6,
      )
      upper.push(...(i ? seg.slice(1) : seg))
    }
    const depth = num(p, 'cloudDepth', 8)
    for (let i = n; i > 0; i--) {
      const a = c0 + ((c1 - c0) * i) / n,
        b = c0 + ((c1 - c0) * (i - 1)) / n
      const dy = depth + (rand() - 0.5) * 2
      const seg = quad([a, topY + dy], [(a + b) / 2, topY + dy + 4 + rand() * 2], [b, topY + dy], 6)
      lower.push(...(i < n ? seg.slice(1) : seg))
    }
    const cloud: Pt[] = [...upper, ...lower]
    out.push(occlude(cloud))
    out.push(stroke('hair', upper), stroke('hair', lower))
  }
  // Contour: the skyline in `line`, the flat top in bold, the cliff foot in line.
  out.push(stroke('line', sky))
  out.push(
    stroke('bold', [
      [tableL, topY],
      [tableR, topY],
    ]),
  )
  const foot: Pt[] = []
  for (let px = tableL + 1; px <= tableR; px += 3) foot.push([px, cb(px)])
  out.push(stroke('hair', foot))
  return out
}
